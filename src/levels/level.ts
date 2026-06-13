// LevelRunner：單一關卡完整生命週期 — 橫向推進 + 鎖屏戰鬥（經典清版結構）。
// 流程：advance（向右推進，GO 箭頭）→ fight（鎖屏出怪）→ … → boss → 結算。
import { Vec3, lerp } from '../core/vec';
import type { Engine } from '../core/engine';
import { GameCamera, DEPTH } from '../core/camera';
import { buildEnvironment, type Environment } from './builder';
import { PlayerController, type PlayerDelegate } from '../combat/player';
import { EnemyManager } from '../enemies/manager';
import type { PlayerTarget } from '../enemies/enemy';
import { ObjectManager } from '../world/objects';
import { QuestTracker } from '../systems/quest';
import { CombatFX } from '../combat/fx';
import { bus } from '../core/events';
import type { HudAPI, LevelDef, LevelRank, PlayerStats, QuestDef } from '../types';
import { getEnemyDef } from '../data';

export interface LevelOutcome {
  success: boolean;
  rank: LevelRank | null;
  moneyEarned: number;
  skillPointsEarned: number;
}

type Mode = 'advance' | 'fight' | 'bossAdvance' | 'boss' | 'done';

export class LevelRunner {
  private env: Environment;
  private cam = new GameCamera();
  private player: PlayerController;
  private enemies: EnemyManager;
  private objects: ObjectManager;
  private tracker: QuestTracker;
  private fx = new CombatFX();

  private mode: Mode = 'advance';
  private sectionIdx = 0;          // 下一個（或進行中）鎖屏戰鬥節
  private sectionXs: number[] = [];
  private bossX: number;
  private bossDead = false;
  private levelMoney = 0;
  private revivesUsed = 0;
  private protectHp = 100;
  private finished = false;
  private elapsed = 0;
  private unsubs: (() => void)[] = [];
  private offUpdate: () => void;
  private goArrow: HTMLDivElement;
  private bounds: { minX: number; maxX: number; minZ: number; maxZ: number };

  constructor(
    private engine: Engine,
    private level: LevelDef,
    quests: QuestDef[],
    stats: PlayerStats,
    delegate: PlayerDelegate,
    private hud: HudAPI,
    private onFinish: (outcome: LevelOutcome) => void,
  ) {
    this.env = buildEnvironment(level.envTheme, level.length);
    this.tracker = new QuestTracker(quests);
    this.cam.setLevelBounds(0, level.length);

    // 鎖屏節點：waves 沿關卡均勻分布；Boss 在尾段
    const n = level.waves.length;
    this.sectionXs = level.waves.map((_, i) => (n === 1 ? 10 : lerp(10, level.length - 22, i / (n - 1))));
    this.bossX = level.length - 10;

    // 玩家移動邊界（鎖屏時動態收緊）
    this.bounds = { ...this.env.bounds };

    let playerInstance: PlayerController;
    const playerTarget: PlayerTarget = {
      get position() { return playerInstance.position; },
      get isAlive() { return playerInstance.isAlive; },
      takeDamage: (amount, fromPos) => playerInstance.takeDamage(amount, fromPos),
    };
    this.enemies = new EnemyManager(playerTarget);
    this.objects = new ObjectManager(this.enemies);
    this.enemies.setCoverBlocker((p) => this.objects.blocksProjectile(p));
    playerInstance = new PlayerController(stats, this.enemies, delegate, this.bounds);
    this.player = playerInstance;
    this.player.setProps(this.objects);
    this.player.resetForLevel(new Vec3(3, 0, DEPTH * 0.55));

    // GO 推進箭頭
    this.goArrow = document.createElement('div');
    this.goArrow.textContent = '前進 ▶▶';
    this.goArrow.style.cssText = `
      position:absolute; right:4%; top:42%; font-family:'Noto Sans TC',sans-serif;
      font-size:34px; font-weight:900; color:#FFD23F; pointer-events:none;
      text-shadow:0 0 14px rgba(255,210,63,0.7), 0 2px 4px rgba(0,0,0,0.8);
      animation:tsb-go 0.8s ease-in-out infinite; display:none;`;
    if (!document.getElementById('tsb-go-style')) {
      const st = document.createElement('style');
      st.id = 'tsb-go-style';
      st.textContent = '@keyframes tsb-go { 0%,100% { transform: translateX(0); opacity:0.85; } 50% { transform: translateX(14px); opacity:1; } }';
      document.head.appendChild(st);
    }
    document.getElementById('ui-root')!.appendChild(this.goArrow);

    this.wireEvents();
    this.offUpdate = engine.onUpdate((dt, elapsed) => this.update(dt, elapsed));
    engine.setDraw((ctx, w, h) => this.draw(ctx, w, h));

    hud.show();
    hud.setQuests(this.tracker.hudList());
    hud.announce(`第 ${level.id} 關　${level.name}`, 2200);
    this.setMode('advance');

    // DEV 流程測試鉤子（production build 會被 tree-shake）
    if (import.meta.env.DEV) {
      (window as any).__win = () => { this.tracker.finalize(); this.bossDead = true; this.succeed(); };
      (window as any).__lose = () => this.fail();
      // 傳送（略過沿途鎖屏節，供場景檢視）
      (window as any).__tp = (x: number) => {
        this.player.position.x = x;
        while (this.sectionIdx < this.level.waves.length && this.sectionXs[this.sectionIdx] < x) this.sectionIdx += 1;
      };
    }
  }

  // ───────── 模式切換 ─────────

  private setMode(m: Mode): void {
    this.mode = m;
    const advancing = m === 'advance' || m === 'bossAdvance';
    this.goArrow.style.display = advancing ? 'block' : 'none';
    if (advancing) {
      this.cam.unlock();
      this.bounds.minX = this.env.bounds.minX;
      this.bounds.maxX = this.env.bounds.maxX;
    }
  }

