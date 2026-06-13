import { Vec3 } from '../core/vec';
import { createCharacterVisual, type ICharacterVisual } from './visual';
import type { HitQuery } from './damage';
import type { ObjectManager } from '../world/objects';
import type { PlayerStats } from '../types';
import { bus } from '../core/events';
import { input } from '../core/input';
import { playSound } from '../core/audio';
import { timeCtl } from '../core/time';

type PlayerState = 'free' | 'attack' | 'dodge' | 'hit' | 'downed' | 'rage' | 'dead';

export interface PlayerDelegate {
  /** 嘗試喝珍奶：回傳回復量（null = 沒庫存） */
  tryDrinkTea(): number | null;
}

const LIGHT_DURATION = [0.28, 0.28, 0.34, 0.34, 0.34]; // 各段時長
const LIGHT_HIT_AT = 0.12;       // 命中幀時間點
const HEAVY_DURATION = 0.42;
const HEAVY_HIT_AT = 0.27;
const DODGE_DURATION = 0.42;
const COMBO_QUEUE_WINDOW = 0.5;  // 收招後可接下一段的窗口
const POWER_COST = 100;          // 重擊所需蓄力（輕拳命中 +25 → 約 4 拳蓄滿）
const POWER_PER_HIT = 25;        // 每次輕拳命中累積

export class PlayerController {
  readonly position = new Vec3();
  facing = Math.PI / 2; // 弧度：x-z 平面方位角，π/2 = 面向 +x（右）
  readonly visual: ICharacterVisual;

  hp: number;
  rage = 0;          // 0-100（必殺）
  power = 0;         // 0-100（重擊蓄力：輕拳命中累積，滿 POWER_COST 才能放重擊）
  revivesLeft = 2;

  private state: PlayerState = 'free';
  private stateTime = 0;
  private comboStep = 0;          // 0 = 未在連擊中
  private comboHits = 0;          // HUD 顯示的連擊命中數
  private comboResetTimer = 0;
  private queuedLight = false;
  private hitApplied = false;
  private iFramesUntil = -1;      // elapsed 時間軸上的無敵截止
  private counterUntil = -1;      // 閃避後反擊加成窗口
  private dodgeDir = new Vec3();
  private elapsed = 0;
  private downTimer = 0;
  private props: ObjectManager | null = null;

  setProps(p: ObjectManager): void { this.props = p; }

  constructor(
    public stats: PlayerStats,
    private hitQuery: HitQuery,
    private delegate: PlayerDelegate,
    private bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  ) {
    this.hp = stats.maxHp;
    this.visual = createCharacterVisual({
      suitColor: 0x1c2a4a,      // 深藍西裝
      shirtColor: 0xf5f5f5,
      tieColor: 0xff6b35,       // 橘領帶（Neon Circuit accent）
      sunglasses: true,
      isHero: true,
      spriteId: 'hero',         // AI sprite sheet 到位後自動啟用

      onFootstep: () => { if (this.state === 'free') playSound('footstep'); },
    });
  }

  get isAlive(): boolean {
    return this.state !== 'dead';
  }

  get isActionable(): boolean {
    return this.state === 'free';
  }

  get isInvulnerable(): boolean {
    return this.elapsed < this.iFramesUntil || this.state === 'downed' || this.state === 'dead';
  }

  resetForLevel(spawnPos: Vec3, revives = 2): void {
    this.position.copy(spawnPos);
    this.hp = this.stats.maxHp;
    this.rage = 0;
    this.power = 0;
    this.revivesLeft = revives;
    this.state = 'free';
    this.comboStep = 0;
    this.comboHits = 0;
    this.visual.setState('idle');
    bus.emit('player:damaged', { hp: this.hp, maxHp: this.stats.maxHp });
    bus.emit('player:rage', { rage: 0 });
  }

