// LevelRunner：單一關卡的完整生命週期 — 場景、玩家、波次、Boss、任務、勝敗判定。
import * as THREE from 'three';
import type { Engine } from '../core/engine';
import { FollowCamera } from '../core/camera';
import { buildEnvironment, type Environment } from './builder';
import { PlayerController, type PlayerDelegate } from '../combat/player';
import { EnemyManager } from '../enemies/manager';
import type { PlayerTarget } from '../enemies/enemy';
import { QuestTracker } from '../systems/quest';
import { bus } from '../core/events';
import type { HudAPI, LevelDef, LevelRank, PlayerStats, QuestDef } from '../types';
import { getEnemyDef } from '../data';

export interface LevelOutcome {
  success: boolean;
  rank: LevelRank | null;
  moneyEarned: number;
  skillPointsEarned: number;
}

export class LevelRunner {
  private env: Environment;
  private player: PlayerController;
  private enemies: EnemyManager;
  private tracker: QuestTracker;
  private followCam: FollowCamera;
  private waveIndex = -1;
  private bossSpawned = false;
  private bossDead = false;
  private levelMoney = 0;
  private revivesUsed = 0;
  private protectHp = 100;
  private finished = false;
  private unsubs: (() => void)[] = [];
  private offUpdate: () => void;

  constructor(
    private engine: Engine,
    private level: LevelDef,
    quests: QuestDef[],
    stats: PlayerStats,
    delegate: PlayerDelegate,
    private hud: HudAPI,
    private onFinish: (outcome: LevelOutcome) => void,
  ) {
    this.env = buildEnvironment(engine.scene, level.envTheme);
    this.followCam = new FollowCamera(engine.camera);
    this.tracker = new QuestTracker(quests);

    // player ↔ enemies 相互引用：先建立 lazy adapter
    let playerInstance: PlayerController;
    const playerTarget: PlayerTarget = {
      get position() { return playerInstance.position; },
      get isAlive() { return playerInstance.isAlive; },
      takeDamage: (amount, fromPos) => playerInstance.takeDamage(amount, fromPos),
    };
    this.enemies = new EnemyManager(engine.scene, playerTarget);
    playerInstance = new PlayerController(stats, this.enemies, delegate, this.env.bounds);
    this.player = playerInstance;
    this.player.resetForLevel(new THREE.Vector3(0, 0, this.env.bounds.maxZ - 2));
    engine.scene.add(this.player.visual.root);

    this.wireEvents();
    this.offUpdate = engine.onUpdate((dt, elapsed) => this.update(dt, elapsed));

    hud.show();
    hud.setQuests(this.tracker.hudList());
    hud.announce(`第 ${level.id} 關　${level.name}`, 2200);
    setTimeout(() => this.nextWave(), 1800);
  }

  private wireEvents(): void {
    this.unsubs.push(
      bus.on('enemy:died', ({ defId, money }) => {
        this.levelMoney += money;
        const isBoss = defId === this.level.bossId;
        this.tracker.onEnemyDied(isBoss);
        this.hud.setQuests(this.tracker.hudList());
        if (isBoss) {
          this.bossDead = true;
          this.hud.hideBossBar();
        }
      }),
      bus.on('enemy:damaged', ({ defId, hp, maxHp }) => {
        if (defId === this.level.bossId) this.hud.setBossHP(hp, maxHp);
      }),
      bus.on('player:damaged', () => {
        this.tracker.onPlayerDamaged();
        this.hud.setQuests(this.tracker.hudList());
      }),
      bus.on('player:downed', ({ revivesLeft }) => {
        if (revivesLeft >= 0) {
          this.revivesUsed += 1;
          this.hud.announce(`西裝重整中…（剩 ${revivesLeft} 次）`, 2000);
        } else {
          this.fail();
        }
      }),
      bus.on('boss:phase', ({ phase }) => {
        this.hud.announce(`頭目進入第 ${phase} 階段！`, 1800);
      }),
      bus.on('quest:failed', () => {
        this.hud.setQuests(this.tracker.hudList());
      }),
    );
  }

