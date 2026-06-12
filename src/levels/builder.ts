// 2D 視差舞台：五關台北場景（程式化繪製，Dad'n Me 低飽和手繪感）。
// 三層結構：天空(0) → 遠景剪影(0.25) → 中景街面(1.0) → 地面 → [實體層由 level.ts 繪] → 前景(1.25)。
// AI 背景圖到位後可在 drawBackground 開頭以圖層取代對應 pass。
import { Vec3 } from '../core/vec';
import { DEPTH, type GameCamera } from '../core/camera';

export type EnvTheme = 'neon' | 'nightmarket' | 'temple' | 'skybridge' | 'rooftop';

export interface Environment {
  length: number;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  protectTarget: Vec3 | null;
  update(dt: number, elapsed: number): void;
  drawBackground(ctx: CanvasRenderingContext2D, cam: GameCamera, w: number, h: number, elapsed: number): void;
  drawForeground(ctx: CanvasRenderingContext2D, cam: GameCamera, w: number, h: number, elapsed: number): void;
}

/** 種子隨機（場景佈局固定） */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface ThemeSpec {
  skyTop: string;
  skyBottom: string;
  farColor: string;
  ground: string;
  groundLine: string;
  signs: string[];
}

const THEMES: Record<EnvTheme, ThemeSpec> = {
  neon: {
    skyTop: '#0a0d1e', skyBottom: '#1d2342', farColor: '#141930',
    ground: '#2a2c33', groundLine: '#3a3d46',
    signs: ['電影街', 'KTV', '萬年', '藥妝', '紅樓', '刺青', '電玩', '滷味'],
  },
  nightmarket: {
    skyTop: '#120c08', skyBottom: '#2c1a0e', farColor: '#1e1410',
    ground: '#3a3026', groundLine: '#4a3e30',
    signs: ['士林夜市', '蚵仔煎', '大腸包小腸', '珍珠奶茶', '雞排', '臭豆腐', '藥燉排骨'],
  },
  temple: {
    skyTop: '#080a14', skyBottom: '#1a1626', farColor: '#120f1c',
    ground: '#4a443c', groundLine: '#5a544a',
    signs: ['龍山寺', '平安', '光明', '祈福'],
  },
  skybridge: {
    skyTop: '#0a1220', skyBottom: '#16263e', farColor: '#101a2e',
    ground: '#33373f', groundLine: '#454a54',
    signs: ['信義', 'SALE', '百貨', 'ATT', '威秀'],
  },
  rooftop: {
    skyTop: '#05070f', skyBottom: '#0e1526', farColor: '#0a1020',
    ground: '#23262c', groundLine: '#34383f',
    signs: [],
  },
};

interface Prop {
  x: number;       // world x
  kind: string;
  variant: number; // 0-1 隨機參數
  text?: string;
}