  update(dt: number): void {
    this.elapsed += dt;
    this.stateTime += dt;

    // 連擊數顯示重置
    if (this.comboHits > 0) {
      this.comboResetTimer -= dt;
      if (this.comboResetTimer <= 0) {
        this.comboHits = 0;
        bus.emit('player:combo', { count: 0 });
      }
    }

    switch (this.state) {
      case 'free': this.updateFree(dt); break;
      case 'attack': this.updateAttack(dt); break;
      case 'dodge': this.updateDodge(dt); break;
      case 'hit':
        if (this.stateTime > 0.3) this.toFree();
        break;
      case 'rage':
        if (this.stateTime > 0.6) this.toFree();
        break;
      case 'downed': this.updateDowned(dt); break;
      case 'dead': break;
    }

    this.clampToBounds();
    this.props?.followCarrier(this.position, this.facing, dt);
    this.visual.root.position.x = this.position.x;
    this.visual.root.position.z = this.position.z;
    // visual.update 控制 position.y（跳/翻滾），所以 y 由 visual 管
    this.visual.root.rotation.y = this.facing;
    this.visual.update(dt);
  }

  // ───────── 狀態邏輯 ─────────

  private moveVec = new Vec3();

  /** 橫向捲軸輸入：A/D = 左右（x），W/S = 縱深（z，W 朝畫面上方 = z 減少） */
  private readMoveInput(): Vec3 {
    this.moveVec.set(0, 0, 0);
    if (input.isDown('w')) this.moveVec.z -= 1;
    if (input.isDown('s')) this.moveVec.z += 1;
    if (input.isDown('a')) this.moveVec.x -= 1;
    if (input.isDown('d')) this.moveVec.x += 1;
    if (this.moveVec.lengthSq() > 0) this.moveVec.normalize();
    return this.moveVec;
  }

  private updateFree(dt: number): void {
    const move = this.readMoveInput();
    const moving = move.lengthSq() > 0;
    const riding = this.props?.isRiding() ?? false;

    const carrying = this.props?.hasHeld() ?? false;
    if (moving) {
      const spd = this.stats.moveSpeed * (riding ? 1.7 : 1);
      this.position.addScaledVector(move, spd * dt);
      this.facing = Math.atan2(move.x, move.z);
      this.visual.setState(carrying ? 'carry' : 'run');
    } else {
      this.visual.setState(carrying ? 'carry' : 'idle');
    }

    // 撿起 / 投擲互動物件
    if (this.props?.hasHeld()) {
      if (input.consumePress('j') || input.consumePress('k')) {
        this.props.throwHeld(this.position, this.facing);
        this.visual.setState('throw');
        // 借用 attack 狀態做短暫投擲鎖（comboStep=1 → 有效時長；hitApplied 防止誤觸拳擊判定）
        this.state = 'attack'; this.stateTime = 0; this.comboStep = 1; this.hitApplied = true;
        return;
      }
    } else if (input.consumePress('f')) {
      this.props?.tryPickup(this.position, this.facing);
      return;
    }

    if (input.consumePress('j')) { this.startLight(); return; }
    if (input.consumePress('k')) { this.startHeavy(); return; }
    if (input.consumePress(' ') && moving) { this.startDodge(move); return; }
    if (input.consumePress('l') && this.rage >= 100) { this.startRage(); return; }
    if (input.consumePress('e')) {
      const heal = this.delegate.tryDrinkTea();
      if (heal !== null) {
        this.hp = Math.min(this.stats.maxHp, this.hp + heal);
        playSound('heal');
        bus.emit('player:healed', { hp: this.hp, maxHp: this.stats.maxHp });
      }
    }
  }

  private startLight(): void {
    this.state = 'attack';
    this.stateTime = 0;
    this.comboStep = this.comboStep >= this.stats.comboLength ? 1 : this.comboStep + 1;
    this.hitApplied = false;
    this.queuedLight = false;
    const visualState = (['punch1', 'punch2', 'punch3', 'punch1', 'punch2'] as const)[this.comboStep - 1];
    this.visual.setState(visualState);
    playSound('punchSwing');
    // 出拳時自動面向最近敵人（輔助瞄準）
    this.autoFace();
  }

