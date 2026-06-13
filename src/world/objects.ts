// 互動場景物件：可投擲爆炸物（瓦斯桶）、攻擊力足球、可乘坐除草機、掩體（木箱/拒馬）。
// 物件圖支援 /assets/props/<kind>.png 熱插拔（AI 圖到位自動替換）；缺圖用厚描邊扁平繪製暫代。
import { Vec3 } from '../core/vec';
import { DEPTH, type GameCamera } from '../core/camera';
import type { Hittable, HitQuery } from '../combat/damage';
import { bus } from '../core/events';
import { playSound } from '../core/audio';
import type { PropKind } from '../types';

const INK = '#181410';
const GRAV = 22;

interface PropImage { img: HTMLImageElement | HTMLCanvasElement; ready: boolean; w: number; h: number; }
const propImgs = new Map<PropKind, PropImage>();

/** 綠幕去背：AI 圖以純綠 (#00ff00) 背景生成，載入後把綠色像素轉透明 */
function chromaKey(img: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  try {
    const d = ctx.getImageData(0, 0, c.width, c.height);
    const a = d.data;
    for (let i = 0; i < a.length; i += 4) {
      const r = a[i], g = a[i + 1], b = a[i + 2];
      if (g > 130 && r < 140 && b < 140 && g - r > 40 && g - b > 40) a[i + 3] = 0;
    }
    ctx.putImageData(d, 0, 0);
  } catch { /* 跨域時無法讀像素，直接用原圖 */ }
  return c;
}

function loadPropImg(kind: PropKind): PropImage {
  let p = propImgs.get(kind);
  if (!p) {
    const img = new Image();
    const slot: PropImage = { img, ready: false, w: 1, h: 1 };
    img.onload = () => { slot.img = chromaKey(img); slot.w = img.width; slot.h = img.height; slot.ready = true; };
    img.onerror = () => { slot.ready = false; };
    img.src = `/assets/props/${kind}.png`;
    propImgs.set(kind, slot);
    p = slot;
  }
  return p;
}

type ObjState = 'rest' | 'held' | 'air' | 'roll' | 'ridden' | 'spent';

interface Obj {
  kind: PropKind;
  pos: Vec3;
  vel: Vec3;
  state: ObjState;
  hp: number;          // 掩體耐久
  spin: number;
  radius: number;      // 世界半徑（碰撞/繪製）
  life: number;        // ridden/effect 計時
  hitSet: Set<Hittable>; // 滾動/爆炸已命中（避免重複）
  solid: boolean;      // 阻擋移動與遠程
}

interface Blast { pos: Vec3; t: number; max: number; }

const CARRIABLE: PropKind[] = ['explosive', 'football', 'mower'];

export class ObjectManager {
  private objs: Obj[] = [];
  private blasts: Blast[] = [];
  held: Obj | null = null;
  riding: Obj | null = null;

  constructor(private enemies: HitQuery) {}

  reset(): void { this.objs = []; this.blasts = []; this.held = null; this.riding = null; }

  spawn(kind: PropKind, pos: Vec3): void {
    const SOLID = new Set(['crate', 'barrier', 'tire', 'cone', 'trashcan', 'hydrant']);
    const HP: Record<string, number> = { barrier: 9999, hydrant: 9999, tire: 9999, crate: 30, trashcan: 16, cone: 8 };
    const RAD: Record<string, number> = { football: 0.44, mower: 0.7, barrier: 1.1, tire: 0.62, cone: 0.32, trashcan: 0.42, hydrant: 0.3 };
    this.objs.push({
      kind, pos: pos.clone(), vel: new Vec3(), state: 'rest',
      hp: HP[kind] ?? 1,
      spin: 0, radius: RAD[kind] ?? 0.55,
      life: 0, hitSet: new Set(), solid: SOLID.has(kind),
    });
  }

  get all(): readonly Obj[] { return this.objs; }

  // ───────── PropController（player 呼叫）─────────

  hasHeld(): boolean { return !!this.held; }
  isRiding(): boolean { return !!this.riding; }

