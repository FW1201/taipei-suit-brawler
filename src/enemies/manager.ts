import { Vec3 } from '../core/vec';
import type { GameCamera } from '../core/camera';
import { Enemy, type PlayerTarget, type EnemyHost } from './enemy';
import type { Hittable, HitQuery } from '../combat/damage';
import { inArc } from '../combat/damage';
import type { EnemyDef } from '../types';
import { bus } from '../core/events';

const MAX_ATTACK_TOKENS = 2; // 同時出手的敵人上限（經典 beat 'em up 規則）

interface Bottle {
  pos: Vec3;
  from: Vec3;
  to: Vec3;
  t: number;
  damage: number;
  spin: number;
}

export class EnemyManager implements HitQuery, EnemyHost {
  private enemies: Enemy[] = [];
  private tokens = new Set<Enemy>();
  private bottles: Bottle[] = [];

  private coverBlocker: ((p: Vec3) => boolean) | null = null;

  constructor(private player: PlayerTarget) {}

  /** 設定掩體攔截器（飛行投擲物經過實心掩體會被擋下） */
  setCoverBlocker(fn: (p: Vec3) => boolean): void { this.coverBlocker = fn; }

  spawn(def: EnemyDef, pos: Vec3): Enemy {
    const e = new Enemy(def, pos, this.player, this);
    this.enemies.push(e);
    bus.emit('enemy:spawned', { defId: def.id });
    return e;
  }

  get aliveCount(): number {
    return this.enemies.filter((e) => e.isAlive()).length;
  }

  get all(): readonly Enemy[] {
    return this.enemies;
  }

  update(dt: number): void {
    for (const e of this.enemies) e.update(dt);
    this.applySeparation();
    this.updateBottles(dt);
    // 清理權杖（死亡者釋放）
    for (const e of [...this.tokens]) if (!e.isAlive()) this.tokens.delete(e);
  }

  /** 敵人彼此推開，避免疊在一起 */
  private separationVec = new Vec3();
  private applySeparation(): void {
    const alive = this.enemies.filter((e) => e.isAlive());
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const a = alive[i], b = alive[j];
        this.separationVec.copy(a.position).sub(b.position);
        this.separationVec.y = 0;
        const d = this.separationVec.length();
        const minDist = 0.9 * (a.def.scale + b.def.scale) / 2 + 0.3;
        if (d < minDist && d > 0.001) {
          this.separationVec.normalize().multiplyScalar((minDist - d) * 0.5);
          a.position.add(this.separationVec);
          b.position.sub(this.separationVec);
        }
      }
    }
  }

  // ───────── EnemyHost ─────────

  requestAttackToken(e: Enemy): boolean {
    if (this.tokens.has(e)) return true;
    if (this.tokens.size >= MAX_ATTACK_TOKENS) return false;
    this.tokens.add(e);
    return true;
  }

  releaseAttackToken(e: Enemy): void {
    this.tokens.delete(e);
  }

  spawnProjectile(from: Vec3, target: Vec3, damage: number): void {
    this.bottles.push({
      pos: from.clone(),
      from: from.clone(),
      to: target.clone().setY(1),
      t: 0,
      damage,
      spin: 0,
    });
  }

  private updateBottles(dt: number): void {
    for (let i = this.bottles.length - 1; i >= 0; i--) {
      const b = this.bottles[i];
      b.t += dt / 0.9; // 飛行 0.9 秒
      b.spin += dt * 12;
      // 飛行途中被掩體擋下
      if (this.coverBlocker && this.coverBlocker(b.pos)) {
        this.bottles.splice(i, 1);
        continue;
      }
      if (b.t >= 1) {
        // 落地：命中判定
        if (this.player.isAlive && this.player.position.distanceTo(b.to) < 1.3) {
          this.player.takeDamage(b.damage, b.from);
        }
        this.bottles.splice(i, 1);
        continue;
      }
      b.pos.lerpVectors(b.from, b.to, b.t);
      b.pos.y += Math.sin(b.t * Math.PI) * 2.2; // 拋物線
    }
  }

  /** 投擲物繪製（實體層之後呼叫） */
  drawProjectiles(ctx: CanvasRenderingContext2D, cam: GameCamera): void {
    for (const b of this.bottles) {
      const s = cam.worldToScreen(b.pos);
      const k = cam.ppm * s.scale;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(b.spin);
      ctx.fillStyle = '#77aa55';
      ctx.strokeStyle = '#15120f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-k * 0.05, -k * 0.16, k * 0.1, k * 0.32, k * 0.04);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  // ───────── HitQuery（玩家攻擊查詢） ─────────

  queryArc(pos: Vec3, facingRad: number, range: number, arcDeg: number): Hittable[] {
    return this.enemies.filter(
      (e) => e.isAlive() && inArc(pos, facingRad, range + e.def.scale * 0.3, arcDeg, e.position),
    );
  }

  queryRadius(pos: Vec3, radius: number): Hittable[] {
    return this.enemies.filter((e) => e.isAlive() && e.position.distanceTo(pos) <= radius);
  }

  /** 換關清理 */
  dispose(): void {
    for (const e of this.enemies) e.dispose();
    this.enemies = [];
    this.tokens.clear();
    this.bottles = [];
  }
}