  private startHeavy(): void {
    // 重擊需蓄滿能量才能釋放（輕拳命中累積 power）
    if (this.power < POWER_COST) {
      playSound('uiClick');               // 未蓄滿：提示音 + 閃爍能量條
      bus.emit('player:power', { power: this.power, ready: false });
      return;
    }
    this.power = Math.max(0, this.power - POWER_COST);
    bus.emit('player:power', { power: this.power, ready: this.power >= POWER_COST });
    this.state = 'attack';
    this.stateTime = 0;
    this.comboStep = -1; // -1 = heavy
    this.hitApplied = false;
    this.visual.setState('heavy');
    this.visual.setRageGlow(true);        // 蓄力重擊：金色光效差異
    setTimeout(() => { if (this.state !== 'rage') this.visual.setRageGlow(false); }, 360);
    bus.emit('fx:shake', { strength: 0.2 });
    this.autoFace();
  }

  private updateAttack(dt: number): void {
    const isHeavy = this.comboStep === -1;
    const duration = isHeavy ? HEAVY_DURATION : LIGHT_DURATION[this.comboStep - 1];
    const hitAt = isHeavy ? HEAVY_HIT_AT : LIGHT_HIT_AT;

    if (input.consumePress('j')) this.queuedLight = true;

    if (!this.hitApplied && this.stateTime >= hitAt) {
      this.hitApplied = true;
      this.applyAttackHit(isHeavy);
    }

    if (this.stateTime >= duration) {
      if (this.queuedLight && !isHeavy && this.comboStep < this.stats.comboLength) {
        this.startLight();
      } else {
        this.comboStep = 0;
        this.toFree();
      }
    }
  }

  private applyAttackHit(isHeavy: boolean): void {
    const isFinisher = !isHeavy && this.comboStep === this.stats.comboLength;
    const range = isHeavy ? 2.0 + this.stats.heavyRadius : 1.8;
    const arc = isHeavy ? 140 : 90;
    const counterBonus = this.elapsed < this.counterUntil ? this.stats.counterMult : 1;
    const isCrit = Math.random() < this.stats.critChance;
    let damage = isHeavy ? this.stats.heavyDamage : this.stats.lightDamage * (isFinisher ? 1.5 : 1);
    damage *= counterBonus * (isCrit ? 1.5 : 1);

    const targets = this.hitQuery.queryArc(this.position, this.facing, range, arc);
    let hitAny = false;
    for (const t of targets) {
      const landed = t.takeHit(damage, {
        fromPos: this.position,
        knockback: isHeavy ? 2.2 : isFinisher ? 1.6 : 0.45,
        breaksBlock: isHeavy || isFinisher,
        knockdown: isHeavy || isFinisher,
        isCrit,
      });
      if (landed) hitAny = true;
    }

    if (hitAny) {
      playSound(isHeavy ? 'heavyHit' : 'punchHit');
      timeCtl.hitstop(isHeavy || isFinisher ? 0.09 : 0.04); // 命中頓幀
      if (isHeavy || isFinisher) bus.emit('fx:shake', { strength: 0.28 });
      this.comboHits += 1;
      this.comboResetTimer = 2.2;
      bus.emit('player:combo', { count: this.comboHits });
      this.gainRage((isHeavy ? 14 : 8) * this.stats.rageGainMult);
      if (!isHeavy) {                       // 輕拳命中累積重擊蓄力
        this.power = Math.min(POWER_COST, this.power + POWER_PER_HIT);
        bus.emit('player:power', { power: this.power, ready: this.power >= POWER_COST });
      }
    }
  }

  private startDodge(dir: Vec3): void {
    this.state = 'dodge';
    this.stateTime = 0;
    this.dodgeDir.copy(dir);
    this.facing = Math.atan2(dir.x, dir.z);
    this.iFramesUntil = this.elapsed + this.stats.dodgeIFrames;
    this.visual.setState('dodge');
    playSound('dodge');
  }

  private updateDodge(dt: number): void {
    this.position.addScaledVector(this.dodgeDir, this.stats.moveSpeed * 1.9 * dt);
    if (this.stateTime >= DODGE_DURATION) {
      this.counterUntil = this.elapsed + 1.0; // 閃避後 1 秒內反擊加成
      this.toFree();
    }
  }

