// 通關全劇結局畫面：完成第五關後觸發。
// 大標題 + 全 5 關評價總覽 + 總金錢/技能點 + 紙屑慶祝特效 + 「重新開始 / 自由模式」按鈕。
import type { EndingAPI, LevelId, LevelRank } from '../types';
import { ensureStyles, uiRoot, el } from './styles';
import { playSound } from '../core/audio';

const LEVEL_NAMES: Record<LevelId, string> = {
  1: '西門町', 2: '士林夜市', 3: '龍山寺', 4: '信義空橋', 5: '台北 101',
};

export function createEnding(): EndingAPI {
  ensureStyles();
  ensureEndingStyles();

  const screen = el('div', 'tsb-screen tsb-ending-screen');
  screen.style.display = 'none';
  uiRoot().append(screen);

  // 慶祝畫布（紙屑/煙火）
  const fxCanvas = document.createElement('canvas');
  fxCanvas.className = 'tsb-ending-fx';
  screen.append(fxCanvas);

  let fxStop: (() => void) | null = null;

  return {
    show(opts) {
      screen.innerHTML = '';
      screen.append(fxCanvas);

      // 內容容器
      const wrap = el('div', 'tsb-ending-wrap');

      // 大標題
      const headline = el('div', 'tsb-ending-headline');
      const ja = el('h1', 'tsb-ending-title', '正義已伸張');
      const en = el('p', 'tsb-ending-sub', 'TAIPEI SAVED — 五大戰場，全線淨化');
      headline.append(ja, en);

      // 五關評價列
      const ranks = el('div', 'tsb-ending-ranks');
      ([1, 2, 3, 4, 5] as LevelId[]).forEach((id, idx) => {
        const r: LevelRank | undefined = id === 5 ? opts.finalRank : opts.save.clearedRanks[id];
        const card = el('div', 'tsb-ending-rank-card');
        if (r) card.classList.add(`tsb-ending-rank--${r}`);
        const idxBadge = el('div', 'tsb-ending-rank-no', String(idx + 1));
        const nameTxt = el('div', 'tsb-ending-rank-name', LEVEL_NAMES[id]);
        const rankBig = el('div', 'tsb-ending-rank-letter', r ?? '?');
        card.append(idxBadge, nameTxt, rankBig);
        ranks.append(card);
      });

      // 總計
      const totals = el('div', 'tsb-ending-totals');
      const moneyEl = el('div', 'tsb-ending-total',
        `💰 累積資金　NT$ ${(opts.save.money + opts.finalMoneyEarned).toLocaleString()}`);
      const spEl = el('div', 'tsb-ending-total',
        `✨ 技能總點　${opts.save.skillPoints + opts.finalSkillPointsEarned} 點`);
      const teaEl = el('div', 'tsb-ending-total',
        `🧋 珍奶剩餘　${opts.save.bubbleTeaCount} / 3`);
      const bestRank = computeOverallRank(opts.save, opts.finalRank);
      const overallEl = el('div', 'tsb-ending-overall', `綜合評級　${bestRank}`);
      overallEl.classList.add(`tsb-ending-overall--${bestRank}`);
      totals.append(overallEl, moneyEl, spEl, teaEl);

      // 致謝詞
      const credits = el('div', 'tsb-ending-credits');
      credits.innerHTML = `
        <p>從西門紅樓到 101 頂樓，城市的暗影被一雙拳頭擊退。</p>
        <p class="tsb-ending-credits-sub">感謝你陪西裝男走完這條夜路。</p>
      `;

      // 按鈕
      const btnRow = el('div', 'tsb-ending-btns');
      const freeBtn = el('button', 'tsb-btn', '🎮 自由模式');
      const restartBtn = el('button', 'tsb-btn tsb-btn--accent', '↻ 重新開始');
      freeBtn.addEventListener('click', () => { playSound('uiClick'); opts.onFreeplay(); });
      restartBtn.addEventListener('click', () => {
        if (!confirm('重新開始將清空所有進度與存檔，確定嗎？')) return;
        playSound('uiBack');
        opts.onRestart();
      });
      btnRow.append(freeBtn, restartBtn);

      wrap.append(headline, ranks, totals, credits, btnRow);
      screen.append(wrap);
      screen.style.display = 'flex';

      // 觸發慶祝音效
      playSound('fanfare');
      setTimeout(() => playSound('cheer'), 400);
      setTimeout(() => playSound('fanfare'), 1100);

      // 啟動紙屑/煙火
      fxStop = startConfetti(fxCanvas);
    },
    hide() {
      screen.style.display = 'none';
      fxStop?.();
      fxStop = null;
    },
  };
}