  /** 撿起最近的可攜物件（爆炸物/足球→手持；除草機→乘坐） */
  tryPickup(pos: Vec3, _facing: number): boolean {
    if (this.held || this.riding) return false;
    let best: Obj | null = null, bestD = 1.5;
    for (const o of this.objs) {
      if (o.state !== 'rest' || !CARRIABLE.includes(o.kind)) continue;
      const d = Math.hypot(o.pos.x - pos.x, (o.pos.z - pos.z) * 1.4);
      if (d < bestD) { bestD = d; best = o; }
    }
    if (!best) return false;
    if (best.kind === 'mower') {
      best.state = 'ridden'; best.life = 6; this.riding = best;
      playSound('upgrade');
    } else {
      best.state = 'held'; this.held = best;
      playSound('uiClick');
    }
    return true;
  }

  /** 每幀把手持物件貼在玩家上方/乘坐物件移到玩家前方 */
  followCarrier(pos: Vec3, facing: number, dt: number): void {
    const dir = Math.sin(facing) >= 0 ? 1 : -1;
    if (this.held) {
      // 物件貼在玩家胸前手部位置（依面向略微前移）；y=1.25 = 胸口高度
      this.held.pos.set(pos.x + dir * 0.18, 1.25, pos.z);
      this.held.spin += dt * 4;
    }
    if (this.riding) {
      this.riding.pos.set(pos.x + dir * 0.55, 0, pos.z);
      this.riding.spin += dt * 30;
      this.riding.life -= dt;
      // 輾過前方敵人
      for (const t of this.enemies.queryRadius(this.riding.pos, 1.0)) {
        if (this.riding.hitSet.has(t)) continue;
        this.riding.hitSet.add(t);
        t.takeHit(14, { fromPos: pos.clone(), knockback: 1.4, knockdown: true, breaksBlock: true });
        setTimeout(() => this.riding?.hitSet.delete(t), 400);
      }
      if (this.riding.life <= 0) { this.riding.state = 'spent'; this.riding = null; }
    }
  }

  /** 丟出/踢出手持物件 */
  throwHeld(pos: Vec3, facing: number): boolean {
    const o = this.held;
    if (!o) return false;
    this.held = null;
    const dir = Math.sin(facing) >= 0 ? 1 : -1;
    o.hitSet.clear();
    if (o.kind === 'football') {
      o.state = 'roll';
      o.pos.set(pos.x + dir * 0.5, 0, pos.z);
      o.vel.set(dir * 15, 0, 0);
      playSound('punchHit');
    } else { // explosive
      o.state = 'air';
      o.pos.set(pos.x + dir * 0.4, 1.4, pos.z);
      o.vel.set(dir * 8, 6, 0);
      playSound('punchSwing');
    }
    return true;
  }

  /** 移動者（玩家/敵人）被掩體推開 */
  resolveCover(pos: Vec3, radius: number): void {
    for (const o of this.objs) {
      if (!o.solid || o.state === 'spent') continue;
      const dx = pos.x - o.pos.x;
      const dz = (pos.z - o.pos.z);
      const min = o.radius + radius;
      const d = Math.hypot(dx, dz * 1.3);
      if (d < min && d > 0.0001) {
        const push = (min - d);
        pos.x += (dx / d) * push;
        pos.z += (dz / d) * push * 0.6;
      }
    }
  }

  /** 遠程投擲物是否被掩體擋下 */
  blocksProjectile(p: Vec3): boolean {
    for (const o of this.objs) {
      if (!o.solid || o.state === 'spent') continue;
      if (Math.hypot(o.pos.x - p.x, (o.pos.z - p.z) * 1.3) < o.radius + 0.2 && p.y < 1.8) {
        o.hp -= 6;
        if (o.hp <= 0) o.state = 'spent';
        return true;
      }
    }
    return false;
  }

  // ───────── 每幀更新 ─────────

