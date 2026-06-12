// 2D 程式化角色：Dad 'n Me（紫色恐怖）風格——扁平色塊、粗黑描邊、大頭大拳小身體。
// AI sprite sheet 到位後自動切換（core/sprites.ts），缺素材時本檔的向量繪製為 fallback。
import { Vec3, lerp } from '../core/vec';
import type { GameCamera } from '../core/camera';
import { getClip, type SpriteClip } from '../core/sprites';

export type VisualState =
  | 'idle' | 'walk' | 'run'
  | 'punch1' | 'punch2' | 'punch3' | 'heavy'
  | 'dodge' | 'hit' | 'down' | 'block' | 'throw' | 'rage';

export interface CharacterVisualOptions {
  suitColor: number;
  shirtColor?: number;
  tieColor?: number;
  skinColor?: number;
  sunglasses?: boolean;
  scale?: number;
  isHero?: boolean;
  /** sprite sheet id（sprites.json 的 key）；有素材時優先使用 */
  spriteId?: string;
  onFootstep?: () => void;
}

/** 角色視覺介面：root 模擬 three Group 的子集，呼叫端（player/enemy）零改動 */
export interface ICharacterVisual {
  readonly root: { position: Vec3; rotation: { y: number }; scale: Vec3 };
  setState(s: VisualState): void;
  getState(): VisualState;
  update(dt: number): void;
  flashTint(color: number, durationMs?: number): void;
  setRageGlow(on: boolean): void;
  draw(ctx: CanvasRenderingContext2D, cam: GameCamera): void;
  dispose(): void;
  readonly disposed: boolean;
}

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
const OUTLINE = '#181410';
const LINE_W = 0.055; // 描邊粗細（公尺），The Behemoth 式粗墨線