function computeOverallRank(save: { clearedRanks: Partial<Record<LevelId, LevelRank>> }, lv5: LevelRank): LevelRank {
  const order: LevelRank[] = ['C', 'B', 'A', 'S'];
  const all: LevelRank[] = [];
  ([1, 2, 3, 4] as LevelId[]).forEach((id) => { if (save.clearedRanks[id]) all.push(save.clearedRanks[id]!); });
  all.push(lv5);
  // 取平均（向下取整）
  const sum = all.reduce((s, r) => s + order.indexOf(r), 0);
  const avg = Math.floor(sum / all.length);
  return order[Math.max(0, Math.min(3, avg))];
}

/** 慶祝紙屑 + 煙火 */
function startConfetti(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext('2d')!;
  let raf = 0;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const resize = () => {
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize);

  const PALETTE = ['#FFD23F', '#FF6B35', '#00D4FF', '#7B2FFF', '#3ddc97', '#ff4d6d'];
  type P = { x: number; y: number; vx: number; vy: number; rot: number; vr: number; col: string; size: number; life: number };
  const particles: P[] = [];
  // 火花
  type Spark = { x: number; y: number; t: number; max: number; col: string; r: number };
  const sparks: Spark[] = [];

  const spawnConfetti = (n: number): void => {
    for (let i = 0; i < n; i++) {
      particles.push({
        x: Math.random() * window.innerWidth,
        y: -10 - Math.random() * 100,
        vx: (Math.random() - 0.5) * 80,
        vy: 60 + Math.random() * 120,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 8,
        col: PALETTE[Math.floor(Math.random() * PALETTE.length)],
        size: 6 + Math.random() * 8,
        life: 6 + Math.random() * 4,
      });
    }
  };
  const spawnFirework = (): void => {
    const cx = window.innerWidth * (0.2 + Math.random() * 0.6);
    const cy = window.innerHeight * (0.25 + Math.random() * 0.35);
    const col = PALETTE[Math.floor(Math.random() * PALETTE.length)];
    sparks.push({ x: cx, y: cy, t: 0, max: 0.9, col, r: 0 });
  };

  spawnConfetti(80);
  let last = performance.now();
  let acc = 0;
  let fwAcc = 0;
  const loop = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    acc += dt;
    fwAcc += dt;
    if (acc > 0.6 && particles.length < 200) { acc = 0; spawnConfetti(20); }
    if (fwAcc > 0.7) { fwAcc = 0; spawnFirework(); }

    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    // 紙屑
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.vy += 60 * dt; // 重力
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      p.life -= dt;
      if (p.life <= 0 || p.y > window.innerHeight + 20) { particles.splice(i, 1); continue; }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.col;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }

    // 煙火
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.t += dt;
      if (s.t >= s.max) { sparks.splice(i, 1); continue; }
      const p = s.t / s.max;
      const r = 50 + p * 130;
      ctx.save();
      ctx.globalAlpha = 1 - p;
      for (let a = 0; a < 18; a++) {
        const ang = (a / 18) * Math.PI * 2;
        const px = s.x + Math.cos(ang) * r;
        const py = s.y + Math.sin(ang) * r + p * 50;
        ctx.fillStyle = s.col;
        ctx.beginPath(); ctx.arc(px, py, 2.4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
  };
}

