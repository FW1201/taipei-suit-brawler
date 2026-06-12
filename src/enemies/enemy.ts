import * as THREE from 'three';
import type { ICharacterVisual } from '../combat/visual';
import { createCharacterVisual } from '../combat/visual-glb';
import type { Hittable, HitOptions } from '../combat/damage';
import { inArc } from '../combat/damage';
import type { EnemyDef } from '../types';
import { bus } from '../core/events';
import { playSound } from '../core/audio';

export interface PlayerTarget {
  readonly position: THREE.Vector3;
  readonly isAlive: boolean;
  takeDamage(amount: number, fromPos: THREE.Vector3): void;
}

export interface EnemyHost {
  /** 申請攻擊權杖（同時圍毆人數上限）；回傳是否取得 */
  requestAttackToken(e: Enemy): boolean;
  releaseAttackToken(e: Enemy): void;
  /** 投擲手丟瓶 */
  spawnProjectile(from: THREE.Vector3, target: THREE.Vector3, damage: number): void;
}

type EnemyState = 'idle' | 'chase' | 'strafe' | 'windup' | 'attack' | 'stagger' | 'knocked' | 'dead';

const WINDUP_TIME = 0.45;
const ATTACK_TIME = 0.3;
const STAGGER_TIME = 0.35;
const KNOCKED_TIME = 1.4;

export class Enemy implements Hittable {
  readonly position = new THREE.Vector3();
  readonly visual: ICharacterVisual;
  readonly def: EnemyDef;

  hp: number;
  maxHp: number;
  private state: EnemyState = 'idle';
  private stateTime = 0;
  private facing = 0;
  private cooldown = 0;        // 攻擊冷卻
  private strafeDir = Math.random() > 0.5 ? 1 : -1;
  private strafeTimer = 0;
  private enraged = false;
  private blockedRecently = 0; // 連續被打中數，用於破格擋判斷
  private fadeTimer = -1;
  /** Boss 階段（1 起算）；非 Boss 恆為 1 */
  phase = 1;

  constructor(
    def: EnemyDef,
    spawnPos: THREE.Vector3,
    private player: PlayerTarget,
    private host: EnemyHost,
  ) {
    this.def = def;
    this.hp = this.maxHp = def.hp;
    this.position.copy(spawnPos);
    this.visual = createCharacterVisual({
      suitColor: parseInt(def.tint.replace('#', ''), 16),
      shirtColor: def.kind === 'bodyguard' ? 0x222222 : 0xcccccc,
      sunglasses: def.kind === 'bodyguard' || def.kind === 'boss',
      scale: def.scale,
      tieColor: def.kind === 'boss' ? 0xd4af37 : undefined,
    });
  }

  isAlive(): boolean {
    return this.state !== 'dead';
  }

  get isAttacking(): boolean {
    return this.state === 'windup' || this.state === 'attack';
  }

  private get speed(): number {
    return this.def.speed * (this.enraged ? 1.6 : 1);
  }

  private get damage(): number {
    return this.def.damage * (this.enraged ? 1.3 : 1) * (this.phase > 1 ? 1 + (this.phase - 1) * 0.25 : 1);
  }

  update(dt: number): void {
    this.stateTime += dt;
    this.cooldown -= dt;

    // 狂徒/Boss 狂暴判定
    if (!this.enraged && this.def.enrageBelow && this.hp / this.maxHp <= this.def.enrageBelow) {
      this.enraged = true;
      this.visual.setRageGlow(true);
    }

    if (this.state === 'dead') {
      if (this.fadeTimer > 0) {
        this.fadeTimer -= dt;
        this.visual.root.scale.multiplyScalar(Math.max(0.0001, 1 - dt * 1.5));
        if (this.fadeTimer <= 0) this.visual.dispose();
      }
      this.visual.update(dt);
      return;
    }

    if (!this.player.isAlive) {
      this.toState('idle');
      this.visual.setState('idle');
    } else {
      this.think(dt);
    }

    this.visual.root.position.x = this.position.x;
    this.visual.root.position.z = this.position.z;
    this.visual.root.rotation.y = this.facing;
    this.visual.update(dt);
  }