export function buildEnvironment(theme: EnvTheme, length: number): Environment {
  const spec = THEMES[theme];
  const rand = mulberry32(theme.length * 7919 + length);
  const props: Prop[] = [];

  // ── 佈置中景道具（依主題） ──
  const every = (gap: number, kind: string, withText = false) => {
    for (let x = 2 + rand() * gap; x < length - 2; x += gap * (0.7 + rand() * 0.6)) {
      props.push({ x, kind, variant: rand(), text: withText ? spec.signs[Math.floor(rand() * spec.signs.length)] : undefined });
    }
  };
  switch (theme) {
    case 'neon':
      every(5.5, 'storefront', true);
      every(9, 'scooter');
      every(13, 'lamp');
      break;
    case 'nightmarket':
      every(4.5, 'stall', true);
      every(7, 'lanternString');
      every(11, 'scooter');
      break;
    case 'temple':
      every(6, 'pillar');
      every(4, 'lantern');
      break;
    case 'skybridge':
      every(7, 'glasspanel');
      every(10, 'billboard', true);
      every(15, 'lamp');
      break;
    case 'rooftop':
      every(12, 'vent');
      every(18, 'beacon');
      break;
  }
  props.sort((a, b) => a.x - b.x);

  // ── 遠景剪影 tile（offscreen，視差 0.25） ──
  const farTile = document.createElement('canvas');
  farTile.width = 1024;
  farTile.height = 512;
  {
    const c = farTile.getContext('2d')!;
    const fr = mulberry32(42);
    if (theme === 'rooftop') {
      // 高空視角：底部城市燈海
      for (let i = 0; i < 400; i++) {
        c.fillStyle = `rgba(${180 + fr() * 75}, ${140 + fr() * 80}, ${60 + fr() * 60}, ${0.25 + fr() * 0.5})`;
        c.fillRect(fr() * 1024, 380 + fr() * 132, 1.5 + fr() * 2, 1.5 + fr() * 2);
      }
    } else {
      let x = 0;
      while (x < 1024) {
        const bw = 60 + fr() * 110;
        const bh = 130 + fr() * 240;
        c.fillStyle = spec.farColor;
        c.fillRect(x, 512 - bh, bw, bh);
        // 點燈窗
        c.fillStyle = 'rgba(255, 220, 140, 0.35)';
        for (let wy = 512 - bh + 12; wy < 500; wy += 22) {
          for (let wx = x + 8; wx < x + bw - 10; wx += 18) {
            if (fr() > 0.55) c.fillRect(wx, wy, 7, 10);
          }
        }
        x += bw + 6 + fr() * 30;
      }
      if (theme === 'skybridge' || theme === 'neon') {
        // 台北 101 剪影
        const cx = 700;
        c.fillStyle = spec.farColor;
        for (let i = 0; i < 8; i++) {
          const sw = 64 - i * 5.5;
          c.beginPath();
          c.moveTo(cx - sw / 2 - 5, 512 - 60 - i * 42);
          c.lineTo(cx + sw / 2 + 5, 512 - 60 - i * 42);
          c.lineTo(cx + sw / 2 - 4, 512 - 60 - (i + 1) * 42);
          c.lineTo(cx - sw / 2 + 4, 512 - 60 - (i + 1) * 42);
          c.closePath();
          c.fill();
        }
        c.fillRect(cx - 3, 512 - 60 - 8 * 42 - 50, 6, 50); // 塔尖
        c.fillStyle = 'rgba(120, 200, 255, 0.5)';
        c.fillRect(cx - 2, 512 - 60 - 8 * 42 - 50, 4, 6); // 警示燈
      }
      if (theme === 'temple') {
        // 廟宇燕尾脊剪影
        c.fillStyle = '#1a1226';
        c.beginPath();
        c.moveTo(80, 360);
        c.quadraticCurveTo(230, 290, 400, 355);
        c.quadraticCurveTo(420, 300, 445, 290);
        c.lineTo(400, 380);
        c.lineTo(95, 380);
        c.quadraticCurveTo(65, 300, 40, 288);
        c.closePath();
        c.fill();
        c.fillRect(80, 370, 330, 142);
      }
    }
  }

  const protectTarget = theme === 'temple' ? new Vec3(length * 0.5, 0, 1.0) : null;
  const star = mulberry32(7);
  const stars: [number, number, number][] = Array.from({ length: 90 }, () => [star() * 2000, star() * 300, 0.4 + star() * 1.4]);
  const _gv = new Vec3();

  const env: Environment = {
    length,
    bounds: { minX: 0.6, maxX: length - 0.6, minZ: 0.4, maxZ: DEPTH - 0.2 },
    protectTarget,
    update() { /* 動畫全在 draw 內以 elapsed 驅動 */ },

    drawBackground(ctx, cam, w, h, elapsed) {
      const gTop = cam.groundTopY;
      // 1) 天空
      const sky = ctx.createLinearGradient(0, 0, 0, gTop);
      sky.addColorStop(0, spec.skyTop);
      sky.addColorStop(1, spec.skyBottom);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, gTop + 2);
      if (theme === 'rooftop' || theme === 'temple') {
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        for (const [sx, sy, sr] of stars) {
          const px = ((sx + cam.parallaxOffset(0.05)) % (w + 100) + w + 100) % (w + 100) - 50;
          ctx.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(elapsed * 0.8 + sx));
          ctx.fillRect(px, sy * (gTop / 300), sr, sr);
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#f5edd8';
        ctx.beginPath();
        ctx.arc(w * 0.78, gTop * 0.22, 26, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2) 遠景剪影（視差 0.25）
      const farH = gTop * 0.72;
      const farY = gTop - farH;
      const off = cam.parallaxOffset(0.25);
      const tw = farTile.width * (farH / farTile.height);
      let fx = ((off % tw) + tw) % tw - tw;
      while (fx < w) {
        ctx.drawImage(farTile, fx, farY, tw, farH);
        fx += tw;
      }

      // 3) 地面
      const ground = ctx.createLinearGradient(0, gTop, 0, h);
      ground.addColorStop(0, spec.groundLine);
      ground.addColorStop(0.12, spec.ground);
      ground.addColorStop(1, shade(spec.ground, -18));
      ctx.fillStyle = ground;
      ctx.fillRect(0, gTop, w, h - gTop);
      // 地面縱向格線（透視感）
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 2;
      const m = cam.ppm;
      const startX = Math.floor((cam.x - cam.halfW) / 4) * 4;
      for (let gx = startX; gx < cam.x + cam.halfW + 4; gx += 4) {
        const top = cam.worldToScreen(_gv.set(gx, 0, 0));
        const topX = top.x, topY = top.y;
        const bot = cam.worldToScreen(_gv.set(gx, 0, DEPTH));
        ctx.beginPath();
        ctx.moveTo(topX, topY);
        ctx.lineTo(bot.x, bot.y);
        ctx.stroke();
      }
      if (theme === 'rooftop') drawHelipad(ctx, cam, length);

      // 4) 中景道具（街面後緣 z=0）
      const viewMin = cam.x - cam.halfW - 8;
      const viewMax = cam.x + cam.halfW + 8;
      for (const p of props) {
        if (p.x < viewMin || p.x > viewMax) continue;
        const base = cam.worldToScreen(_gv.set(p.x, 0, 0));
        drawProp(ctx, p, base.x, base.y, m * 0.74, elapsed);
      }
      // 香爐（protect 目標）
      if (protectTarget) {
        const b = cam.worldToScreen(protectTarget);
        drawBurner(ctx, b.x, b.y, m * b.scale, elapsed);
      }
    },

    drawForeground(ctx, cam, w, h, elapsed) {
      // 前景電線（台北天際的亂線）
      if (theme === 'neon' || theme === 'nightmarket' || theme === 'temple') {
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.lineWidth = 3;
        const off = cam.parallaxOffset(1.25);
        for (let i = 0; i < 2; i++) {
          const y0 = h * (0.08 + i * 0.05);
          ctx.beginPath();
          for (let px = -50; px <= w + 50; px += 40) {
            const sag = Math.sin((px - off) * 0.012 + i * 2) * 14;
            if (px === -50) ctx.moveTo(px, y0 + sag);
            else ctx.lineTo(px, y0 + sag);
          }
          ctx.stroke();
        }
      }
      if (theme === 'rooftop') {
        // 風：橫向速度線
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 5; i++) {
          const y = (elapsed * 90 + i * 137) % h;
          const x = w - ((elapsed * 600 + i * 450) % (w + 300));
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 160, y);
          ctx.stroke();
        }
      }
      // 暈影
      const v = ctx.createRadialGradient(w / 2, h / 2, h * 0.45, w / 2, h / 2, h * 0.95);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, 'rgba(0,0,0,0.4)');
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, w, h);
    },
  };
  return env;
}