function ensureEndingStyles(): void {
  if (document.getElementById('tsb-ending-style')) return;
  const s = document.createElement('style');
  s.id = 'tsb-ending-style';
  s.textContent = `
    .tsb-ending-screen { background: radial-gradient(ellipse at center, rgba(123,47,255,0.18) 0%, rgba(13,17,23,0.95) 60%, rgba(0,0,0,0.98) 100%); }
    .tsb-ending-fx { position: absolute; inset: 0; pointer-events: none; }
    .tsb-ending-wrap { position: relative; z-index: 2; max-width: 980px; width: 92vw; display: flex; flex-direction: column; gap: 20px; align-items: center; padding: 24px; }
    .tsb-ending-headline { text-align: center; }
    .tsb-ending-title { font-size: 64px; margin: 0; font-weight: 900; letter-spacing: 0.3em; color: #FFD23F;
      text-shadow: 0 0 30px rgba(255,210,63,0.7), 0 4px 6px rgba(0,0,0,0.8);
      animation: tsb-ending-glow 2.5s ease-in-out infinite; }
    @keyframes tsb-ending-glow { 0%,100% { text-shadow: 0 0 30px rgba(255,210,63,0.7), 0 4px 6px rgba(0,0,0,0.8); } 50% { text-shadow: 0 0 50px rgba(255,210,63,1), 0 0 80px rgba(255,107,53,0.8), 0 4px 6px rgba(0,0,0,0.8); } }
    .tsb-ending-sub { font-size: 14px; letter-spacing: 0.34em; color: rgba(230,237,243,0.7); margin: 8px 0 0; }
    .tsb-ending-ranks { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; width: 100%; max-width: 720px; }
    .tsb-ending-rank-card { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 12px 6px;
      background: rgba(13,17,23,0.7); border: 1px solid rgba(0,212,255,0.3); border-radius: 10px; }
    .tsb-ending-rank-no { width: 22px; height: 22px; border-radius: 50%; background: rgba(0,212,255,0.2); border: 1px solid var(--tsb-primary); color: var(--tsb-primary); font-weight: 900; font-size: 11px; display: flex; align-items: center; justify-content: center; }
    .tsb-ending-rank-name { font-size: 12px; font-weight: 700; color: var(--tsb-text); }
    .tsb-ending-rank-letter { font-size: 38px; font-weight: 900; line-height: 1; margin-top: 2px; }
    .tsb-ending-rank--S .tsb-ending-rank-letter { color: #FFD23F; text-shadow: 0 0 14px rgba(255,210,63,0.8); }
    .tsb-ending-rank--A .tsb-ending-rank-letter { color: #E8ECF2; text-shadow: 0 0 10px rgba(232,236,242,0.6); }
    .tsb-ending-rank--B .tsb-ending-rank-letter { color: #D08A4E; }
    .tsb-ending-rank--C .tsb-ending-rank-letter { color: #9BA7B8; }
    .tsb-ending-totals { display: flex; flex-direction: column; gap: 6px; align-items: center; margin-top: 4px; }
    .tsb-ending-overall { font-size: 22px; font-weight: 900; letter-spacing: 0.3em; padding: 6px 22px; border-radius: 22px; border: 2px solid; }
    .tsb-ending-overall--S { color: #FFD23F; border-color: #FFD23F; box-shadow: 0 0 26px rgba(255,210,63,0.7); }
    .tsb-ending-overall--A { color: #E8ECF2; border-color: #E8ECF2; box-shadow: 0 0 16px rgba(232,236,242,0.5); }
    .tsb-ending-overall--B { color: #D08A4E; border-color: #D08A4E; }
    .tsb-ending-overall--C { color: #9BA7B8; border-color: #9BA7B8; }
    .tsb-ending-total { font-size: 15px; color: rgba(230,237,243,0.85); letter-spacing: 0.1em; }
    .tsb-ending-credits { text-align: center; max-width: 600px; color: rgba(230,237,243,0.75); font-size: 14px; line-height: 1.7; }
    .tsb-ending-credits-sub { color: rgba(230,237,243,0.5); font-size: 12px; margin-top: 4px; }
    .tsb-ending-credits p { margin: 4px 0; }
    .tsb-ending-btns { display: flex; gap: 16px; margin-top: 4px; }
    .tsb-ending-btns .tsb-btn { min-width: 160px; font-size: 16px; }
  `;
  document.head.append(s);
}