  private think(dt: number): void {
    const toPlayer = this.player.position.clone().sub(this.position);
    toPlayer.y = 0;
    const dist = toPlayer.length();
    const dir = dist > 0.001 ? toPlayer.clone().normalize() : new THREE.Vector3(0, 0, 1);
    this.facing = Math.atan2(dir.x, dir.z);

    const isRanged = !!this.def.projectile;
    const desiredRange = isRanged ? 7 : this.def.attackRange;

    switch (this.state) {
      case 'idle':
        if (dist < 14) this.toState('chase');
        this.visual.setState('idle');
        break;

      case 'chase': {
        if (isRanged) {
          // 投擲手：保持距離
          if (dist < 5) {
            this.position.addScaledVector(dir, -this.speed * dt); // 後退
            this.visual.setState('walk');
          } else if (dist > 9) {
            this.position.addScaledVector(dir, this.speed * dt);
            this.visual.setState('run');
          } else if (this.cooldown <= 0) {
            this.toState('windup');
            this.visual.setState('throw');
          } else {
            this.visual.setState('idle');
          }
          break;
        }
        if (dist > desiredRange * 0.9) {
          this.position.addScaledVector(dir, this.speed * dt);
          this.visual.setState('run');
        } else if (this.cooldown <= 0 && this.host.requestAttackToken(this)) {
          this.toState('windup');
          this.visual.setState(this.def.kind === 'bruiser' ? 'heavy' : 'punch1');
        } else {
          this.toState('strafe');
        }
        break;
      }

      case 'strafe': {
        // 環繞走位：等待攻擊權杖
        this.strafeTimer -= dt;
        if (this.strafeTimer <= 0) {
          this.strafeTimer = 1 + Math.random() * 1.5;
          this.strafeDir = Math.random() > 0.5 ? 1 : -1;
        }
        const tangent = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(this.strafeDir);
        this.position.addScaledVector(tangent, this.speed * 0.45 * dt);
        // 維持包圍距離
        if (dist > desiredRange + 1.5) this.position.addScaledVector(dir, this.speed * 0.5 * dt);
        else if (dist < desiredRange * 0.7) this.position.addScaledVector(dir, -this.speed * 0.3 * dt);
        this.visual.setState('walk');
        if (this.cooldown <= 0 && dist <= desiredRange && this.host.requestAttackToken(this)) {
          this.toState('windup');
          this.visual.setState(this.def.kind === 'bruiser' ? 'heavy' : 'punch1');
        } else if (dist > 14) {
          this.toState('chase');
        }
        break;
      }

      case 'windup':
        if (this.stateTime >= WINDUP_TIME * (this.def.kind === 'bruiser' ? 1.5 : 1)) {
          this.toState('attack');
          if (this.def.projectile) {
            this.host.spawnProjectile(
              this.position.clone().setY(1.6),
              this.player.position.clone(),
              this.damage,
            );
          } else {
            // 近戰命中判定
            if (inArc(this.position, this.facing, this.def.attackRange + 0.4, 100, this.player.position)) {
              this.player.takeDamage(this.damage, this.position);
            }
          }
        }
        break;

      case 'attack':
        if (this.stateTime >= ATTACK_TIME) {
          this.cooldown = this.def.attackCooldown * (this.enraged ? 0.6 : 1);
          this.host.releaseAttackToken(this);
          this.toState('strafe');
        }
        break;

      case 'stagger':
        if (this.stateTime >= STAGGER_TIME) this.toState('strafe');
        break;

      case 'knocked':
        if (this.stateTime >= KNOCKED_TIME) {
          this.toState('strafe');
          this.visual.setState('idle');
        }
        break;
    }
  }

  private toState(s: EnemyState): void {
    if (this.state === 'windup' || this.state === 'attack') {
      if (s !== 'attack') this.host.releaseAttackToken(this);
    }
    this.state = s;
    this.stateTime = 0;
  }

  takeHit(damage: number, opts: HitOptions): boolean {
    if (!this.isAlive()) return false;

    // 保鑣格擋：未被破防且機率成功 → 無傷
    if (this.def.blockChance && !opts.breaksBlock && this.state !== 'knocked') {
      this.blockedRecently += 1;
      if (this.blockedRecently < 4 && Math.random() < this.def.blockChance) {
        this.visual.setState('block');
        setTimeout(() => { if (this.isAlive() && this.visual.getState() === 'block') this.visual.setState('idle'); }, 350);
        return false;
      }
    }
    this.blockedRecently = 0;

    this.hp -= Math.round(damage);
    this.visual.flashTint(opts.isCrit ? 0xffdd00 : 0xffffff);
    bus.emit('enemy:damaged', { defId: this.def.id, hp: Math.max(0, this.hp), maxHp: this.maxHp });
    bus.emit('fx:damage', {
      x: this.position.x,
      y: 1.9 * this.def.scale,
      z: this.position.z,
      amount: damage,
      isCrit: !!opts.isCrit,
    });

    // 擊退
    const kb = this.position.clone().sub(opts.fromPos);
    kb.y = 0;
    if (kb.lengthSq() > 0) this.position.addScaledVector(kb.normalize(), opts.knockback);

    if (this.hp <= 0) {
      this.die();
      return true;
    }

    // Boss 階段切換
    if (this.def.phases && this.def.phases > 1) {
      const newPhase = Math.min(this.def.phases, 1 + Math.floor((1 - this.hp / this.maxHp) * this.def.phases));
      if (newPhase > this.phase) {
        this.phase = newPhase;
        bus.emit('boss:phase', { phase: newPhase });
      }
    }

    // 硬直：壯漢/Boss 對輕攻擊有霸體
    const superArmor = this.def.kind === 'bruiser' || this.def.kind === 'boss';
    if (opts.knockdown && !(superArmor && !opts.breaksBlock)) {
      this.toState('knocked');
      this.visual.setState('down');
    } else if (!superArmor) {
      this.toState('stagger');
      this.visual.setState('hit');
    }
    return true;
  }

  private die(): void {
    this.hp = 0;
    this.toState('dead');
    this.state = 'dead';
    this.visual.setState('down');
    this.visual.setRageGlow(false);
    this.fadeTimer = 1.2;
    playSound('enemyDown');
    bus.emit('enemy:died', { defId: this.def.id, money: this.def.money });
  }

  dispose(): void {
    this.visual.dispose();
  }
}