/** 顏色加深（cel shading 第二色調用） */
function darken(n: number, f: number): string {
  const r = Math.floor(((n >> 16) & 0xff) * f);
  const g = Math.floor(((n >> 8) & 0xff) * f);
  const b = Math.floor((n & 0xff) * f);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** 攻擊曲線：預備後拉 → 爆發伸出 → 停格 → 收招；peak 對齊 player.ts 命中幀 */
function strike(u: number, anticip: number, peakAt: number): number {
  if (u < anticip) return -0.4 * (u / anticip);
  if (u < peakAt) return lerp(-0.4, 1, (u - anticip) / (peakAt - anticip));
  if (u < peakAt + 0.2) return 1;
  return lerp(1, 0, (u - peakAt - 0.2) / Math.max(0.05, 1 - peakAt - 0.2));
}

interface Pose2D {
  bob: number;        // 身體升降（m）
  rot: number;        // 整體旋轉（翻滾/倒地）
  lean: number;       // 上身前傾（rad，+ = 朝面向方向）
  fistF: { x: number; y: number };  // 前手拳（相對肩，+x = 面向）
  fistB: { x: number; y: number };
  footF: number;      // 腳前後位移
  footB: number;
  crouch: number;     // 0-1 蹲縮
  mouth: 'flat' | 'grit' | 'o';
}

const GUARD_F = { x: 0.34, y: 0.1 };
const GUARD_B = { x: 0.22, y: 0.04 };

export class CharacterVisual implements ICharacterVisual {
  readonly root = { position: new Vec3(), rotation: { y: 0 }, scale: new Vec3(1, 1, 1) };
  disposed = false;

  private state: VisualState = 'idle';
  private stateTime = 0;
  private flip = 1;            // 1 = 面向右
  private tintColor: string | null = null;
  private tintUntil = 0;
  private now = 0;
  private rageGlow = false;
  private lastStrideSign = 1;
  private shadowPos = new Vec3();

  constructor(private opts: CharacterVisualOptions) {}

  setState(s: VisualState): void {
    if (this.state === s) return;
    this.state = s;
    this.stateTime = 0;
  }

  getState(): VisualState {
    return this.state;
  }

  update(dt: number): void {
    this.stateTime += dt;
    this.now += dt;
    // 面向：取 rotation.y 的 x 分量；接近 0（純縱向移動）時保持原 flip
    const sx = Math.sin(this.root.rotation.y);
    if (Math.abs(sx) > 0.25) this.flip = sx > 0 ? 1 : -1;
    // 腳步聲：步伐換腳時回呼
    if (this.state === 'walk' || this.state === 'run') {
      const freq = this.state === 'run' ? 11 : 7;
      const sign = Math.sin(this.stateTime * freq) >= 0 ? 1 : -1;
      if (sign !== this.lastStrideSign) {
        this.lastStrideSign = sign;
        this.opts.onFootstep?.();
      }
    }
  }

  flashTint(color: number, durationMs = 90): void {
    this.tintColor = hex(color);
    this.tintUntil = this.now + durationMs / 1000;
  }

  setRageGlow(on: boolean): void {
    this.rageGlow = on;
  }

  dispose(): void {
    this.disposed = true;
  }

  // ───────────────────────── 繪製 ─────────────────────────

  draw(ctx: CanvasRenderingContext2D, cam: GameCamera): void {
    if (this.disposed) return;
    const p = this.root.position;
    const s = cam.worldToScreen(p);
    const k = cam.ppm * s.scale * (this.opts.scale ?? 1) * this.root.scale.x;
    if (k <= 0.5) return;

    // 地面陰影（永遠貼地，不受高度/翻滾影響）
    const groundY = cam.worldToScreen(this.shadowPos.set(p.x, 0, p.z)).y;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(s.x, groundY, k * 0.52, k * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 怒氣光環
    if (this.rageGlow) {
      const g = ctx.createRadialGradient(s.x, groundY - k * 0.9, k * 0.1, s.x, groundY - k * 0.9, k * 1.4);
      g.addColorStop(0, 'rgba(255,107,53,0.45)');
      g.addColorStop(1, 'rgba(255,107,53,0)');
      ctx.fillStyle = g;
      ctx.fillRect(s.x - k * 1.5, groundY - k * 2.4, k * 3, k * 2.8);
    }

    // AI sprite 模式（素材到位自動啟用）
    if (this.opts.spriteId) {
      const hit = getClip(this.opts.spriteId, this.spriteState());
      if (hit) {
        this.drawSprite(ctx, hit.clip, hit.heightM, s.x, groundY, k);
        this.drawTintFlash(ctx, s.x, groundY, k);
        return;
      }
    }

    this.drawProcedural(ctx, s.x, groundY - (p.y > 0 ? p.y * cam.ppm * s.scale : 0), k);
  }

  private spriteState(): string {
    // sprite sheet 動作數可少於 VisualState：語意映射
    const map: Partial<Record<VisualState, string>> = {
      punch2: 'punch1', punch3: 'heavy', rage: 'heavy', throw: 'punch1', block: 'idle', walk: 'run',
    };
    return map[this.state] ?? this.state;
  }

  private drawSprite(ctx: CanvasRenderingContext2D, clip: SpriteClip, heightM: number, sx: number, groundY: number, k: number): void {
    const idx = clip.loop
      ? Math.floor(this.stateTime * clip.fps) % clip.frames
      : Math.min(clip.frames - 1, Math.floor(this.stateTime * clip.fps));
    const cols = Math.max(1, Math.round(clip.image.width / clip.frameW));
    const fx = (idx % cols) * clip.frameW;
    const fy = Math.floor(idx / cols) * clip.frameH;
    const drawH = heightM * k;
    const drawW = drawH * (clip.frameW / clip.frameH);
    ctx.save();
    ctx.translate(sx, groundY);
    ctx.scale(this.flip, 1);
    ctx.drawImage(clip.image, fx, fy, clip.frameW, clip.frameH, -drawW * clip.anchorX, -drawH * clip.anchorY, drawW, drawH);
    ctx.restore();
  }

  private drawTintFlash(ctx: CanvasRenderingContext2D, sx: number, groundY: number, k: number): void {
    if (this.tintColor && this.now < this.tintUntil) {
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = this.tintColor;
      ctx.beginPath();
      ctx.ellipse(sx, groundY - k * 0.95, k * 0.7, k * 1.0, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ───────── 程式化向量人（Dad'n Me 比例：大頭大拳小短身） ─────────

  private pose(): Pose2D {
    const t = this.stateTime;
    const P: Pose2D = {
      bob: Math.sin(t * 2.4) * 0.02, rot: 0, lean: 0,
      fistF: { ...GUARD_F }, fistB: { ...GUARD_B },
      footF: 0.14, footB: -0.14, crouch: 0, mouth: 'flat',
    };
    switch (this.state) {
      case 'idle':
        break;
      case 'walk':
      case 'run': {
        const freq = this.state === 'run' ? 11 : 7;
        const amp = this.state === 'run' ? 0.3 : 0.18;
        const st = Math.sin(t * freq) * amp;
        P.footF = st; P.footB = -st;
        P.fistF = { x: 0.26 - st * 0.4, y: 0.05 };
        P.fistB = { x: 0.12 + st * 0.4, y: 0.02 };
        P.bob = Math.abs(Math.cos(t * freq)) * (this.state === 'run' ? 0.07 : 0.04);
        P.lean = this.state === 'run' ? 0.18 : 0.06;
        break;
      }
      case 'punch1':
      case 'punch2': {
        const u = Math.min(1, t / 0.28);
        const e = strike(u, 0.18, 0.45);
        const reach = 0.32 + Math.max(0, e) * 0.55 + Math.min(0, e) * 0.3;
        const f = { x: reach, y: 0.12 };
        if (this.state === 'punch1') { P.fistF = f; } else { P.fistB = f; }
        P.lean = Math.max(0, e) * 0.3;
        P.mouth = 'grit';
        break;
      }
      case 'punch3': { // 連擊收尾：上勾拳
        const u = Math.min(1, t / 0.34);
        const e = strike(u, 0.22, 0.5);
        P.fistF = { x: 0.3 + Math.max(0, e) * 0.4, y: -0.1 + Math.max(0, e) * 0.55 };
        P.crouch = Math.max(0, -Math.sin(u * Math.PI * 2)) * 0.25;
        P.lean = Math.max(0, e) * 0.22;
        P.bob = Math.max(0, e) * 0.1;
        P.mouth = 'grit';
        break;
      }
      case 'heavy': {
        const u = Math.min(1, t / 0.42);
        const e = strike(u, 0.45, 0.66); // 大後搖，峰值對齊 HEAVY_HIT_AT
        P.fistF = { x: 0.25 + Math.max(0, e) * 0.75 + Math.min(0, e) * 0.45, y: 0.1 };
        P.lean = e * 0.42;
        P.crouch = u < 0.45 ? u * 0.5 : Math.max(0, 0.25 - (u - 0.45));
        P.mouth = 'grit';
        break;
      }
      case 'dodge': {
        const u = Math.min(1, t / 0.42);
        P.rot = -u * Math.PI * 2;
        P.crouch = 0.4;
        P.fistF = { x: 0.15, y: 0.1 }; P.fistB = { x: -0.15, y: 0.1 };
        break;
      }
      case 'hit':
        P.lean = -0.35;
        P.fistF = { x: 0.05, y: -0.2 }; P.fistB = { x: -0.12, y: -0.18 };
        P.mouth = 'o';
        break;
      case 'down':
        P.rot = Math.PI / 2;
        P.bob = -0.4;
        P.fistF = { x: 0.2, y: 0.15 }; P.fistB = { x: -0.2, y: 0.1 };
        P.mouth = 'o';
        break;
      case 'block':
        P.fistF = { x: 0.22, y: 0.42 }; P.fistB = { x: 0.3, y: 0.32 };
        P.crouch = 0.12;
        break;
      case 'throw': {
        const u = Math.min(1, t / 0.7);
        const arc = Math.sin(Math.min(1, u * 1.4) * Math.PI);
        P.fistF = { x: lerp(-0.3, 0.55, u), y: 0.3 + arc * 0.45 };
        P.lean = lerp(-0.2, 0.3, u);
        break;
      }
      case 'rage':
        P.fistF = { x: 0.3, y: 0.55 + Math.sin(t * 18) * 0.04 };
        P.fistB = { x: -0.3, y: 0.55 + Math.cos(t * 18) * 0.04 };
        P.lean = -0.1;
        P.bob = 0.06;
        P.mouth = 'grit';
        break;
    }
    return P;
  }

  private drawProcedural(ctx: CanvasRenderingContext2D, sx: number, baseY: number, k: number): void {
    const o = this.opts;
    const tinted = !!this.tintColor && this.now < this.tintUntil;
    const col = (c: string) => (tinted ? this.tintColor! : c);
    const suit = col(hex(o.suitColor));
    const skin = col(hex(o.skinColor ?? 0xf0c8a0));
    const shirt = col(hex(o.shirtColor ?? 0xeeeeee));
    const P = this.pose();

    ctx.save();
    ctx.translate(sx, baseY);
    // 改為公尺座標、y 朝上、依面向翻轉
    ctx.scale(this.flip * k, -k);
    ctx.translate(0, P.bob);
    if (P.rot !== 0) {
      ctx.translate(0, 0.55);
      ctx.rotate(P.rot);
      ctx.translate(0, -0.55);
    }
    ctx.lineWidth = LINE_W;
    ctx.strokeStyle = OUTLINE;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const crouchK = 1 - P.crouch * 0.3;
    const hipY = 0.6 * crouchK;
    const shoulderY = 1.06 * crouchK;
    const headR = 0.4;

    // 曲線肢體：帶微彎（手肘/膝蓋的有機感），雙層描邊
    const limb = (x1: number, y1: number, x2: number, y2: number, w: number, c: string, bend = 0.1) => {
      const mx = (x1 + x2) / 2 - (y2 - y1) * bend;
      const my = (y1 + y2) / 2 + (x2 - x1) * bend;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(mx, my, x2, y2);
      ctx.lineWidth = w + LINE_W * 2;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
      ctx.lineWidth = w;
      ctx.strokeStyle = c;
      ctx.stroke();
      ctx.lineWidth = LINE_W;
      ctx.strokeStyle = OUTLINE;
    };
    const fist = (x: number, y: number, r: number) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = skin;
      ctx.fill();
      ctx.stroke();
      // 拳面 cel 陰影（下半月牙）
      if (!tinted) {
        ctx.save();
        ctx.clip();
        ctx.fillStyle = 'rgba(60,30,20,0.22)';
        ctx.beginPath();
        ctx.ellipse(x, y - r * 0.45, r * 1.05, r * 0.72, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    };

    // 後手臂 + 拳（最底層）
    const shX = 0.08, bSh = -0.12;
    limb(bSh, shoulderY, bSh + P.fistB.x, shoulderY + P.fistB.y, 0.13, suit);
    fist(bSh + P.fistB.x, shoulderY + P.fistB.y, 0.15);

    // 雙腿（短腿）+ 大鞋
    const suitDark = col(hex(Math.max(0, o.suitColor - 0x0a0a0a)));
    limb(-0.06, hipY, P.footB, 0.06, 0.15, suitDark);
    limb(0.08, hipY, P.footF, 0.06, 0.15, suit);
    for (const fx of [P.footB, P.footF]) {
      ctx.beginPath();
      ctx.ellipse(fx + 0.07, 0.05, 0.14, 0.07, 0, 0, Math.PI * 2);
      ctx.fillStyle = col('#221d18');
      ctx.fill();
      ctx.stroke();
    }

    // 軀幹（小梯形西裝）+ 前傾
    ctx.save();
    ctx.translate(0, hipY);
    ctx.rotate(P.lean);
    const tH = shoulderY - hipY + 0.16;
    ctx.beginPath();
    ctx.moveTo(-0.24, 0);
    ctx.lineTo(0.24, 0);
    ctx.lineTo(0.3, tH);
    ctx.lineTo(-0.3, tH);
    ctx.closePath();
    ctx.fillStyle = suit;
    ctx.fill();
    // 西裝背側 cel 陰影（後緣縱帶）
    if (!tinted) {
      ctx.save();
      ctx.clip();
      ctx.fillStyle = 'rgba(8,6,14,0.3)';
      ctx.fillRect(-0.34, -0.05, 0.17, tH + 0.1);
      ctx.restore();
    }
    ctx.stroke();
    // 襯衫 V 領 + 領帶（隨動作微飄）
    ctx.beginPath();
    ctx.moveTo(-0.09, tH);
    ctx.lineTo(0.09, tH);
    ctx.lineTo(0, tH - 0.22);
    ctx.closePath();
    ctx.fillStyle = shirt;
    ctx.fill();
    ctx.stroke();
    if (o.tieColor !== undefined) {
      const flap = Math.sin(this.now * 9) * 0.02 + P.lean * 0.07;
      ctx.beginPath();
      ctx.moveTo(-0.035, tH - 0.02);
      ctx.lineTo(0.035, tH - 0.02);
      ctx.quadraticCurveTo(0.05 + flap, tH - 0.18, 0.05 + flap * 2, tH - 0.3);
      ctx.lineTo(flap * 2, tH - 0.38);
      ctx.quadraticCurveTo(-0.05 + flap, tH - 0.22, -0.035, tH - 0.02);
      ctx.closePath();
      ctx.fillStyle = col(hex(o.tieColor));
      ctx.fill();
      ctx.stroke();
    }

    // 大頭（約佔全身一半，Dad'n Me 招牌比例）
    ctx.translate(0, tH - 0.02);
    ctx.rotate(P.lean * 0.4);
    const hY = headR * 0.78;
    ctx.beginPath();
    ctx.ellipse(0.02, hY, headR * 0.92, headR, 0, 0, Math.PI * 2);
    ctx.fillStyle = skin;
    ctx.fill();
    // 臉部 cel 陰影（後下緣月牙）
    if (!tinted) {
      ctx.save();
      ctx.clip();
      ctx.fillStyle = 'rgba(70,35,25,0.18)';
      ctx.beginPath();
      ctx.ellipse(-headR * 0.32, hY - headR * 0.3, headR * 0.85, headR * 0.8, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.stroke();
    // 油頭髮型（上半覆蓋）
    ctx.beginPath();
    ctx.ellipse(0, hY + headR * 0.42, headR * 0.88, headR * 0.5, 0.12, 0, Math.PI);
    ctx.fillStyle = col('#1c1c22');
    ctx.fill();
    ctx.stroke();
    if (!tinted) {
      if (o.sunglasses) {
        ctx.beginPath();
        ctx.rect(headR * 0.02, hY - headR * 0.18, headR * 0.82, headR * 0.32);
        ctx.fillStyle = '#101014';
        ctx.fill();
        ctx.stroke();
      } else {
        // 怒目 + 眉
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(headR * 0.32, hY - headR * 0.04, 0.085, 0.1, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(headR * 0.66, hY - headR * 0.04, 0.075, 0.09, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = OUTLINE;
        ctx.beginPath();
        ctx.arc(headR * 0.36, hY - headR * 0.06, 0.035, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(headR * 0.68, hY - headR * 0.06, 0.032, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(headR * 0.16, hY + headR * 0.2);
        ctx.lineTo(headR * 0.48, hY + headR * 0.1);
        ctx.moveTo(headR * 0.56, hY + headR * 0.1);
        ctx.lineTo(headR * 0.84, hY + headR * 0.18);
        ctx.stroke();
      }
      // 嘴（位於頭下半）
      ctx.beginPath();
      if (P.mouth === 'o') {
        ctx.ellipse(headR * 0.45, hY - headR * 0.5, 0.05, 0.07, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#5a2a22';
        ctx.fill();
        ctx.stroke();
      } else if (P.mouth === 'grit') {
        ctx.rect(headR * 0.18, hY - headR * 0.56, headR * 0.5, 0.08);
        ctx.fillStyle = '#f2ece4';
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.moveTo(headR * 0.22, hY - headR * 0.5);
        ctx.lineTo(headR * 0.6, hY - headR * 0.54);
        ctx.stroke();
      }
    }
    ctx.restore();

    // 前手臂 + 大拳頭（最上層，風格重點）
    limb(shX, shoulderY, shX + P.fistF.x, shoulderY + P.fistF.y, 0.14, suit);
    fist(shX + P.fistF.x, shoulderY + P.fistF.y, 0.18);

    ctx.restore();
  }
}

export function createCharacterVisual(opts: CharacterVisualOptions): ICharacterVisual {
  return new CharacterVisual(opts);
}
