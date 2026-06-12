// Canvas 2D 渲染迴圈核心：update 訂閱 + 單一 draw 進入點 + hitstop 時間縮放。
import { input } from './input';
import { timeCtl } from './time';

export type UpdateFn = (dt: number, elapsed: number) => void;
export type DrawFn = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

export class Engine {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  width = 0;   // CSS px
  height = 0;
  private updates = new Set<UpdateFn>();
  private drawFn: DrawFn | null = null;
  private running = false;
  private last = 0;
  private elapsed = 0;

  constructor(container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.canvas.width = Math.round(this.width * dpr);
      this.canvas.height = Math.round(this.height * dpr);
      this.canvas.style.width = `${this.width}px`;
      this.canvas.style.height = `${this.height}px`;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // 之後一律以 CSS px 座標繪製
    };
    resize();
    window.addEventListener('resize', resize);
  }

  onUpdate(fn: UpdateFn): () => void {
    this.updates.add(fn);
    return () => this.updates.delete(fn);
  }

  /** 設定當前畫面的繪製函式（關卡 / 標題背景各自接管） */
  setDraw(fn: DrawFn | null): void {
    this.drawFn = fn;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      requestAnimationFrame(loop);
      const raw = Math.min((now - this.last) / 1000, 0.05); // 鎖死最大步長
      this.last = now;
      const dt = timeCtl.scale(raw); // hitstop 頓幀
      this.elapsed += dt;
      this.updates.forEach((fn) => fn(dt, this.elapsed));
      input.endFrame();

      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.width, this.height);
      this.drawFn?.(ctx, this.width, this.height);
    };
    requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
  }

  /** 換場景：清空所有 update 訂閱與繪製 */
  clearScene(): void {
    this.updates.clear();
    this.drawFn = null;
  }
}