  update(dt: number): void {
    for (const o of this.objs) {
      if (o.state === 'air') {
        o.vel.y -= GRAV * dt;
        o.pos.x += o.vel.x * dt;
        o.pos.y += o.vel.y * dt;
        o.spin += dt * 10;
        // 撞到掩體 → 爆
        if (this.solidHit(o)) { this.explode(o); continue; }
        // 命中敵人（身高範圍）
        const near = this.enemies.queryRadius(new Vec3(o.pos.x, 0, o.pos.z), 0.9);
        if (o.pos.y < 1.6 && near.length) { this.explode(o); continue; }
        if (o.pos.y <= 0) { o.pos.y = 0; this.explode(o); }
      } else if (o.state === 'roll') {
        o.pos.x += o.vel.x * dt;
        o.spin += o.vel.x * dt * 2;
        o.vel.x *= (1 - dt * 1.2); // 摩擦
        // 撞掩體反彈
        if (this.solidHit(o)) { o.vel.x = -o.vel.x * 0.6; o.pos.x += o.vel.x * dt * 2; }
        // 撞敵人造成傷害
        for (const t of this.enemies.queryRadius(o.pos, o.radius + 0.5)) {
          if (o.hitSet.has(t)) continue;
          o.hitSet.add(t);
          t.takeHit(18, { fromPos: o.pos.clone(), knockback: 1.2, knockdown: true, breaksBlock: true, isCrit: true });
          bus.emit('fx:shake', { strength: 0.18 });
        }
        if (Math.abs(o.vel.x) < 1.2) { o.state = 'rest'; o.hitSet.clear(); }
      }
    }
    this.objs = this.objs.filter((o) => o.state !== 'spent');
    for (const b of this.blasts) b.t += dt;
    this.blasts = this.blasts.filter((b) => b.t < b.max);
  }

  private solidHit(o: Obj): boolean {
    for (const s of this.objs) {
      if (!s.solid || s === o || s.state === 'spent') continue;
      if (Math.hypot(s.pos.x - o.pos.x, (s.pos.z - o.pos.z) * 1.3) < s.radius + o.radius) {
        s.hp -= 12;
        if (s.hp <= 0) { s.state = 'spent'; this.blast(s.pos); }
        return true;
      }
    }
    return false;
  }

  private explode(o: Obj): void {
    o.state = 'spent';
    this.blast(o.pos);
    playSound('heavyHit');
    bus.emit('fx:shake', { strength: 0.5 });
    for (const t of this.enemies.queryRadius(new Vec3(o.pos.x, 0, o.pos.z), 2.7)) {
      t.takeHit(45, { fromPos: o.pos.clone(), knockback: 3.2, knockdown: true, breaksBlock: true, isCrit: true });
    }
    // 連鎖引爆附近掩體/爆炸物
    for (const s of this.objs) {
      if (s === o || s.state === 'spent') continue;
      if (Math.hypot(s.pos.x - o.pos.x, (s.pos.z - o.pos.z) * 1.3) < 2.4) {
        if (s.kind === 'explosive' && s.state === 'rest') { s.state = 'air'; s.vel.set(0, 0.1, 0); }
        else if (s.solid) { s.hp -= 40; if (s.hp <= 0) s.state = 'spent'; }
      }
    }
  }

  private blast(pos: Vec3): void { this.blasts.push({ pos: pos.clone(), t: 0, max: 0.35 }); }

  // ───────── 繪製 ─────────

  draw(ctx: CanvasRenderingContext2D, cam: GameCamera): void {
    // 物件依 depth 與實體層一起由 level 排序較理想，但此處單獨畫地面物件（held 在上層另畫）
    const sorted = [...this.objs].filter((o) => o.state !== 'held').sort((a, b) => a.pos.z - b.pos.z);
    for (const o of sorted) this.drawObj(ctx, cam, o);
    // 爆炸環
    for (const b of this.blasts) this.drawBlast(ctx, cam, b);
  }

  /** 手持物件最後畫（疊在玩家前） */
  drawHeld(ctx: CanvasRenderingContext2D, cam: GameCamera): void {
    if (this.held) this.drawObj(ctx, cam, this.held);
  }