  private startRage(): void {
    this.state = 'rage';
    this.stateTime = 0;
    this.rage = 0;
    bus.emit('player:rage', { rage: 0 });
    this.visual.setState('rage');
    this.visual.setRageGlow(true);
    setTimeout(() => this.visual.setRageGlow(false), 700);
    playSound('rage');
    timeCtl.hitstop(0.14);
    bus.emit('fx:shake', { strength: 0.5 });

    // 「正義制裁」AOE：半徑 4.5m 全體大傷害 + 擊倒
    const targets = this.hitQuery.queryRadius(this.position, 4.5);
    for (const t of targets) {
      t.takeHit(this.stats.heavyDamage * 2.5, {
        fromPos: this.position,
        knockback: 3.5,
        breaksBlock: true,
        knockdown: true,
      });
    }
  }

  private updateDowned(dt: number): void {
    this.downTimer -= dt;
    if (this.downTimer <= 0) {
      // 西裝重整：復活
      this.hp = Math.round(this.stats.maxHp * 0.5 * this.stats.reviveHpMult);
      this.state = 'free';
      this.iFramesUntil = this.elapsed + 2; // 復活短暫無敵
      this.visual.setState('idle');
      bus.emit('player:revived', { hp: this.hp });
      bus.emit('player:healed', { hp: this.hp, maxHp: this.stats.maxHp });
    }
  }

  private toFree(): void {
    this.state = 'free';
    this.stateTime = 0;
    this.visual.setState('idle');
  }

  /** 出拳時自動轉向最近的敵人 */
  private autoFace(): void {
    const nearby = this.hitQuery.queryRadius(this.position, 3.2);
    let best: Vec3 | null = null;
    let bestDist = Infinity;
    for (const t of nearby) {
      const d = t.position.distanceToSquared(this.position);
      if (d < bestDist) { bestDist = d; best = t.position; }
    }
    if (best) {
      this.facing = Math.atan2(best.x - this.position.x, best.z - this.position.z);
    }
  }

  private gainRage(amount: number): void {
    this.rage = Math.min(100, this.rage + amount);
    bus.emit('player:rage', { rage: this.rage });
  }

  /** 敵人呼叫：對玩家造成傷害 */
  takeDamage(amount: number, fromPos: Vec3): void {
    if (!this.isAlive || this.isInvulnerable || this.state === 'dodge') return;
    const final = Math.max(1, Math.round(amount * (1 - this.stats.damageReduction)));
    this.hp -= final;
    this.gainRage(4 * this.stats.rageGainMult);
    this.visual.flashTint(0xff0000);
    playSound('hurt');
    bus.emit('fx:shake', { strength: 0.32 });

    // 擊退
    const kb = this.position.clone().sub(fromPos);
    kb.y = 0;
    if (kb.lengthSq() > 0) this.position.addScaledVector(kb.normalize(), 0.4);

    if (this.hp <= 0) {
      this.hp = 0;
      if (this.revivesLeft > 0) {
        this.revivesLeft -= 1;
        this.state = 'downed';
        this.downTimer = 3;
        this.visual.setState('down');
        bus.emit('player:downed', { revivesLeft: this.revivesLeft });
      } else {
        this.state = 'dead';
        this.visual.setState('down');
        bus.emit('player:downed', { revivesLeft: -1 }); // -1 = 徹底倒下，關卡失敗
      }
    } else {
      if (this.state === 'free') {
        this.state = 'hit';
        this.stateTime = 0;
        this.visual.setState('hit');
      }
    }
    bus.emit('player:damaged', { hp: this.hp, maxHp: this.stats.maxHp });
  }

  private clampToBounds(): void {
    this.props?.resolveCover(this.position, 0.4);
    this.position.x = Math.max(this.bounds.minX, Math.min(this.bounds.maxX, this.position.x));
    this.position.z = Math.max(this.bounds.minZ, Math.min(this.bounds.maxZ, this.position.z));
  }
}