function shade(hexColor: string, amt: number): string {
  const n = parseInt(hexColor.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

const NEON_PALETTE = ['#ff4d6d', '#00d4ff', '#ffd23f', '#7b2fff', '#3ddc97'];

/** 中景道具：bx/by = 道具世界 x 於 z=0 的螢幕座標，m = px/公尺 */
function drawProp(ctx: CanvasRenderingContext2D, p: Prop, bx: number, by: number, m: number, t: number): void {
  ctx.save();
  ctx.translate(bx, by);
  const v = p.variant;
  switch (p.kind) {
    case 'storefront': {
      // 騎樓店面 + 直式霓虹招牌
      const sw = m * 4.6, sh = m * 3.4;
      ctx.fillStyle = shade('#2c2438', Math.floor(v * 24) - 12);
      ctx.fillRect(-sw / 2, -sh, sw, sh);
      ctx.strokeStyle = '#15120f';
      ctx.lineWidth = 3;
      ctx.strokeRect(-sw / 2, -sh, sw, sh);
      // 騎樓柱
      ctx.fillStyle = '#241e30';
      ctx.fillRect(-sw / 2, -sh, m * 0.32, sh);
      ctx.fillRect(sw / 2 - m * 0.32, -sh, m * 0.32, sh);
      // 店口燈光
      ctx.fillStyle = `rgba(255, 226, 150, ${0.16 + v * 0.12})`;
      ctx.fillRect(-sw / 2 + m * 0.4, -sh * 0.62, sw - m * 0.8, sh * 0.62);
      // 直式霓虹招牌
      if (p.text) {
        const neon = NEON_PALETTE[Math.floor(v * NEON_PALETTE.length)];
        const flick = Math.sin(t * 7 + v * 40) > -0.85 ? 1 : 0.35;
        const signW = m * 0.85;
        const chars = [...p.text].slice(0, 4);
        const signH = chars.length * m * 0.78 + m * 0.3;
        const sx = (v - 0.5) * sw * 0.5;
        ctx.fillStyle = '#181421';
        ctx.fillRect(sx - signW / 2, -sh - signH, signW, signH);
        ctx.strokeStyle = neon;
        ctx.globalAlpha = flick;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(sx - signW / 2, -sh - signH, signW, signH);
        ctx.fillStyle = neon;
        ctx.font = `900 ${m * 0.62}px 'Noto Sans TC', sans-serif`;
        ctx.textAlign = 'center';
        ctx.shadowColor = neon;
        ctx.shadowBlur = 12 * flick;
        chars.forEach((ch, i) => {
          ctx.fillText(ch, sx, -sh - signH + m * (0.78 * (i + 1)));
        });
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }
      break;
    }
    case 'stall': {
      // 夜市攤車：攤台 + 帆布頂 + 招牌 + 燈泡串 + 蒸氣
      const sw = m * 3.6, sh = m * 2.1;
      const cols = ['#a33327', '#b8842c', '#356b44', '#7a3b8f'];
      const cc = cols[Math.floor(v * cols.length)];
      ctx.fillStyle = '#241c14';
      ctx.fillRect(-sw / 2, -sh * 0.55, sw, sh * 0.55);
      ctx.strokeStyle = '#15120f';
      ctx.lineWidth = 3;
      ctx.strokeRect(-sw / 2, -sh * 0.55, sw, sh * 0.55);
      ctx.fillStyle = cc;
      ctx.beginPath();
      ctx.moveTo(-sw / 2 - m * 0.3, -sh);
      ctx.lineTo(sw / 2 + m * 0.3, -sh);
      ctx.lineTo(sw / 2 + m * 0.15, -sh * 0.72);
      ctx.lineTo(-sw / 2 - m * 0.15, -sh * 0.72);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (p.text) {
        ctx.fillStyle = '#fff3da';
        ctx.font = `900 ${m * 0.42}px 'Noto Sans TC', sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(p.text.slice(0, 5), 0, -sh * 0.8);
      }
      for (let i = -1; i <= 1; i++) {
        const lx = i * sw * 0.3;
        const sway = Math.sin(t * 2 + v * 10 + i) * 2;
        ctx.fillStyle = '#ffdd88';
        ctx.shadowColor = '#ffbb44';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(lx + sway, -sh * 0.66, m * 0.09, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      const sy = (t * 30 + v * 100) % 40;
      ctx.beginPath();
      ctx.arc((v - 0.5) * sw * 0.5, -sh * 0.6 - sy, m * (0.18 + sy / 90), 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'lanternString': {
      for (let i = -2; i <= 2; i++) {
        const lx = i * m * 1.1;
        const sway = Math.sin(t * 1.8 + v * 20 + i * 0.7) * 3;
        ctx.fillStyle = '#cf2f2f';
        ctx.shadowColor = '#ff5533';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.ellipse(lx + sway, -m * 3.1, m * 0.22, m * 0.27, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#e8b84a';
        ctx.fillRect(lx + sway - m * 0.06, -m * 3.45, m * 0.12, m * 0.08);
      }
      break;
    }
    case 'lantern': {
      const sway = Math.sin(t * 1.6 + v * 30) * 3;
      ctx.strokeStyle = '#15120f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -m * 3.6);
      ctx.lineTo(sway, -m * 3.1);
      ctx.stroke();
      ctx.fillStyle = '#cf2f2f';
      ctx.shadowColor = '#ff6644';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.ellipse(sway, -m * 2.75, m * 0.3, m * 0.36, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#7a1d1d';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sway - m * 0.28, -m * 2.75);
      ctx.lineTo(sway + m * 0.28, -m * 2.75);
      ctx.stroke();
      break;
    }
    case 'pillar': {
      ctx.fillStyle = '#8f2b22';
      ctx.fillRect(-m * 0.22, -m * 3.6, m * 0.44, m * 3.6);
      ctx.strokeStyle = '#15120f';
      ctx.lineWidth = 3;
      ctx.strokeRect(-m * 0.22, -m * 3.6, m * 0.44, m * 3.6);
      ctx.fillStyle = '#b8842c';
      ctx.fillRect(-m * 0.3, -m * 3.75, m * 0.6, m * 0.18);
      break;
    }
    case 'scooter': {
      // 路邊機車（台灣街景靈魂）
      const c = ['#4a6b8a', '#7a4a52', '#5a7a4a', '#888888'][Math.floor(v * 4)];
      ctx.scale(v > 0.5 ? 1 : -1, 1);
      ctx.fillStyle = '#15120f';
      ctx.beginPath();
      ctx.arc(-m * 0.45, -m * 0.18, m * 0.18, 0, Math.PI * 2);
      ctx.arc(m * 0.45, -m * 0.18, m * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(-m * 0.5, -m * 0.35);
      ctx.quadraticCurveTo(0, -m * 0.2, m * 0.3, -m * 0.4);
      ctx.lineTo(m * 0.55, -m * 0.75);
      ctx.lineTo(m * 0.62, -m * 0.4);
      ctx.lineTo(m * 0.5, -m * 0.3);
      ctx.quadraticCurveTo(0, -m * 0.05, -m * 0.45, -m * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#15120f';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = '#222222';
      ctx.fillRect(-m * 0.42, -m * 0.62, m * 0.5, m * 0.14);
      break;
    }
    case 'lamp': {
      ctx.fillStyle = '#3a3f4a';
      ctx.fillRect(-m * 0.07, -m * 3.8, m * 0.14, m * 3.8);
      ctx.strokeStyle = '#15120f';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(-m * 0.07, -m * 3.8, m * 0.14, m * 3.8);
      ctx.fillStyle = '#ffe9b0';
      ctx.shadowColor = '#ffd980';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.ellipse(m * 0.32, -m * 3.75, m * 0.26, m * 0.13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      break;
    }
    case 'glasspanel': {
      const gw = m * 5, gh = m * 3.8;
      const grad = ctx.createLinearGradient(-gw / 2, -gh, gw / 2, 0);
      grad.addColorStop(0, '#16263e');
      grad.addColorStop(0.5, '#1f3858');
      grad.addColorStop(1, '#14223a');
      ctx.fillStyle = grad;
      ctx.fillRect(-gw / 2, -gh, gw, gh);
      ctx.strokeStyle = '#15120f';
      ctx.lineWidth = 3;
      ctx.strokeRect(-gw / 2, -gh, gw, gh);
      ctx.strokeStyle = 'rgba(140,190,240,0.25)';
      ctx.lineWidth = 1.5;
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(-gw / 2 + (gw / 4) * i, -gh);
        ctx.lineTo(-gw / 2 + (gw / 4) * i, 0);
        ctx.stroke();
      }
      break;
    }
    case 'billboard': {
      const bw = m * 2.6, bh = m * 1.5;
      const cycle = Math.floor(t / 2 + v * 5) % 2 === 0;
      ctx.fillStyle = '#0c0f16';
      ctx.fillRect(-bw / 2, -m * 3.4 - bh, bw, bh);
      ctx.strokeStyle = '#15120f';
      ctx.lineWidth = 3;
      ctx.strokeRect(-bw / 2, -m * 3.4 - bh, bw, bh);
      ctx.fillStyle = cycle ? '#00d4ff' : '#ff4d6d';
      ctx.globalAlpha = 0.85;
      ctx.font = `900 ${m * 0.6}px 'Noto Sans TC', sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(p.text ?? 'SALE', 0, -m * 3.4 - bh * 0.32);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#3a3f4a';
      ctx.fillRect(-m * 0.08, -m * 3.4, m * 0.16, m * 3.4);
      break;
    }
    case 'vent': {
      ctx.fillStyle = '#2e3138';
      ctx.fillRect(-m * 0.9, -m * 1.1, m * 1.8, m * 1.1);
      ctx.strokeStyle = '#15120f';
      ctx.lineWidth = 3;
      ctx.strokeRect(-m * 0.9, -m * 1.1, m * 1.8, m * 1.1);
      ctx.strokeStyle = '#1c1e24';
      ctx.lineWidth = 2;
      for (let i = 1; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(-m * 0.85, -m * 1.1 + (m * 1.05 / 5) * i);
        ctx.lineTo(m * 0.85, -m * 1.1 + (m * 1.05 / 5) * i);
        ctx.stroke();
      }
      break;
    }
    case 'beacon': {
      const pulse = (Math.sin(t * 2.5 + v * 10) + 1) / 2;
      ctx.fillStyle = '#3a3f4a';
      ctx.fillRect(-m * 0.05, -m * 1.6, m * 0.1, m * 1.6);
      ctx.fillStyle = `rgba(255, 60, 60, ${0.4 + pulse * 0.6})`;
      ctx.shadowColor = '#ff3030';
      ctx.shadowBlur = 18 * pulse;
      ctx.beginPath();
      ctx.arc(0, -m * 1.7, m * 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      break;
    }
  }
  ctx.restore();
}

/** 龍山寺香爐（protect 目標） */
function drawBurner(ctx: CanvasRenderingContext2D, bx: number, by: number, m: number, t: number): void {
  ctx.save();
  ctx.translate(bx, by);
  ctx.strokeStyle = '#15120f';
  ctx.lineWidth = 3.5;
  for (const lx of [-m * 0.4, m * 0.4]) {
    ctx.fillStyle = '#665827';
    ctx.fillRect(lx - m * 0.07, -m * 0.4, m * 0.14, m * 0.4);
  }
  ctx.fillStyle = '#7a6a35';
  ctx.beginPath();
  ctx.ellipse(0, -m * 0.75, m * 0.66, m * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#665827';
  ctx.beginPath();
  ctx.ellipse(0, -m * 1.18, m * 0.6, m * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // 香 + 火點 + 裊裊煙
  for (const ix of [-m * 0.18, 0, m * 0.18]) {
    ctx.strokeStyle = '#8f2b22';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(ix, -m * 1.2);
    ctx.lineTo(ix * 1.3, -m * 1.7);
    ctx.stroke();
    ctx.fillStyle = '#ff8844';
    ctx.beginPath();
    ctx.arc(ix * 1.3, -m * 1.72, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(230,230,230,0.14)';
  for (let i = 0; i < 3; i++) {
    const sy = (t * 22 + i * 33) % 70;
    ctx.beginPath();
    ctx.arc(Math.sin(t * 1.5 + i * 2) * 6, -m * 1.8 - sy, 4 + sy / 9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** 101 頂樓直升機坪 */
function drawHelipad(ctx: CanvasRenderingContext2D, cam: GameCamera, length: number): void {
  const c = cam.worldToScreen(new Vec3(length * 0.75, 0, DEPTH / 2));
  const rx = cam.ppm * 4.4;
  const ry = cam.ppm * 1.5;
  ctx.strokeStyle = 'rgba(255,210,63,0.5)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = `900 ${cam.ppm * 1.8}px 'Noto Sans TC', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,210,63,0.45)';
  ctx.fillText('H', c.x, c.y);
  ctx.textBaseline = 'alphabetic';
}