  private drawObj(ctx: CanvasRenderingContext2D, cam: GameCamera, o: Obj): void {
    const s = cam.worldToScreen(o.pos);
    const k = cam.ppm * s.scale;
    // 影子
    if (o.state !== 'held') {
      const g = cam.worldToScreen(new Vec3(o.pos.x, 0, o.pos.z));
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.ellipse(g.x, g.y, o.radius * k * 1.1, o.radius * k * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const img = loadPropImg(o.kind);
    if (img.ready) {
      // 手持物件用較大倍率以遮住手部與石頭；地面物件用底部 anchor（站地）
      const held = o.state === 'held';
      const sizeMul = held ? 1.6 : 2.6;       // 1.6 = 約 1.4m 高，足以覆蓋手部
      const h = o.radius * sizeMul * k;
      const w = h * (img.w / img.h);
      const anchorY = held ? 0.5 : 0.86;      // 0.5 = 中心；0.86 = 接近底部（站地用）
      ctx.save();
      ctx.translate(s.x, s.y);
      if (o.kind === 'football') ctx.rotate(o.spin);
      ctx.drawImage(img.img, -w / 2, -h * anchorY, w, h);
      ctx.restore();
      return;
    }
    this.drawProcedural(ctx, s.x, s.y, k, o);
  }

  private drawProcedural(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, o: Obj): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.lineWidth = Math.max(2, k * 0.05);
    ctx.strokeStyle = INK;
    ctx.lineJoin = 'round';
    const r = o.radius * k;
    switch (o.kind) {
      case 'football': {
        ctx.rotate(o.spin);
        ctx.beginPath(); ctx.arc(0, -r, r, 0, Math.PI * 2);
        ctx.fillStyle = '#f4f4f4'; ctx.fill(); ctx.stroke();
        ctx.fillStyle = INK;
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * r * 0.4, -r + Math.sin(a) * r * 0.4);
          for (let j = 0; j < 5; j++) { const a2 = a + (j / 5) * 1.25; ctx.lineTo(Math.cos(a2) * r * 0.34, -r + Math.sin(a2) * r * 0.34); }
          ctx.closePath(); ctx.fill();
        }
        break;
      }
      case 'explosive': { // 紅瓦斯桶
        ctx.fillStyle = '#c0392b';
        ctx.beginPath(); ctx.roundRect(-r * 0.6, -r * 1.7, r * 1.2, r * 1.7, r * 0.25); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#7f7f7f';
        ctx.fillRect(-r * 0.28, -r * 2.0, r * 0.56, r * 0.32); ctx.strokeRect(-r * 0.28, -r * 2.0, r * 0.56, r * 0.32);
        ctx.fillStyle = '#ffd23f';
        ctx.font = `900 ${r * 0.7}px sans-serif`; ctx.textAlign = 'center';
        ctx.fillText('!', 0, -r * 0.7);
        break;
      }
      case 'mower': { // 除草機
        ctx.fillStyle = '#e0431f';
        ctx.beginPath(); ctx.roundRect(-r, -r * 1.1, r * 1.8, r * 0.9, r * 0.2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#2a2a2a';
        ctx.beginPath(); ctx.arc(-r * 0.5, -r * 0.2, r * 0.4, 0, Math.PI * 2); ctx.arc(r * 0.6, -r * 0.2, r * 0.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(r * 0.7, -r * 1.0); ctx.lineTo(r * 1.5, -r * 2.0); ctx.stroke();
        // 旋轉刀片
        ctx.save(); ctx.translate(-r * 0.1, -r * 0.1); ctx.rotate(o.spin);
        ctx.strokeStyle = '#cfd4da'; ctx.lineWidth = k * 0.06;
        for (let i = 0; i < 3; i++) { ctx.rotate(Math.PI * 2 / 3); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * 0.7, 0); ctx.stroke(); }
        ctx.restore();
        break;
      }
      case 'crate': { // 木箱
        ctx.fillStyle = '#b07a3c';
        ctx.beginPath(); ctx.rect(-r, -r * 2, r * 2, r * 2); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#7a5226';
        ctx.beginPath(); ctx.moveTo(-r, -r * 2); ctx.lineTo(r, 0); ctx.moveTo(r, -r * 2); ctx.lineTo(-r, 0); ctx.stroke();
        break;
      }
      case 'tire': { // 輪胎堆（低掩體）
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = i % 2 ? '#1c1c1c' : '#262626';
          ctx.beginPath(); ctx.ellipse(0, -r * (0.5 + i * 0.7), r, r * 0.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#3a3a3a';
          ctx.beginPath(); ctx.ellipse(0, -r * (0.5 + i * 0.7), r * 0.45, r * 0.22, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
        break;
      }
      case 'cone': { // 三角錐
        ctx.fillStyle = '#f06a1e';
        ctx.beginPath(); ctx.moveTo(0, -r * 2.0); ctx.lineTo(r * 0.7, 0); ctx.lineTo(-r * 0.7, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#f5f0e8';
        ctx.beginPath(); ctx.moveTo(-r * 0.36, -r * 1.05); ctx.lineTo(r * 0.36, -r * 1.05); ctx.lineTo(r * 0.46, -r * 0.78); ctx.lineTo(-r * 0.46, -r * 0.78); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#f06a1e'; ctx.fillRect(-r, -r * 0.14, r * 2, r * 0.18); ctx.strokeRect(-r, -r * 0.14, r * 2, r * 0.18);
        break;
      }
      case 'trashcan': { // 鐵皮垃圾桶
        ctx.fillStyle = '#5a5f66';
        ctx.beginPath(); ctx.moveTo(-r * 0.8, -r * 2.1); ctx.lineTo(r * 0.8, -r * 2.1); ctx.lineTo(r * 0.66, 0); ctx.lineTo(-r * 0.66, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#6a6f76';
        ctx.beginPath(); ctx.ellipse(0, -r * 2.15, r * 0.86, r * 0.26, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = Math.max(1.2, r * 0.04 * 20 * 0.06);
        for (const yy of [-1.5, -0.9]) { ctx.beginPath(); ctx.moveTo(-r * 0.74, r * yy); ctx.lineTo(r * 0.74, r * yy); ctx.stroke(); }
        break;
      }
      case 'hydrant': { // 紅色消防栓
        ctx.fillStyle = '#cc3a2e';
        ctx.beginPath(); ctx.roundRect(-r * 0.7, -r * 2.0, r * 1.4, r * 2.0, r * 0.3); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, -r * 2.1, r * 0.7, Math.PI, 0); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#a32a20';
        ctx.beginPath(); ctx.arc(-r, -r * 1.2, r * 0.42, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(r, -r * 1.2, r * 0.42, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        break;
      }
      case 'barrier': { // 黃黑施工拒馬
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(-r, -r * 0.5, r * 2, r * 0.5); ctx.strokeRect(-r, -r * 0.5, r * 2, r * 0.5);
        ctx.fillStyle = '#f0b000';
        ctx.beginPath(); ctx.rect(-r, -r * 1.7, r * 2, r * 0.6); ctx.fill();
        ctx.save(); ctx.clip();
        ctx.fillStyle = '#1c1c1c';
        for (let i = -2; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-r + i * r * 0.7, -r * 1.7); ctx.lineTo(-r + i * r * 0.7 + r * 0.35, -r * 1.7); ctx.lineTo(-r + i * r * 0.7 - r * 0.05, -r * 1.1); ctx.lineTo(-r + i * r * 0.7 - r * 0.4, -r * 1.1); ctx.closePath(); ctx.fill(); }
        ctx.restore();
        ctx.strokeRect(-r, -r * 1.7, r * 2, r * 0.6);
        ctx.beginPath(); ctx.moveTo(-r * 0.7, -r * 0.5); ctx.lineTo(-r * 0.7, 0); ctx.moveTo(r * 0.7, -r * 0.5); ctx.lineTo(r * 0.7, 0); ctx.stroke();
        break;
      }
    }
    ctx.restore();
  }

  private drawBlast(ctx: CanvasRenderingContext2D, cam: GameCamera, b: Blast): void {
    const s = cam.worldToScreen(new Vec3(b.pos.x, 0.6, b.pos.z));
    const k = cam.ppm * s.scale;
    const p = b.t / b.max;
    const r = (0.4 + p * 2.4) * k;
    ctx.save();
    ctx.globalAlpha = 1 - p;
    const g = ctx.createRadialGradient(s.x, s.y, r * 0.2, s.x, s.y, r);
    g.addColorStop(0, '#fff2b0');
    g.addColorStop(0.5, '#ff8a2a');
    g.addColorStop(1, 'rgba(200,40,20,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}
