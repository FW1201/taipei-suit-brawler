// 2D 橫向捲軸鏡頭：平滑跟隨 + 鎖屏（清版戰鬥）+ 震動 + 世界→螢幕投影。
// 世界座標：x 橫向（公尺）、z 縱深 0(遠)~DEPTH(近)、y 高度。
import { Vec3, lerp } from './vec';

export const DEPTH = 6;          // 街道縱深（公尺）
const VIEW_METERS_V = 7.0;       // 螢幕垂直涵蓋的世界公尺數（越小越放大；7.0 = 角色更大、操作更清楚）

export interface ScreenPos {
  x: number;
  y: number;
  scale: number; // 深度透視縮放（遠小近大）
}

export class GameCamera {
  /** 目前鏡頭中心 world x */
  x = 0;
  private levelMin = 0;
  private levelMax = 100;
  private lockX: number | null = null;
  private initialized = false;
  private shakeTime = 0;
  private shakeStrength = 0;
  private sx = 0; // 當前震動偏移（px）
  private sy = 0;

  private w = 1280;
  private h = 720;

  /** 每幀由 draw 呼叫，同步畫布尺寸 */
  viewport(w: number, h: number): void {
    this.w = w;
    this.h = h;
  }

  get ppm(): number {
    return this.h / VIEW_METERS_V;
  }

  /** 可視半寬（公尺） */
  get halfW(): number {
    return this.w / 2 / this.ppm;
  }

  setLevelBounds(min: number, max: number): void {
    this.levelMin = min;
    this.levelMax = max;
  }

  /** 鎖屏：鏡頭固定在 centerX（清版戰鬥） */
  lock(centerX: number): void {
    this.lockX = centerX;
  }

  unlock(): void {
    this.lockX = null;
  }

  get isLocked(): boolean {
    return this.lockX !== null;
  }

  shake(strength = 0.25, duration = 0.18): void {
    this.shakeStrength = Math.max(this.shakeStrength, strength);
    this.shakeTime = Math.max(this.shakeTime, duration);
  }

  update(targetX: number, dt: number): void {
    const min = this.levelMin + this.halfW;
    const max = Math.max(min, this.levelMax - this.halfW);
    let desired = this.lockX ?? targetX;
    desired = Math.max(min, Math.min(max, desired));
    if (!this.initialized) {
      this.x = desired;
      this.initialized = true;
    }
    this.x = lerp(this.x, desired, 1 - Math.exp(-5 * dt));

    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      const s = this.shakeStrength * this.ppm * 0.35;
      this.sx = (Math.random() - 0.5) * s;
      this.sy = (Math.random() - 0.5) * s;
      if (this.shakeTime <= 0) this.shakeStrength = 0;
    } else {
      this.sx = 0;
      this.sy = 0;
    }
  }

  /** 地面帶（街道）在螢幕上的範圍 */
  get groundTopY(): number { return this.h * 0.56; }
  get groundBottomY(): number { return this.h * 0.97; }

  /** 世界座標 → 螢幕 px（含震動與深度透視縮放） */
  worldToScreen(v: Vec3, out?: ScreenPos): ScreenPos {
    const o = out ?? { x: 0, y: 0, scale: 1 };
    const zt = Math.max(0, Math.min(1, v.z / DEPTH));
    o.scale = 0.74 + 0.26 * zt;
    o.x = this.w / 2 + (v.x - this.x) * this.ppm + this.sx;
    o.y = this.groundTopY + zt * (this.groundBottomY - this.groundTopY) - v.y * this.ppm * o.scale + this.sy;
    return o;
  }

  /** 背景視差：依係數（0=不動的遠景, 1=與地面同速）取得 x 偏移 px */
  parallaxOffset(factor: number): number {
    return -this.x * this.ppm * factor + this.sx * factor;
  }
}