  /** 鎖屏：鏡頭固定在 centerX 並收緊玩家邊界 */
  private lockAt(centerX: number): void {
    const half = this.cam.halfW;
    const c = Math.max(half, Math.min(this.level.length - half, centerX));
    this.cam.lock(c);
    this.bounds.minX = c - half + 0.8;
    this.bounds.maxX = c + half - 0.8;
  }

  private startSection(idx: number): void {
    const wave = this.level.waves[idx];
    this.lockAt(this.sectionXs[idx] + this.cam.halfW * 0.45);
    this.setMode('fight');
    bus.emit('wave:started', { index: idx + 1, total: this.level.waves.length });
    if (this.level.waves.length > 1) {
      this.hud.announce(`第 ${idx + 1} / ${this.level.waves.length} 波`, 1500);
    }
    // 互動物件：在鎖屏區內散佈（爆炸物/足球/除草機/掩體）
    if (wave.props?.length) {
      const c = this.boundsCenter();
      wave.props.forEach((kind, i) => {
        const x = c + (i - (wave.props!.length - 1) / 2) * 2.6 + (Math.random() - 0.5);
        const z = 0.8 + Math.random() * (DEPTH - 1.6);
        this.objects.spawn(kind, new Vec3(x, 0, z));
      });
    }
    // 從鎖屏視野左右兩側進場
    let side = 1;
    for (const [defId, count] of Object.entries(wave.spawns)) {
      const def = getEnemyDef(defId);
      for (let i = 0; i < count; i++) {
        side = -side;
        const x = this.boundsCenter() + side * (this.cam.halfW + 1.5 + Math.random() * 2);
        const z = 0.6 + Math.random() * (DEPTH - 1.2);
        this.enemies.spawn(def, new Vec3(x, 0, z));
      }
    }
  }

  private boundsCenter(): number {
    return (this.bounds.minX + this.bounds.maxX) / 2;
  }

  private spawnBoss(): void {
    this.lockAt(this.bossX);
    this.setMode('boss');
    const def = getEnemyDef(this.level.bossId);
    this.enemies.spawn(def, new Vec3(this.bounds.maxX - 2, 0, DEPTH * 0.5));
    this.hud.showBossBar(def.name);
    this.hud.setBossHP(def.hp, def.hp);
    this.hud.announce(`頭目出現：${def.name}`, 2400);
  }

  // ───────── 事件 ─────────

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
      bus.on('fx:shake', ({ strength }) => this.cam.shake(strength)),
      bus.on('fx:damage', ({ x, y, z, amount, isCrit }) => {
        this.fx.damageNumber(new Vec3(x, y, z), amount, isCrit, this.cam);
      }),
    );
  }

  // ───────── 主迴圈 ─────────

  private update(dt: number, elapsed: number): void {
    if (this.finished) return;
    this.elapsed = elapsed;
    this.env.update(dt, elapsed);
    this.player.update(dt);
    this.enemies.update(dt);
    this.objects.update(dt);
    // 敵人被掩體推開
    for (const e of this.enemies.all) {
      if (e.isAlive()) this.objects.resolveCover(e.position, e.def.scale * 0.4);
    }
    this.tracker.update(dt);
    this.cam.update(this.player.position.x, dt);
    this.fx.updateEnemyBars(this.enemies.all, this.cam);
    this.hud.setQuests(this.tracker.hudList());

    // protect 目標：敵人靠近持續損血
    if (this.env.protectTarget && this.protectHp > 0) {
      const attackers = this.enemies.queryRadius(this.env.protectTarget, 2.5).length;
      if (attackers > 0) {
        this.protectHp = Math.max(0, this.protectHp - attackers * 5 * dt);
        this.tracker.onProtectDamaged(this.protectHp / 100);
      }
    }

    switch (this.mode) {
      case 'advance':
        if (this.player.position.x >= this.sectionXs[this.sectionIdx]) {
          this.startSection(this.sectionIdx);
        }
        break;
      case 'fight':
        if (this.enemies.aliveCount === 0) {
          this.tracker.onWaveCleared();
          this.sectionIdx += 1;
          if (this.sectionIdx < this.level.waves.length) {
            this.setMode('advance');
          } else {
            this.setMode('bossAdvance');
          }
        }
        break;
      case 'bossAdvance':
        if (this.player.position.x >= this.bossX - this.cam.halfW * 0.5) {
          this.spawnBoss();
        }
        break;
      case 'boss':
        if (this.bossDead && this.enemies.aliveCount === 0) {
          this.setMode('done');
          this.succeed();
        }
        break;
    }
  }

  // ───────── 繪製組裝 ─────────

  private draw(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.cam.viewport(w, h);
    this.env.drawBackground(ctx, this.cam, w, h, this.elapsed);

    // 地面互動物件（掩體/靜置物件）先依縱深畫，與角色共用 y-sort 視覺
    this.objects.draw(ctx, this.cam);

    // 實體層：依縱深 y-sort（z 小 = 遠 = 先畫）
    const visuals = [this.player.visual, ...this.enemies.all.map((e) => e.visual)]
      .filter((v) => !v.disposed)
      .sort((a, b) => a.root.position.z - b.root.position.z);
    for (const v of visuals) v.draw(ctx, this.cam);

    this.objects.drawHeld(ctx, this.cam);
    this.enemies.drawProjectiles(ctx, this.cam);
    this.env.drawForeground(ctx, this.cam, w, h, this.elapsed);
  }

  // ───────── 結算 ─────────

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
    this.fx.dispose();
    this.goArrow.remove();
    this.hud.hide();
    this.hud.hideBossBar();
  }
}