  private update(dt: number, elapsed: number): void {
    if (this.finished) return;
    this.env.update(dt, elapsed);
    this.player.update(dt, this.engine.camera);
    this.enemies.update(dt);
    this.tracker.update(dt);
    this.followCam.update(this.player.position, dt);
    this.hud.setQuests(this.tracker.hudList());

    // protect 目標：敵人靠近持續損血
    if (this.env.protectTarget && this.protectHp > 0) {
      const pos = new THREE.Vector3();
      this.env.protectTarget.getWorldPosition(pos);
      const attackers = this.enemies.queryRadius(pos, 2.5).length;
      if (attackers > 0) {
        this.protectHp = Math.max(0, this.protectHp - attackers * 5 * dt);
        this.tracker.onProtectDamaged(this.protectHp / 100);
      }
    }

    // 波次推進
    if (this.waveIndex >= 0 && this.enemies.aliveCount === 0 && !this.finished) {
      if (this.waveIndex < this.level.waves.length - 1) {
        this.tracker.onWaveCleared();
        this.nextWave();
      } else if (!this.bossSpawned) {
        this.tracker.onWaveCleared();
        this.spawnBoss();
      } else if (this.bossDead) {
        this.succeed();
      }
    }
  }

  private nextWave(): void {
    this.waveIndex += 1;
    const wave = this.level.waves[this.waveIndex];
    if (!wave) { this.spawnBoss(); return; }
    bus.emit('wave:started', { index: this.waveIndex + 1, total: this.level.waves.length });
    if (this.level.waves.length > 1) {
      this.hud.announce(`第 ${this.waveIndex + 1} / ${this.level.waves.length} 波`, 1500);
    }
    const b = this.env.bounds;
    for (const [defId, count] of Object.entries(wave.spawns)) {
      const def = getEnemyDef(defId);
      for (let i = 0; i < count; i++) {
        // 從場地邊緣隨機進場
        const edge = Math.floor(Math.random() * 4);
        const pos = new THREE.Vector3(
          edge === 0 ? b.minX + 1 : edge === 1 ? b.maxX - 1 : THREE.MathUtils.lerp(b.minX, b.maxX, Math.random()),
          0,
          edge === 2 ? b.minZ + 1 : edge === 3 ? b.maxZ - 1 : THREE.MathUtils.lerp(b.minZ, b.maxZ, Math.random()),
        );
        this.enemies.spawn(def, pos);
      }
    }
  }

  private spawnBoss(): void {
    if (this.bossSpawned) return;
    this.bossSpawned = true;
    const def = getEnemyDef(this.level.bossId);
    const b = this.env.bounds;
    this.enemies.spawn(def, new THREE.Vector3(0, 0, b.minZ + 2));
    this.hud.showBossBar(def.name);
    this.hud.setBossHP(def.hp, def.hp);
    this.hud.announce(`頭目出現：${def.name}`, 2400);
  }

  private computeRank(): LevelRank {
    const sides = this.tracker.sideQuestsDone;
    const total = this.tracker.sideQuestsTotal;
    if (sides === total && this.revivesUsed === 0) return 'S';
    if (sides >= 1 && this.revivesUsed <= 1) return 'A';
    if (sides >= 1 || this.revivesUsed <= 1) return 'B';
    return 'C';
  }

  private succeed(): void {
    if (this.finished) return;
    this.finished = true;
    this.tracker.finalize();
    const rewards = this.tracker.rewards;
    const outcome: LevelOutcome = {
      success: true,
      rank: this.computeRank(),
      moneyEarned: this.levelMoney + rewards.money,
      skillPointsEarned: rewards.skillPoints,
    };
    bus.emit('level:completed', {
      levelId: this.level.id,
      rank: outcome.rank!,
      moneyEarned: outcome.moneyEarned,
      skillPointsEarned: outcome.skillPointsEarned,
    });
    setTimeout(() => this.onFinish(outcome), 1200);
  }

  private fail(): void {
    if (this.finished) return;
    this.finished = true;
    bus.emit('level:failed', { levelId: this.level.id });
    setTimeout(() => this.onFinish({ success: false, rank: null, moneyEarned: 0, skillPointsEarned: 0 }), 1500);
  }

  dispose(): void {
    this.offUpdate();
    this.unsubs.forEach((u) => u());
    this.enemies.dispose();
    this.hud.hide();
    this.hud.hideBossBar();
  }
}
