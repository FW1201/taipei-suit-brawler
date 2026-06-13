// 2D 視差舞台 v2：Alien Hominid Invasion 手繪質感 × 真實台北建築。
// 技法：手繪抖線輪廓 / 雙色調 cel shading / 層間大氣霧 / 雜訊顆粒，去除「SVG 感」。
// 地標仿真：西門紅樓（八角紅磚樓）、士林夜市牌樓、龍山寺三川殿（燕尾脊）、
//          信義空橋（白色鋼拱玻璃廊）、台北 101（如意節斗型塔身、頂樓觀景台）。
import { Vec3 } from '../core/vec';
import { DEPTH, type GameCamera } from '../core/camera';
import { getBackdrop } from '../core/scene-art';

export type EnvTheme = 'neon' | 'nightmarket' | 'temple' | 'skybridge' | 'rooftop';

export interface Environment {
  length: number;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  protectTarget: Vec3 | null;
  update(dt: number, elapsed: number): void;
  drawBackground(ctx: CanvasRenderingContext2D, cam: GameCamera, w: number, h: number, elapsed: number): void;
  drawForeground(ctx: CanvasRenderingContext2D, cam: GameCamera, w: number, h: number, elapsed: number): void;
}

// ───────────────────────── 共用繪圖工具 ─────────────────────────

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shade(hexColor: string, amt: number): string {
  const n = parseInt(hexColor.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

const INK = '#181410';

/** 手繪抖動量：依座標決定（穩定不閃爍） */
function wob(x: number, y: number, amp: number): number {
  return Math.sin(x * 12.9898 + y * 78.233) * amp;
}

/** 手繪矩形：邊緣帶不規則抖動 + 底部陰影帶（cel shading）+ 墨線輪廓 */
function handRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, hh: number,
  fill: string,
  opts: { shadeH?: number; lineW?: number; noTop?: boolean } = {},
): void {
  const a = Math.min(4, Math.max(1.2, w * 0.012));
  ctx.beginPath();
  ctx.moveTo(x + wob(x, y, a), y + wob(y, x, a));
  ctx.lineTo(x + w + wob(x + w, y, a), y + wob(y, x + w, a));
  ctx.lineTo(x + w + wob(x + w, y + hh, a), y + hh + wob(y + hh, x + w, a));
  ctx.lineTo(x + wob(x, y + hh, a), y + hh + wob(y + hh, x, a));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  // 底部 cel 陰影帶
  const sh = opts.shadeH ?? hh * 0.22;
  if (sh > 2) {
    ctx.save();
    ctx.clip();
    ctx.fillStyle = 'rgba(8,6,12,0.28)';
    ctx.fillRect(x - 5, y + hh - sh, w + 10, sh + 5);
    ctx.restore();
  }
  ctx.lineWidth = opts.lineW ?? 2.5;
  ctx.strokeStyle = INK;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

/** 雜訊顆粒 tile（去 SVG 感的關鍵），module 級只生成一次 */
let noiseTile: HTMLCanvasElement | null = null;
function getNoise(): HTMLCanvasElement {
  if (noiseTile) return noiseTile;
  noiseTile = document.createElement('canvas');
  noiseTile.width = noiseTile.height = 160;
  const c = noiseTile.getContext('2d')!;
  const img = c.createImageData(160, 160);
  const r = mulberry32(99);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 110 + r() * 90;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  return noiseTile;
}

function grain(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const n = getNoise();
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.085;
  for (let y = 0; y < h; y += 160) {
    for (let x = 0; x < w; x += 160) ctx.drawImage(n, x, y);
  }
  ctx.restore();
}

/** 直式霓虹招牌（含燈管描邊與半衰閃爍） */
function neonVSign(ctx: CanvasRenderingContext2D, x: number, topY: number, m: number, text: string, color: string, t: number, vseed: number): void {
  const chars = [...text].slice(0, 4);
  const sw = m * 0.92;
  const sh = chars.length * m * 0.8 + m * 0.34;
  const flick = Math.sin(t * 6.5 + vseed * 40) > -0.92 ? 1 : 0.3;
  handRect(ctx, x - sw / 2, topY, sw, sh, '#16121f', { shadeH: 0, lineW: 2 });
  ctx.save();
  ctx.globalAlpha = flick;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(x - sw / 2 + 3, topY + 3, sw - 6, sh - 6);
  ctx.fillStyle = color;
  ctx.font = `900 ${m * 0.6}px 'Noto Sans TC', sans-serif`;
  ctx.textAlign = 'center';
  ctx.shadowColor = color;
  ctx.shadowBlur = 14 * flick;
  chars.forEach((ch, i) => ctx.fillText(ch, x, topY + m * (0.8 * (i + 1))));
  ctx.restore();
}

// ───────────────────────── 主題設定 ─────────────────────────

interface ThemeSpec {
  skyTop: string;
  skyBottom: string;
  farColor: string;
  haze: string;
  ground: string;
  signs: string[];
}

const THEMES: Record<EnvTheme, ThemeSpec> = {
  neon: {
    skyTop: '#0b0e20', skyBottom: '#272a52', farColor: '#171b34', haze: 'rgba(60,60,120,0.22)',
    ground: '#37393f',
    signs: ['電影街', 'KTV', '萬年', '藥妝', '刺青', '電玩', '滷味', '唱片'],
  },
  nightmarket: {
    skyTop: '#140d07', skyBottom: '#33200f', farColor: '#221710', haze: 'rgba(120,70,30,0.2)',
    ground: '#473a2c',
    signs: ['蚵仔煎', '大腸包小腸', '珍珠奶茶', '雞排', '臭豆腐', '藥燉排骨', '生煎包'],
  },
  temple: {
    skyTop: '#090b16', skyBottom: '#201a30', farColor: '#161224', haze: 'rgba(90,70,110,0.18)',
    ground: '#56504a',
    signs: ['平安', '光明', '祈福'],
  },
  skybridge: {
    skyTop: '#0a1322', skyBottom: '#1b2c48', farColor: '#131f38', haze: 'rgba(60,100,150,0.2)',
    ground: '#3c4048',
    signs: ['SALE', '新光', 'ATT', '威秀', '誠品'],
  },
  rooftop: {
    skyTop: '#04060e', skyBottom: '#101a30', farColor: '#0b1224', haze: 'rgba(40,60,100,0.15)',
    ground: '#2a2d33',
    signs: [],
  },
};

interface Prop {
  x: number;
  kind: string;
  variant: number;
  text?: string;
}

// ───────────────────────── 環境建造 ─────────────────────────

export function buildEnvironment(theme: EnvTheme, length: number): Environment {
  const spec = THEMES[theme];
  const rand = mulberry32(theme.length * 7919 + length);
  const props: Prop[] = [];

  const every = (gap: number, kind: string, withText = false) => {
    for (let x = 3 + rand() * gap; x < length - 3; x += gap * (0.75 + rand() * 0.5)) {
      props.push({ x, kind, variant: rand(), text: withText ? spec.signs[Math.floor(rand() * spec.signs.length)] : undefined });
    }
  };

  switch (theme) {
    case 'neon':
      every(6.2, 'shopfront', true);
      every(11, 'scooterRow');
      every(16, 'lamp');
      props.push({ x: length * 0.32, kind: 'redhouse', variant: 0.5 });
      props.push({ x: length * 0.78, kind: 'ledcorner', variant: 0.3 });
      break;
    case 'nightmarket':
      every(4.8, 'stall', true);
      every(9, 'scooterRow');
      props.push({ x: 7, kind: 'marketgate', variant: 0.5 });
      break;
    case 'temple':
      every(15, 'lantern');
      props.push({ x: length * 0.5, kind: 'templegate', variant: 0.5 });
      props.push({ x: length * 0.18, kind: 'stonelion', variant: 0.2 });
      props.push({ x: length * 0.82, kind: 'stonelion', variant: 0.8 });
      break;
    case 'skybridge':
      every(8, 'mallglass', true);
      every(12, 'lamp');
      break;
    case 'rooftop':
      every(14, 'vent');
      every(20, 'beacon');
      props.push({ x: length * 0.88, kind: 'spire', variant: 0.5 });
      break;
  }
  props.sort((a, b) => a.x - b.x);

  // ── 遠景剪影 tile ──
  const farTile = buildFarTile(theme, spec);

  const protectTarget = theme === 'temple' ? new Vec3(length * 0.5, 0, 1.2) : null;
  const star = mulberry32(7);
  const stars: [number, number, number][] = Array.from({ length: 110 }, () => [star() * 2200, star() * 320, 0.4 + star() * 1.5]);
  const cloudR = mulberry32(13);
  const clouds: [number, number, number][] = Array.from({ length: 6 }, () => [cloudR() * 2000, 40 + cloudR() * 180, 60 + cloudR() * 90]);
  const _gv = new Vec3();

  return {
    length,
    bounds: { minX: 0.6, maxX: length - 0.6, minZ: 0.4, maxZ: DEPTH - 0.2 },
    protectTarget,
    update() { /* 動畫以 elapsed 驅動 */ },

    drawBackground(ctx, cam, w, h, elapsed) {
      const gTop = cam.groundTopY;
      // 1) 天空
      const sky = ctx.createLinearGradient(0, 0, 0, gTop);
      sky.addColorStop(0, spec.skyTop);
      sky.addColorStop(1, spec.skyBottom);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, gTop + 2);

      if (theme === 'rooftop' || theme === 'temple') {
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        for (const [sx, sy, sr] of stars) {
          const px = ((sx + cam.parallaxOffset(0.04)) % (w + 120) + w + 120) % (w + 120) - 60;
          ctx.globalAlpha = 0.25 + 0.55 * Math.abs(Math.sin(elapsed * 0.7 + sx));
          ctx.fillRect(px, sy * (gTop / 330), sr, sr);
        }
        ctx.globalAlpha = 1;
        // 月亮（雙層光暈）
        const mg = ctx.createRadialGradient(w * 0.78, gTop * 0.2, 6, w * 0.78, gTop * 0.2, 70);
        mg.addColorStop(0, 'rgba(245,237,216,0.5)');
        mg.addColorStop(1, 'rgba(245,237,216,0)');
        ctx.fillStyle = mg;
        ctx.fillRect(w * 0.78 - 80, gTop * 0.2 - 80, 160, 160);
        ctx.fillStyle = '#f2ead2';
        ctx.beginPath();
        ctx.arc(w * 0.78, gTop * 0.2, 25, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(190,180,160,0.4)';
        ctx.beginPath();
        ctx.arc(w * 0.78 - 8, gTop * 0.2 + 4, 6, 0, Math.PI * 2);
        ctx.arc(w * 0.78 + 7, gTop * 0.2 - 7, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      if (theme === 'rooftop') {
        // 高空雲層（緩慢漂移）
        ctx.fillStyle = 'rgba(190,200,225,0.07)';
        for (const [cx, cy, cr] of clouds) {
          const px = ((cx - elapsed * 14 + cam.parallaxOffset(0.08)) % (w + 400) + w + 400) % (w + 400) - 200;
          ctx.beginPath();
          ctx.ellipse(px, cy, cr, cr * 0.32, 0, 0, Math.PI * 2);
          ctx.ellipse(px + cr * 0.5, cy + 8, cr * 0.7, cr * 0.25, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 2) 遠景（視差 0.22）：有 AI backdrop 用圖，否則程式剪影 tile
      const aiBg = getBackdrop(theme);
      const farSrc: HTMLCanvasElement | HTMLImageElement = aiBg ?? farTile;
      const farH = aiBg ? gTop * 1.04 : gTop * 0.78;
      const farY = gTop - farH;
      const off = cam.parallaxOffset(0.22);
      const tw = farSrc.width * (farH / farSrc.height);
      let fx = ((off % tw) + tw) % tw - tw;
      while (fx < w) {
        ctx.drawImage(farSrc, fx, farY, tw, farH);
        fx += tw;
      }
      // 層間大氣霧（Alien Hominid 式深度分離）
      const hz = ctx.createLinearGradient(0, farY + farH * 0.4, 0, gTop);
      hz.addColorStop(0, 'rgba(0,0,0,0)');
      hz.addColorStop(1, spec.haze);
      ctx.fillStyle = hz;
      ctx.fillRect(0, farY, w, farH + 2);

      // 3) 地面（各主題專屬鋪面）
      drawGround(ctx, cam, w, h, theme, spec);

      // 4) 中景道具（z=0 街面後緣）— 僅在無 AI backdrop 時繪製（避免與 AI 場景重疊）
      if (!aiBg) {
        const viewMin = cam.x - cam.halfW - 14;
        const viewMax = cam.x + cam.halfW + 14;
        const m = cam.ppm * 0.78;
        for (const p of props) {
          if (p.x < viewMin || p.x > viewMax) continue;
          const base = cam.worldToScreen(_gv.set(p.x, 0, 0));
          drawProp(ctx, p, base.x, base.y, m, elapsed, theme);
        }
      }
      // 中景與實體層之間的薄霧
      ctx.fillStyle = 'rgba(10,8,16,0.12)';
      ctx.fillRect(0, 0, w, gTop + 4);

      if (theme === 'rooftop') drawHelipad(ctx, cam, length);
      if (protectTarget) {
        const b = cam.worldToScreen(protectTarget);
        drawBurner(ctx, b.x, b.y, cam.ppm * b.scale, elapsed);
      }
    },

    drawForeground(ctx, cam, w, h, elapsed) {
      const hasAi = !!getBackdrop(theme);
      // 前景電纜（無 AI backdrop 時才畫，避免蓋住 AI 場景）
      if (!hasAi && (theme === 'neon' || theme === 'nightmarket' || theme === 'temple')) {
        ctx.strokeStyle = 'rgba(5,4,8,0.6)';
        ctx.lineWidth = 3.5;
        const off = cam.parallaxOffset(1.3);
        for (let i = 0; i < 3; i++) {
          const y0 = h * (0.05 + i * 0.045);
          ctx.beginPath();
          for (let px = -60; px <= w + 60; px += 36) {
            const sag = Math.sin((px - off) * 0.011 + i * 2.1) * 16 + Math.sin((px - off) * 0.05) * 3;
            if (px === -60) ctx.moveTo(px, y0 + sag);
            else ctx.lineTo(px, y0 + sag);
          }
          ctx.stroke();
        }
      }
      if (!hasAi && theme === 'skybridge') drawBridgeRibs(ctx, cam, w, h);
      if (theme === 'rooftop') {
        ctx.strokeStyle = 'rgba(255,255,255,0.07)';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 6; i++) {
          const y = (elapsed * 100 + i * 131) % h;
          const x = w - ((elapsed * 640 + i * 470) % (w + 320));
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 150 + i * 14, y);
          ctx.stroke();
        }
      }
      // 雜訊顆粒 + 暈影
      grain(ctx, w, h);
      const v = ctx.createRadialGradient(w / 2, h / 2, h * 0.42, w / 2, h / 2, h * 0.96);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, 'rgba(0,0,0,0.45)');
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, w, h);
    },
  };
}

// ───────────────────────── 遠景 tile ─────────────────────────

function buildFarTile(theme: EnvTheme, spec: ThemeSpec): HTMLCanvasElement {
  const tile = document.createElement('canvas');
  tile.width = 1200;
  tile.height = 520;
  const c = tile.getContext('2d')!;
  const fr = mulberry32(42);

  if (theme === 'rooftop') {
    // 高空俯瞰：腳下的台北燈海（網格狀街道光帶）
    for (let i = 0; i < 16; i++) {
      const y = 360 + i * 10;
      c.strokeStyle = `rgba(255,190,90,${0.04 + fr() * 0.05})`;
      c.lineWidth = 1 + fr() * 2;
      c.beginPath();
      c.moveTo(0, y + fr() * 6);
      c.lineTo(1200, y + fr() * 6);
      c.stroke();
    }
    for (let i = 0; i < 500; i++) {
      c.fillStyle = `rgba(${190 + fr() * 65}, ${150 + fr() * 70}, ${60 + fr() * 70}, ${0.2 + fr() * 0.55})`;
      c.fillRect(fr() * 1200, 355 + fr() * 160, 1.5 + fr() * 2.2, 1.5 + fr() * 2.2);
    }
    return tile;
  }

  // 一般夜城剪影：不規則高度 + 點燈窗 + 屋頂水塔
  let x = 0;
  while (x < 1200) {
    const bw = 64 + fr() * 120;
    const bh = 120 + fr() * 250;
    c.fillStyle = shade(spec.farColor, Math.floor(fr() * 14) - 7);
    c.fillRect(x, 520 - bh, bw, bh);
    // 屋突／水塔（台北屋頂靈魂）
    if (fr() > 0.5) {
      c.fillRect(x + bw * 0.2, 520 - bh - 14, bw * 0.22, 14);
      c.beginPath();
      c.ellipse(x + bw * 0.7, 520 - bh - 10, 9, 10, 0, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = 'rgba(255, 214, 130, 0.32)';
    for (let wy = 520 - bh + 14; wy < 504; wy += 21) {
      for (let wx = x + 7; wx < x + bw - 9; wx += 17) {
        if (fr() > 0.58) c.fillRect(wx, wy, 6.5, 9);
      }
    }
    x += bw + 5 + fr() * 26;
  }

  if (theme === 'skybridge' || theme === 'neon') {
    draw101Silhouette(c, theme === 'skybridge' ? 880 : 950, 520, theme === 'skybridge' ? 1.35 : 0.95);
  }
  if (theme === 'temple') {
    // 遠景廟宇群：兩座燕尾脊剪影
    drawTempleRoofSilhouette(c, 200, 420, 300);
    drawTempleRoofSilhouette(c, 760, 450, 220);
  }
  return tile;
}

/** 台北 101 剪影：8 組如意斗節 + 裙樓 + 塔尖（仿真比例 1:8 漸縮） */
function draw101Silhouette(c: CanvasRenderingContext2D, cx: number, baseY: number, s: number): void {
  c.fillStyle = '#10182c';
  // 裙樓
  c.fillRect(cx - 70 * s, baseY - 46 * s, 140 * s, 46 * s);
  // 基座方柱
  c.fillRect(cx - 26 * s, baseY - 120 * s, 52 * s, 76 * s);
  // 8 節斗型（上寬下窄的倒梯形堆疊——101 的招牌輪廓）
  let y = baseY - 120 * s;
  for (let i = 0; i < 8; i++) {
    const hSeg = 36 * s;
    const wBot = 42 * s;
    const wTop = 54 * s;
    c.beginPath();
    c.moveTo(cx - wBot / 2, y);
    c.lineTo(cx + wBot / 2, y);
    c.lineTo(cx + wTop / 2, y - hSeg);
    c.lineTo(cx - wTop / 2, y - hSeg);
    c.closePath();
    c.fill();
    y -= hSeg;
  }
  // 頂冠 + 塔尖
  c.fillRect(cx - 16 * s, y - 18 * s, 32 * s, 18 * s);
  c.fillRect(cx - 3 * s, y - 70 * s, 6 * s, 52 * s);
  // 塔身燈帶（綠玻璃微光）與塔尖警示燈
  c.fillStyle = 'rgba(110, 220, 180, 0.16)';
  for (let i = 0; i < 8; i++) {
    c.fillRect(cx - 20 * s, baseY - 120 * s - (i + 0.5) * 36 * s, 40 * s, 3 * s);
  }
  c.fillStyle = 'rgba(255, 80, 80, 0.85)';
  c.fillRect(cx - 2.5 * s, y - 70 * s, 5 * s, 5 * s);
}

/** 遠景廟頂剪影：雙曲燕尾 */
function drawTempleRoofSilhouette(c: CanvasRenderingContext2D, x: number, y: number, w: number): void {
  c.fillStyle = '#1c1428';
  c.beginPath();
  c.moveTo(x - w * 0.07, y - 36);
  c.quadraticCurveTo(x + w * 0.5, y - 78, x + w * 1.07, y - 36);
  c.quadraticCurveTo(x + w * 1.12, y - 62, x + w * 1.2, y - 70); // 右燕尾翹起
  c.lineTo(x + w, y);
  c.lineTo(x, y);
  c.lineTo(x - w * 0.2, y - 70); // 左燕尾
  c.quadraticCurveTo(x - w * 0.12, y - 62, x - w * 0.07, y - 36);
  c.closePath();
  c.fill();
  c.fillRect(x, y, w, 100);
}

// ───────────────────────── 地面鋪面 ─────────────────────────

function drawGround(ctx: CanvasRenderingContext2D, cam: GameCamera, w: number, h: number, theme: EnvTheme, spec: ThemeSpec): void {
  const gTop = cam.groundTopY;
  const g = ctx.createLinearGradient(0, gTop, 0, h);
  g.addColorStop(0, shade(spec.ground, 14));
  g.addColorStop(0.1, spec.ground);
  g.addColorStop(1, shade(spec.ground, -26));
  ctx.fillStyle = g;
  ctx.fillRect(0, gTop, w, h - gTop);

  const v = new Vec3();
  const startX = Math.floor((cam.x - cam.halfW) / 2) * 2;
  const endX = cam.x + cam.halfW + 2;

  if (theme === 'neon' || theme === 'skybridge') {
    // 地磚／步道板：縱橫格線 + 隨機亮斑
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1.6;
    for (let gx = startX; gx < endX; gx += 2) {
      const tp = cam.worldToScreen(v.set(gx, 0, 0));
      const bt = cam.worldToScreen(v.set(gx, 0, DEPTH));
      ctx.beginPath();
      ctx.moveTo(tp.x, tp.y);
      ctx.lineTo(bt.x, bt.y);
      ctx.stroke();
    }
    for (let i = 1; i < 4; i++) {
      const y = cam.worldToScreen(v.set(cam.x, 0, (DEPTH / 4) * i)).y;
      ctx.beginPath();
      ctx.moveTo(0, y + wob(i, 0, 2));
      ctx.lineTo(w, y + wob(i, 1, 2));
      ctx.stroke();
    }
    // 反光斑（騎樓燈／玻璃光暈落地）
    const rr = mulberry32(31);
    ctx.fillStyle = theme === 'neon' ? 'rgba(160,140,255,0.05)' : 'rgba(120,180,240,0.05)';
    for (let i = 0; i < 7; i++) {
      const lx = startX + rr() * (endX - startX);
      const s0 = cam.worldToScreen(v.set(lx, 0, DEPTH * rr()));
      ctx.beginPath();
      ctx.ellipse(s0.x, s0.y, 60 + rr() * 80, 10 + rr() * 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (theme === 'nightmarket') {
    // 紅磚人字鋪面（簡化：交丁磚排）
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1.4;
    for (let row = 0; row < 6; row++) {
      const z = (DEPTH / 6) * row;
      const y = cam.worldToScreen(v.set(cam.x, 0, z)).y;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
      const offset = row % 2 === 0 ? 0 : 0.75;
      for (let gx = startX - 1; gx < endX; gx += 1.5) {
        const sx = cam.worldToScreen(v.set(gx + offset, 0, z + DEPTH / 12)).x;
        const y2 = cam.worldToScreen(v.set(gx, 0, z + DEPTH / 6)).y;
        ctx.beginPath();
        ctx.moveTo(sx, y);
        ctx.lineTo(sx, y2);
        ctx.stroke();
      }
    }
    // 油漬／濕地反光
    const rr = mulberry32(57);
    ctx.fillStyle = 'rgba(255,170,80,0.05)';
    for (let i = 0; i < 6; i++) {
      const lx = startX + rr() * (endX - startX);
      const s0 = cam.worldToScreen(v.set(lx, 0, DEPTH * rr()));
      ctx.beginPath();
      ctx.ellipse(s0.x, s0.y, 50 + rr() * 60, 8 + rr() * 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (theme === 'temple') {
    // 廟埕大石板（寬縫）
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = 2.2;
    for (let gx = startX - (startX % 3); gx < endX; gx += 3) {
      const tp = cam.worldToScreen(v.set(gx, 0, 0));
      const bt = cam.worldToScreen(v.set(gx, 0, DEPTH));
      ctx.beginPath();
      ctx.moveTo(tp.x, tp.y);
      ctx.lineTo(bt.x, bt.y);
      ctx.stroke();
    }
    for (let i = 1; i < 3; i++) {
      const y = cam.worldToScreen(v.set(cam.x, 0, (DEPTH / 3) * i)).y;
      ctx.beginPath();
      ctx.moveTo(0, y + wob(i, 3, 2.5));
      ctx.lineTo(w, y + wob(i, 5, 2.5));
      ctx.stroke();
    }
  } else if (theme === 'rooftop') {
    // 混凝土伸縮縫 + 警示斜紋帶（靠遠側）
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    for (let gx = startX - (startX % 5); gx < endX; gx += 5) {
      const tp = cam.worldToScreen(v.set(gx, 0, 0));
      const bt = cam.worldToScreen(v.set(gx, 0, DEPTH));
      ctx.beginPath();
      ctx.moveTo(tp.x, tp.y);
      ctx.lineTo(bt.x, bt.y);
      ctx.stroke();
    }
    const y0 = cam.worldToScreen(v.set(cam.x, 0, 0)).y;
    const y1 = cam.worldToScreen(v.set(cam.x, 0, 0.4)).y;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y0, w, y1 - y0);
    ctx.clip();
    const off = cam.parallaxOffset(1);
    for (let px = -40 + (off % 40); px < w + 40; px += 40) {
      ctx.fillStyle = Math.round((px - off) / 40) % 2 === 0 ? 'rgba(255,200,40,0.5)' : 'rgba(20,20,20,0.6)';
      ctx.beginPath();
      ctx.moveTo(px, y0);
      ctx.lineTo(px + 20, y0);
      ctx.lineTo(px + 8, y1);
      ctx.lineTo(px - 12, y1);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}

// ───────────────────────── 中景道具 ─────────────────────────

const NEON_PALETTE = ['#ff4d6d', '#00d4ff', '#ffd23f', '#9b5bff', '#3ddc97', '#ff8c42'];
const BILL_PALETTE = ['#c33a4f', '#1f6fae', '#caa432', '#3f7a4f', '#7a4f9e', '#b35a2e'];

function drawProp(ctx: CanvasRenderingContext2D, p: Prop, bx: number, by: number, m: number, t: number, theme: EnvTheme): void {
  ctx.save();
  ctx.translate(bx, by);
  const v = p.variant;
  switch (p.kind) {
    case 'shopfront': drawShopfront(ctx, m, v, p.text, t); break;
    case 'redhouse': drawRedHouse(ctx, m); break;
    case 'ledcorner': drawLedCorner(ctx, m, t); break;
    case 'stall': drawStall(ctx, m, v, p.text, t); break;
    case 'marketgate': drawMarketGate(ctx, m, t); break;
    case 'templegate': drawTempleGate(ctx, m, t); break;
    case 'stonelion': drawStoneLion(ctx, m, v); break;
    case 'lantern': drawLantern(ctx, m, v, t); break;
    case 'scooterRow': drawScooterRow(ctx, m, v); break;
    case 'lamp': drawLamp(ctx, m); break;
    case 'mallglass': drawMallGlass(ctx, m, v, p.text, t); break;
    case 'vent': drawVent(ctx, m); break;
    case 'beacon': drawBeacon(ctx, m, v, t); break;
    case 'spire': drawSpireBase(ctx, m, t); break;
  }
  ctx.restore();
}

/** 西門町店面：整面牆貼滿層疊招牌（真實西門町的視覺密度） */
function drawShopfront(ctx: CanvasRenderingContext2D, m: number, v: number, text: string | undefined, t: number): void {
  const sw = m * 5.2, sh = m * 4.2;
  const r = mulberry32(Math.floor(v * 10000));
  handRect(ctx, -sw / 2, -sh, sw, sh, shade('#332a44', Math.floor(v * 20) - 10), { shadeH: sh * 0.16 });
  // 騎樓柱與簷下光
  handRect(ctx, -sw / 2, -sh * 0.42, m * 0.34, sh * 0.42, '#272036', { shadeH: 0 });
  handRect(ctx, sw / 2 - m * 0.34, -sh * 0.42, m * 0.34, sh * 0.42, '#272036', { shadeH: 0 });
  const glow = ctx.createLinearGradient(0, -sh * 0.42, 0, 0);
  glow.addColorStop(0, `rgba(255, 224, 150, ${0.32 + v * 0.1})`);
  glow.addColorStop(1, 'rgba(255, 224, 150, 0.03)');
  ctx.fillStyle = glow;
  ctx.fillRect(-sw / 2 + m * 0.34, -sh * 0.42, sw - m * 0.68, sh * 0.42);
  // 上半牆面：橫式招牌層疊 2-3 塊（西門町正字標記）
  let yy = -sh + m * 0.18;
  for (let i = 0; i < 3 && yy < -sh * 0.5; i++) {
    const bh = m * (0.55 + r() * 0.4);
    const bw2 = sw * (0.62 + r() * 0.3);
    const bx2 = (r() - 0.5) * (sw - bw2) * 0.8;
    const col = BILL_PALETTE[Math.floor(r() * BILL_PALETTE.length)];
    handRect(ctx, bx2 - bw2 / 2, yy, bw2, bh, col, { shadeH: bh * 0.3, lineW: 2.2 });
    ctx.fillStyle = 'rgba(255,250,235,0.92)';
    ctx.font = `900 ${bh * 0.52}px 'Noto Sans TC', sans-serif`;
    ctx.textAlign = 'center';
    const labels = ['美而美', '38元', '手機配件', '老天祿', '電子遊', '麻辣燙', '彩券', '剪髮100'];
    ctx.fillText(labels[Math.floor(r() * labels.length)], bx2, yy + bh * 0.68, bw2 * 0.85);
    yy += bh + m * 0.12;
  }
  // 直式霓虹招牌掛在側邊（高出屋頂）
  if (text) {
    const neon = NEON_PALETTE[Math.floor(v * NEON_PALETTE.length)];
    neonVSign(ctx, (v > 0.5 ? 1 : -1) * sw * 0.32, -sh - m * 3.1, m, text, neon, t, v);
  }
  // 冷氣室外機（台灣牆面必備）
  for (let i = 0; i < 2; i++) {
    const ax = (r() - 0.5) * sw * 0.7;
    const ay = -sh * (0.52 + r() * 0.25);
    handRect(ctx, ax, ay, m * 0.42, m * 0.3, '#9aa0a8', { shadeH: m * 0.1, lineW: 1.8 });
    ctx.beginPath();
    ctx.arc(ax + m * 0.21, ay + m * 0.15, m * 0.1, 0, Math.PI * 2);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

/** 西門紅樓：八角紅磚樓（1908）——紅磚、白橫帶、拱窗、灰瓦尖頂 */
function drawRedHouse(ctx: CanvasRenderingContext2D, m: number): void {
  const W = m * 8.5, H = m * 4.6;
  // 八角樓正面呈現：中央寬面 + 兩斜側面
  const cx = 0;
  // 側翼（斜面，色暗）
  ctx.beginPath();
  ctx.moveTo(cx - W * 0.5, 0);
  ctx.lineTo(cx - W * 0.36, -H);
  ctx.lineTo(cx - W * 0.2, -H);
  ctx.lineTo(cx - W * 0.2, 0);
  ctx.closePath();
  ctx.fillStyle = '#6e2f26';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + W * 0.5, 0);
  ctx.lineTo(cx + W * 0.36, -H);
  ctx.lineTo(cx + W * 0.2, -H);
  ctx.lineTo(cx + W * 0.2, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // 中央主面：紅磚
  handRect(ctx, cx - W * 0.2, -H, W * 0.4, H, '#8c3a2c', { shadeH: H * 0.12 });
  // 白色橫帶 ×3（紅樓立面特徵）
  ctx.fillStyle = '#e8ded0';
  for (const fy of [-H * 0.32, -H * 0.6, -H * 0.88]) {
    ctx.fillRect(cx - W * 0.5, fy, W, m * 0.14);
  }
  // 拱窗（上層圓拱 + 白框）
  for (let i = -1; i <= 1; i++) {
    const wx = cx + i * W * 0.12;
    ctx.fillStyle = '#f0e6d4';
    ctx.beginPath();
    ctx.arc(wx, -H * 0.72, m * 0.3, Math.PI, 0);
    ctx.rect(wx - m * 0.3, -H * 0.72, m * 0.6, m * 0.62);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 214, 130, 0.55)';
    ctx.fillRect(wx - m * 0.21, -H * 0.7, m * 0.42, m * 0.5);
  }
  // 八角灰瓦尖頂
  ctx.beginPath();
  ctx.moveTo(cx - W * 0.42, -H);
  ctx.lineTo(cx, -H - m * 1.7);
  ctx.lineTo(cx + W * 0.42, -H);
  ctx.closePath();
  ctx.fillStyle = '#3c3a44';
  ctx.fill();
  ctx.stroke();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = 'rgba(8,6,12,0.3)';
  ctx.fillRect(cx, -H - m * 1.8, W * 0.5, m * 2);
  ctx.restore();
  // 頂尖裝飾
  ctx.fillStyle = '#2a2830';
  ctx.fillRect(cx - m * 0.05, -H - m * 1.95, m * 0.1, m * 0.3);
  // 門前圓拱入口 + 紅樓字樣
  ctx.fillStyle = '#3a241c';
  ctx.beginPath();
  ctx.arc(cx, -m * 0.0, m * 0.62, Math.PI, 0);
  ctx.rect(cx - m * 0.62, -m * 0.0, m * 1.24, m * 0.0);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f2e8d8';
  ctx.font = `900 ${m * 0.5}px 'Noto Sans TC', serif`;
  ctx.textAlign = 'center';
  ctx.fillText('西門紅樓', cx, -H * 0.44);
}

/** 西門町轉角大型 LED 牆（輪播色塊） */
function drawLedCorner(ctx: CanvasRenderingContext2D, m: number, t: number): void {
  const W = m * 4.2, H = m * 2.6;
  handRect(ctx, -W / 2 - m * 0.1, -m * 4.3 - H - m * 0.1, W + m * 0.2, H + m * 0.2, '#101018', { shadeH: 0 });
  const phase = Math.floor(t / 2.2) % 3;
  const cols = [['#0a2a4a', '#00d4ff'], ['#3a0a2a', '#ff4d6d'], ['#0a3a1a', '#3ddc97']][phase];
  const gr = ctx.createLinearGradient(-W / 2, 0, W / 2, 0);
  gr.addColorStop(0, cols[0]);
  gr.addColorStop(1, shade(cols[0], 26));
  ctx.fillStyle = gr;
  ctx.fillRect(-W / 2, -m * 4.3 - H, W, H);
  ctx.fillStyle = cols[1];
  ctx.font = `900 ${m * 0.78}px 'Noto Sans TC', sans-serif`;
  ctx.textAlign = 'center';
  ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(t * 2));
  ctx.fillText(['週年慶', 'LIVE', '新片上映'][phase], 0, -m * 4.3 - H * 0.36);
  ctx.globalAlpha = 1;
  // LED 掃描線
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (let i = 0; i < 6; i++) ctx.fillRect(-W / 2, -m * 4.3 - H + (i * H) / 6, W, 1.5);
  // 支柱
  handRect(ctx, -m * 0.14, -m * 4.3, m * 0.28, m * 4.3, '#2c2f38', { shadeH: 0 });
}

/** 夜市攤車 v2：鐵架攤台 + 條紋帆布 + 玻璃櫥櫃 + 蒸氣 + 塑膠椅 */
function drawStall(ctx: CanvasRenderingContext2D, m: number, v: number, text: string | undefined, t: number): void {
  const sw = m * 3.9, sh = m * 2.3;
  const cols = ['#b03830', '#c2913a', '#3f7a4f', '#7a4f9e'];
  const cc = cols[Math.floor(v * cols.length)];
  // 攤台 + 玻璃櫥櫃
  handRect(ctx, -sw / 2, -sh * 0.52, sw, sh * 0.52, '#2c2218', { shadeH: sh * 0.14 });
  handRect(ctx, -sw * 0.32, -sh * 0.78, sw * 0.64, sh * 0.26, 'rgba(200,230,255,0.18)', { shadeH: 0, lineW: 2 });
  ctx.fillStyle = 'rgba(255,220,140,0.5)';
  ctx.fillRect(-sw * 0.28, -sh * 0.74, sw * 0.56, sh * 0.18);
  // 食物剪影（串/碗）
  ctx.fillStyle = '#7a4a2a';
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.arc(i * sw * 0.1, -sh * 0.62, m * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }
  // 條紋帆布頂
  const awY = -sh, awH = sh * 0.3;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-sw / 2 - m * 0.34, awY);
  ctx.lineTo(sw / 2 + m * 0.34, awY);
  ctx.lineTo(sw / 2 + m * 0.16, awY + awH);
  ctx.lineTo(-sw / 2 - m * 0.16, awY + awH);
  ctx.closePath();
  ctx.fillStyle = cc;
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = 'rgba(255,245,225,0.85)';
  for (let i = -5; i <= 5; i += 2) {
    ctx.fillRect(i * sw * 0.1 - m * 0.14, awY - 2, m * 0.28, awH + 4);
  }
  ctx.restore();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-sw / 2 - m * 0.34, awY);
  ctx.lineTo(sw / 2 + m * 0.34, awY);
  ctx.lineTo(sw / 2 + m * 0.16, awY + awH);
  ctx.lineTo(-sw / 2 - m * 0.16, awY + awH);
  ctx.closePath();
  ctx.stroke();
  // 紅底白字橫招牌
  if (text) {
    handRect(ctx, -sw * 0.42, awY - m * 0.62, sw * 0.84, m * 0.56, '#a32c24', { shadeH: m * 0.12, lineW: 2.2 });
    ctx.fillStyle = '#fff3da';
    ctx.font = `900 ${m * 0.4}px 'Noto Sans TC', sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(text.slice(0, 6), 0, awY - m * 0.18, sw * 0.78);
  }
  // 燈泡串（暖光 + 搖晃）
  for (let i = -2; i <= 2; i++) {
    const lx = i * sw * 0.22 + Math.sin(t * 2 + v * 10 + i) * 2;
    ctx.fillStyle = '#ffdd88';
    ctx.shadowColor = '#ffbb44';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(lx, awY + awH + m * 0.08, m * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  // 蒸氣（多顆上升泡）
  ctx.fillStyle = 'rgba(255,255,255,0.13)';
  for (let i = 0; i < 2; i++) {
    const sy = (t * 26 + i * 40 + v * 80) % 55;
    ctx.beginPath();
    ctx.arc((v - 0.5) * sw * 0.4 + Math.sin(t + i) * 5, -sh * 0.8 - sy, m * (0.14 + sy / 110), 0, Math.PI * 2);
    ctx.fill();
  }
  // 紅色塑膠圓凳（台味）
  const stx = (v > 0.5 ? 1 : -1) * sw * 0.62;
  ctx.fillStyle = '#c0392b';
  ctx.beginPath();
  ctx.ellipse(stx, -m * 0.34, m * 0.2, m * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(stx - m * 0.13, -m * 0.3);
  ctx.lineTo(stx - m * 0.17, 0);
  ctx.moveTo(stx + m * 0.13, -m * 0.3);
  ctx.lineTo(stx + m * 0.17, 0);
  ctx.stroke();
}

/** 士林夜市入口牌樓：紅柱 + 綠瓦頂 + 紅底金字 */
function drawMarketGate(ctx: CanvasRenderingContext2D, m: number, t: number): void {
  const W = m * 7, H = m * 4.4;
  // 雙柱
  handRect(ctx, -W / 2, -H, m * 0.5, H, '#a32c24', { shadeH: H * 0.1 });
  handRect(ctx, W / 2 - m * 0.5, -H, m * 0.5, H, '#a32c24', { shadeH: H * 0.1 });
  // 橫樑
  handRect(ctx, -W / 2 - m * 0.3, -H, W + m * 0.6, m * 0.7, '#8c2820', { shadeH: m * 0.2 });
  // 綠琉璃瓦簷（微翹）
  ctx.beginPath();
  ctx.moveTo(-W / 2 - m * 0.75, -H);
  ctx.quadraticCurveTo(0, -H - m * 0.5, W / 2 + m * 0.75, -H);
  ctx.lineTo(W / 2 + m * 0.45, -H - m * 0.55);
  ctx.quadraticCurveTo(0, -H - m * 1.0, -W / 2 - m * 0.45, -H - m * 0.55);
  ctx.closePath();
  ctx.fillStyle = '#2e6b4f';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  // 瓦楞線
  ctx.lineWidth = 1.5;
  for (let i = -4; i <= 4; i++) {
    ctx.beginPath();
    ctx.moveTo(i * W * 0.1, -H - m * 0.06);
    ctx.lineTo(i * W * 0.11, -H - m * 0.5);
    ctx.stroke();
  }
  // 紅底金字招牌
  handRect(ctx, -m * 1.9, -H + m * 0.78, m * 3.8, m * 0.86, '#8c1f1a', { shadeH: m * 0.18, lineW: 2.5 });
  ctx.fillStyle = '#ffd75e';
  ctx.font = `900 ${m * 0.62}px 'Noto Sans TC', serif`;
  ctx.textAlign = 'center';
  ctx.shadowColor = '#ffaa33';
  ctx.shadowBlur = 8 + Math.sin(t * 3) * 4;
  ctx.fillText('士林夜市', 0, -H + m * 1.42);
  ctx.shadowBlur = 0;
  // 柱聯
  ctx.fillStyle = '#ffd75e';
  ctx.font = `700 ${m * 0.3}px 'Noto Sans TC', serif`;
  ['美', '食'].forEach((ch, i) => ctx.fillText(ch, -W / 2 + m * 0.25, -H * 0.62 + i * m * 0.42));
  ['天', '堂'].forEach((ch, i) => ctx.fillText(ch, W / 2 - m * 0.25, -H * 0.62 + i * m * 0.42));
}

/** 龍山寺三川殿：石垛基座 + 紅柱列 + 雙層燕尾脊瓦頂 + 簷下燈籠 */
function drawTempleGate(ctx: CanvasRenderingContext2D, m: number, t: number): void {
  const W = m * 13, H = m * 3.6;
  // 石垛基座牆
  handRect(ctx, -W / 2, -H * 0.45, W, H * 0.45, '#6e6a62', { shadeH: H * 0.12 });
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1.5;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-W / 2, -H * 0.45 * (i / 3));
    ctx.lineTo(W / 2, -H * 0.45 * (i / 3));
    ctx.stroke();
  }
  // 紅柱列（5 柱）與木門
  for (let i = -2; i <= 2; i++) {
    const px = i * W * 0.2;
    handRect(ctx, px - m * 0.17, -H, m * 0.34, H, '#9e2f24', { shadeH: H * 0.08 });
  }
  // 格扇木門（柱間，暖光透出）
  for (let i = -1.5; i <= 1.5; i += 1) {
    const dx = i * W * 0.2;
    ctx.fillStyle = '#52301e';
    ctx.fillRect(dx - W * 0.072, -H * 0.92, W * 0.144, H * 0.47);
    ctx.fillStyle = 'rgba(255, 200, 110, 0.35)';
    for (let r2 = 0; r2 < 3; r2++) {
      for (let c2 = 0; c2 < 2; c2++) {
        ctx.fillRect(dx - W * 0.055 + c2 * W * 0.058, -H * 0.88 + r2 * H * 0.13, W * 0.045, H * 0.1);
      }
    }
  }
  // 簷下橫枋
  handRect(ctx, -W / 2 - m * 0.3, -H - m * 0.45, W + m * 0.6, m * 0.45, '#7a2a20', { shadeH: m * 0.14 });
  // 雙層瓦頂與燕尾脊
  const roof = (yBase: number, span: number, hgt: number) => {
    ctx.beginPath();
    ctx.moveTo(-span, yBase);
    ctx.quadraticCurveTo(0, yBase - hgt * 0.34, span, yBase);
    ctx.lineTo(span + m * 0.85, yBase - hgt); // 右燕尾尖
    ctx.quadraticCurveTo(span * 0.5, yBase - hgt * 0.78, 0, yBase - hgt * 0.72);
    ctx.quadraticCurveTo(-span * 0.5, yBase - hgt * 0.78, -span - m * 0.85, yBase - hgt); // 左燕尾尖
    ctx.closePath();
    ctx.fillStyle = '#b35226';
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = 'rgba(8,6,12,0.25)';
    ctx.fillRect(-span - m, yBase - hgt * 0.4, span * 2 + m * 2, hgt);
    // 瓦楞
    ctx.strokeStyle = 'rgba(40,16,8,0.5)';
    ctx.lineWidth = 1.5;
    for (let i = -8; i <= 8; i++) {
      ctx.beginPath();
      ctx.moveTo(i * span * 0.12, yBase + 2);
      ctx.lineTo(i * span * 0.135, yBase - hgt * 0.75);
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // 脊上剪黏雙龍（簡化剪影）
    ctx.fillStyle = '#2e8b6b';
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sgn * span * 0.42, yBase - hgt * 0.74);
      ctx.quadraticCurveTo(sgn * span * 0.52, yBase - hgt * 1.04, sgn * span * 0.6, yBase - hgt * 0.8);
      ctx.quadraticCurveTo(sgn * span * 0.55, yBase - hgt * 0.78, sgn * span * 0.47, yBase - hgt * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }
    // 中央寶珠
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.arc(0, yBase - hgt * 0.78, m * 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  };
  roof(-H - m * 0.45, W * 0.56, m * 1.15);
  roof(-H - m * 1.5, W * 0.34, m * 0.95);
  // 簷下紅燈籠列（搖曳）
  for (let i = -2; i <= 2; i++) {
    const lx = i * W * 0.18 + Math.sin(t * 1.7 + i) * 2.5;
    ctx.fillStyle = '#d8362a';
    ctx.shadowColor = '#ff6644';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.ellipse(lx, -H - m * 0.06, m * 0.2, m * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#7a1d1d';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(lx - m * 0.18, -H - m * 0.06);
    ctx.lineTo(lx + m * 0.18, -H - m * 0.06);
    ctx.stroke();
    ctx.fillStyle = '#e8b84a';
    ctx.fillRect(lx - m * 0.05, -H - m * 0.36, m * 0.1, m * 0.07);
  }
  // 廟名豎匾
  handRect(ctx, -m * 0.55, -H - m * 2.4, m * 1.1, m * 1.0, '#1c3a6b', { shadeH: 0, lineW: 2.5 });
  ctx.fillStyle = '#ffd75e';
  ctx.font = `900 ${m * 0.4}px 'Noto Sans TC', serif`;
  ctx.textAlign = 'center';
  ctx.fillText('龍山寺', 0, -H - m * 1.78);
}

/** 石獅（廟前一對） */
function drawStoneLion(ctx: CanvasRenderingContext2D, m: number, v: number): void {
  const flip = v > 0.5 ? 1 : -1;
  ctx.save();
  ctx.scale(flip, 1);
  // 基座
  handRect(ctx, -m * 0.55, -m * 0.42, m * 1.1, m * 0.42, '#5e5a52', { shadeH: m * 0.12 });
  // 身體蹲坐
  ctx.fillStyle = '#787068';
  ctx.beginPath();
  ctx.ellipse(-m * 0.08, -m * 0.85, m * 0.4, m * 0.45, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.2;
  ctx.stroke();
  // 頭 + 鬃毛卷
  ctx.fillStyle = '#827a70';
  ctx.beginPath();
  ctx.arc(m * 0.18, -m * 1.32, m * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#6a625a';
  for (let i = 0; i < 5; i++) {
    const a = -0.6 + i * 0.55;
    ctx.beginPath();
    ctx.arc(m * 0.18 + Math.cos(a + 2.2) * m * 0.3, -m * 1.32 + Math.sin(a + 2.2) * m * 0.3, m * 0.09, 0, Math.PI * 2);
    ctx.fill();
  }
  // 眼睛 + 嘴
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(m * 0.26, -m * 1.36, m * 0.04, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(m * 0.3, -m * 1.22, m * 0.08, 0.2, Math.PI - 0.4);
  ctx.stroke();
  ctx.restore();
}

/** 廟埕宮燈柱 */
function drawLantern(ctx: CanvasRenderingContext2D, m: number, v: number, t: number): void {
  handRect(ctx, -m * 0.08, -m * 3.4, m * 0.16, m * 3.4, '#3a342c', { shadeH: 0 });
  const sway = Math.sin(t * 1.6 + v * 30) * 3;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, -m * 3.4);
  ctx.lineTo(sway, -m * 3.05);
  ctx.stroke();
  ctx.fillStyle = '#d8362a';
  ctx.shadowColor = '#ff6644';
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.ellipse(sway, -m * 2.66, m * 0.3, m * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#7a1d1d';
  ctx.lineWidth = 1.4;
  for (const dy of [-0.1, 0, 0.1]) {
    ctx.beginPath();
    ctx.moveTo(sway - m * 0.28, -m * (2.66 + dy));
    ctx.lineTo(sway + m * 0.28, -m * (2.66 + dy));
    ctx.stroke();
  }
  ctx.fillStyle = '#e8b84a';
  ctx.fillRect(sway - m * 0.07, -m * 3.1, m * 0.14, m * 0.08);
  ctx.fillStyle = '#a3262a';
  ctx.font = `700 ${m * 0.24}px 'Noto Sans TC', serif`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#5a1a14';
  ctx.fillText('福', sway, -m * 2.58);
}

/** 路邊機車排（2-3 台並停，台灣街景靈魂） */
function drawScooterRow(ctx: CanvasRenderingContext2D, m: number, v: number): void {
  const r = mulberry32(Math.floor(v * 8888));
  const n = 2 + Math.floor(r() * 2);
  for (let s = 0; s < n; s++) {
    ctx.save();
    ctx.translate((s - n / 2) * m * 1.18, 0);
    if (r() > 0.5) ctx.scale(-1, 1);
    const c = ['#3f6285', '#7a4a52', '#5a7a4a', '#8c8c8c', '#b8b0a0'][Math.floor(r() * 5)];
    // 輪
    ctx.fillStyle = '#1c1814';
    ctx.beginPath();
    ctx.arc(-m * 0.42, -m * 0.17, m * 0.17, 0, Math.PI * 2);
    ctx.arc(m * 0.42, -m * 0.17, m * 0.17, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4a4a4a';
    ctx.beginPath();
    ctx.arc(-m * 0.42, -m * 0.17, m * 0.07, 0, Math.PI * 2);
    ctx.arc(m * 0.42, -m * 0.17, m * 0.07, 0, Math.PI * 2);
    ctx.fill();
    // 車身
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(-m * 0.46, -m * 0.33);
    ctx.quadraticCurveTo(-m * 0.05, -m * 0.18, m * 0.26, -m * 0.38);
    ctx.lineTo(m * 0.5, -m * 0.74);
    ctx.lineTo(m * 0.58, -m * 0.72);
    ctx.lineTo(m * 0.56, -m * 0.38);
    ctx.quadraticCurveTo(m * 0.2, -m * 0.04, -m * 0.42, -m * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.2;
    ctx.stroke();
    // 座墊 + 後照鏡 + 車燈
    ctx.fillStyle = '#241f1a';
    ctx.beginPath();
    ctx.roundRect(-m * 0.4, -m * 0.58, m * 0.46, m * 0.13, m * 0.05);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(m * 0.52, -m * 0.74);
    ctx.lineTo(m * 0.6, -m * 0.88);
    ctx.stroke();
    ctx.fillStyle = '#3a3a3a';
    ctx.beginPath();
    ctx.arc(m * 0.62, -m * 0.88, m * 0.045, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe9b0';
    ctx.beginPath();
    ctx.ellipse(m * 0.56, -m * 0.6, m * 0.05, m * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawLamp(ctx: CanvasRenderingContext2D, m: number): void {
  handRect(ctx, -m * 0.08, -m * 4.0, m * 0.16, m * 4.0, '#3c4250', { shadeH: 0 });
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(0, -m * 4.0);
  ctx.quadraticCurveTo(m * 0.55, -m * 4.05, m * 0.6, -m * 3.85);
  ctx.stroke();
  ctx.fillStyle = '#ffe9b0';
  ctx.shadowColor = '#ffd980';
  ctx.shadowBlur = 22;
  ctx.beginPath();
  ctx.ellipse(m * 0.6, -m * 3.8, m * 0.24, m * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.stroke();
  // 落地光錐
  const lg = ctx.createLinearGradient(0, -m * 3.7, 0, 0);
  lg.addColorStop(0, 'rgba(255,230,170,0.16)');
  lg.addColorStop(1, 'rgba(255,230,170,0)');
  ctx.fillStyle = lg;
  ctx.beginPath();
  ctx.moveTo(m * 0.6 - m * 0.18, -m * 3.75);
  ctx.lineTo(m * 0.6 + m * 0.18, -m * 3.75);
  ctx.lineTo(m * 0.6 + m * 1.0, 0);
  ctx.lineTo(m * 0.6 - m * 1.0, 0);
  ctx.closePath();
  ctx.fill();
}

/** 信義百貨玻璃帷幕 + 大型 LED 招牌 */
function drawMallGlass(ctx: CanvasRenderingContext2D, m: number, v: number, text: string | undefined, t: number): void {
  const gw = m * 5.6, gh = m * 4.4;
  const grad = ctx.createLinearGradient(-gw / 2, -gh, gw / 2, 0);
  grad.addColorStop(0, '#1a2c48');
  grad.addColorStop(0.45, '#27425f');
  grad.addColorStop(0.55, '#34527a');
  grad.addColorStop(1, '#16263e');
  ctx.fillStyle = grad;
  ctx.fillRect(-gw / 2, -gh, gw, gh);
  // 帷幕格線
  ctx.strokeStyle = 'rgba(150,200,250,0.22)';
  ctx.lineWidth = 1.4;
  for (let i = 1; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(-gw / 2 + (gw / 5) * i, -gh);
    ctx.lineTo(-gw / 2 + (gw / 5) * i, 0);
    ctx.stroke();
  }
  for (let i = 1; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(-gw / 2, -gh + (gh / 6) * i);
    ctx.lineTo(gw / 2, -gh + (gh / 6) * i);
    ctx.stroke();
  }
  // 斜向反光
  ctx.fillStyle = 'rgba(180,220,255,0.07)';
  ctx.beginPath();
  ctx.moveTo(-gw * 0.1, -gh);
  ctx.lineTo(gw * 0.18, -gh);
  ctx.lineTo(-gw * 0.18, 0);
  ctx.lineTo(-gw * 0.46, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(-gw / 2, -gh, gw, gh);
  // 入口雨庇 + 暖光
  handRect(ctx, -gw * 0.3, -m * 1.1, gw * 0.6, m * 0.16, '#2c2f38', { shadeH: 0 });
  ctx.fillStyle = 'rgba(255,230,180,0.25)';
  ctx.fillRect(-gw * 0.26, -m * 0.94, gw * 0.52, m * 0.94);
  // 樓頂 LED 招牌
  if (text) {
    const col = NEON_PALETTE[Math.floor(v * NEON_PALETTE.length)];
    handRect(ctx, -m * 1.7, -gh - m * 1.1, m * 3.4, m * 0.95, '#0e1018', { shadeH: 0, lineW: 2.2 });
    ctx.fillStyle = col;
    ctx.font = `900 ${m * 0.6}px 'Noto Sans TC', sans-serif`;
    ctx.textAlign = 'center';
    ctx.shadowColor = col;
    ctx.shadowBlur = 12 * (0.6 + 0.4 * Math.sin(t * 2 + v * 9));
    ctx.fillText(text, 0, -gh - m * 0.42);
    ctx.shadowBlur = 0;
  }
}

function drawVent(ctx: CanvasRenderingContext2D, m: number): void {
  handRect(ctx, -m * 1.0, -m * 1.15, m * 2.0, m * 1.15, '#34373e', { shadeH: m * 0.3 });
  ctx.strokeStyle = '#1e2026';
  ctx.lineWidth = 2.2;
  for (let i = 1; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(-m * 0.92, -m * 1.15 + (m * 1.08 / 5) * i);
    ctx.lineTo(m * 0.92, -m * 1.15 + (m * 1.08 / 5) * i);
    ctx.stroke();
  }
  // 管線
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(m * 1.0, -m * 0.5);
  ctx.quadraticCurveTo(m * 1.5, -m * 0.5, m * 1.5, 0);
  ctx.stroke();
}

function drawBeacon(ctx: CanvasRenderingContext2D, m: number, v: number, t: number): void {
  const pulse = (Math.sin(t * 2.5 + v * 10) + 1) / 2;
  handRect(ctx, -m * 0.06, -m * 1.7, m * 0.12, m * 1.7, '#3c4250', { shadeH: 0 });
  ctx.fillStyle = `rgba(255, 60, 60, ${0.4 + pulse * 0.6})`;
  ctx.shadowColor = '#ff3030';
  ctx.shadowBlur = 20 * pulse;
  ctx.beginPath();
  ctx.arc(0, -m * 1.8, m * 0.13, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  // 紅光暈圈
  ctx.strokeStyle = `rgba(255, 80, 80, ${0.2 * pulse})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, -m * 1.8, m * (0.3 + pulse * 0.3), 0, Math.PI * 2);
  ctx.stroke();
}

/** 101 頂樓塔尖基座（91F 觀景台上方的塔尖結構） */
function drawSpireBase(ctx: CanvasRenderingContext2D, m: number, t: number): void {
  // 塔尖（高聳入畫面外）
  handRect(ctx, -m * 0.9, -m * 7.5, m * 1.8, m * 7.5, '#1f2c3e', { shadeH: 0 });
  handRect(ctx, -m * 0.55, -m * 10, m * 1.1, m * 2.6, '#1a2536', { shadeH: 0 });
  handRect(ctx, -m * 0.16, -m * 13, m * 0.32, m * 3.1, '#16202e', { shadeH: 0 });
  // 結構橫線
  ctx.strokeStyle = 'rgba(120,200,180,0.18)';
  ctx.lineWidth = 1.5;
  for (let i = 1; i < 8; i++) {
    ctx.beginPath();
    ctx.moveTo(-m * 0.88, -m * (i * 0.95));
    ctx.lineTo(m * 0.88, -m * (i * 0.95));
    ctx.stroke();
  }
  // 警示燈
  const pulse = (Math.sin(t * 2.2) + 1) / 2;
  ctx.fillStyle = `rgba(255,60,60,${0.5 + pulse * 0.5})`;
  ctx.shadowColor = '#ff3030';
  ctx.shadowBlur = 16 * pulse;
  ctx.beginPath();
  ctx.arc(0, -m * 12.9, m * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

/** 信義空橋白色鋼拱（前景）：真實空橋的圓拱肋 + 玻璃欄板 */
function drawBridgeRibs(ctx: CanvasRenderingContext2D, cam: GameCamera, w: number, h: number): void {
  const off = cam.parallaxOffset(1.15);
  const span = cam.ppm * 7;
  ctx.strokeStyle = '#c8cdd6';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  const topY = h * 0.03;
  for (let px = ((off % span) + span) % span - span; px < w + span; px += span) {
    // 圓拱肋
    ctx.beginPath();
    ctx.moveTo(px, h * 0.34);
    ctx.quadraticCurveTo(px + span / 2, topY - h * 0.16, px + span, h * 0.34);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(200,205,214,0.5)';
    // 吊索
    for (let i = 1; i < 6; i++) {
      const sx = px + (span / 6) * i;
      const archY = h * 0.34 + (topY - h * 0.16 - h * 0.34) * (1 - Math.pow((i / 6) * 2 - 1, 2)) * 0.5 * 2;
      ctx.beginPath();
      ctx.moveTo(sx, archY * 0.96);
      ctx.lineTo(sx, h * 0.3);
      ctx.stroke();
    }
    ctx.lineWidth = 7;
    ctx.strokeStyle = '#c8cdd6';
  }
  // 近端玻璃欄板（畫面最下緣）
  const railY = h * 0.985;
  ctx.fillStyle = 'rgba(140,180,230,0.1)';
  ctx.fillRect(0, railY - 36, w, 36);
  ctx.strokeStyle = '#aeb4c0';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, railY - 36);
  ctx.lineTo(w, railY - 36);
  ctx.stroke();
  ctx.lineWidth = 2.5;
  for (let px = ((off % 90) + 90) % 90 - 90; px < w + 90; px += 90) {
    ctx.beginPath();
    ctx.moveTo(px, railY - 36);
    ctx.lineTo(px, railY);
    ctx.stroke();
  }
}

/** 龍山寺銅鑄香爐（protect 目標）：三足 + 雙耳 + 寶塔蓋 */
function drawBurner(ctx: CanvasRenderingContext2D, bx: number, by: number, m: number, t: number): void {
  ctx.save();
  ctx.translate(bx, by);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  // 三足
  for (const lx of [-m * 0.42, 0, m * 0.42]) {
    ctx.fillStyle = '#5e5024';
    ctx.beginPath();
    ctx.moveTo(lx - m * 0.09, -m * 0.42);
    ctx.quadraticCurveTo(lx - m * 0.13, -m * 0.1, lx - m * 0.05, 0);
    ctx.lineTo(lx + m * 0.05, 0);
    ctx.quadraticCurveTo(lx + m * 0.13, -m * 0.1, lx + m * 0.09, -m * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // 爐身（鼓腹）
  const bodyGrad = ctx.createLinearGradient(-m * 0.7, 0, m * 0.7, 0);
  bodyGrad.addColorStop(0, '#6a5a28');
  bodyGrad.addColorStop(0.5, '#8a7838');
  bodyGrad.addColorStop(1, '#564818');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.ellipse(0, -m * 0.82, m * 0.7, m * 0.52, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // 雙耳
  for (const sgn of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(sgn * m * 0.72, -m * 1.05, m * 0.16, sgn > 0 ? -Math.PI * 0.6 : Math.PI * 0.4, sgn > 0 ? Math.PI * 0.6 : -Math.PI * 1.4, sgn < 0);
    ctx.lineWidth = m * 0.09;
    ctx.strokeStyle = '#6a5a28';
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = INK;
  }
  // 爐口 + 寶塔蓋
  ctx.fillStyle = '#564818';
  ctx.beginPath();
  ctx.ellipse(0, -m * 1.3, m * 0.55, m * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#6a5a28';
  ctx.beginPath();
  ctx.moveTo(-m * 0.4, -m * 1.36);
  ctx.lineTo(m * 0.4, -m * 1.36);
  ctx.lineTo(m * 0.22, -m * 1.66);
  ctx.lineTo(m * 0.13, -m * 1.66);
  ctx.lineTo(m * 0.13, -m * 1.86);
  ctx.lineTo(-m * 0.13, -m * 1.86);
  ctx.lineTo(-m * 0.13, -m * 1.66);
  ctx.lineTo(-m * 0.22, -m * 1.66);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // 爐身「光明」字
  ctx.fillStyle = '#3a3010';
  ctx.font = `900 ${m * 0.3}px 'Noto Sans TC', serif`;
  ctx.textAlign = 'center';
  ctx.fillText('光明', 0, -m * 0.74);
  // 香 + 煙
  for (const ix of [-m * 0.16, 0, m * 0.16]) {
    ctx.strokeStyle = '#8f2b22';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(ix, -m * 1.4);
    ctx.lineTo(ix * 1.25, -m * 1.95);
    ctx.stroke();
    ctx.fillStyle = '#ff8844';
    ctx.beginPath();
    ctx.arc(ix * 1.25, -m * 1.97, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = INK;
  ctx.fillStyle = 'rgba(235,235,235,0.13)';
  for (let i = 0; i < 4; i++) {
    const sy = (t * 20 + i * 28) % 80;
    ctx.beginPath();
    ctx.arc(Math.sin(t * 1.4 + i * 1.8) * (5 + sy * 0.18), -m * 2.05 - sy, 3.5 + sy / 10, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** 101 頂樓直升機坪 */
function drawHelipad(ctx: CanvasRenderingContext2D, cam: GameCamera, length: number): void {
  const c = cam.worldToScreen(new Vec3(length * 0.7, 0, DEPTH / 2));
  const rx = cam.ppm * 4.6;
  const ry = cam.ppm * 1.6;
  ctx.strokeStyle = 'rgba(255,210,63,0.45)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, rx * 0.78, ry * 0.78, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = `900 ${cam.ppm * 1.7}px 'Noto Sans TC', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,210,63,0.4)';
  ctx.fillText('H', c.x, c.y);
  ctx.textBaseline = 'alphabetic';
}
