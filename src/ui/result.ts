// 結算畫面 — 成功：評價徽章 + 金錢/技能點滾動結算；失敗：重試 / 回地圖。

import type { ResultAPI } from '../types';
import { ensureStyles, uiRoot, el } from './styles';

/** 數字滾動動畫 */
function countUp(node: HTMLElement, to: number, prefix: string, suffix = '', durationMs = 900): void {
  const start = performance.now();
  function tick(now: number): void {
    const t = Math.min(1, (now - start) / durationMs);
    const eased = 1 - Math.pow(1 - t, 3);
    node.textContent = `${prefix}${Math.round(to * eased).toLocaleString('zh-TW')}${suffix}`;
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

export function createResult(): ResultAPI {
  ensureStyles();

  const screen = el('div', 'tsb-screen');
  screen.style.display = 'none';
  uiRoot().append(screen);

  return {
    show(opts) {
      screen.innerHTML = '';

      const panel = el('div', 'tsb-panel');
      panel.style.cssText = 'width:min(520px,90vw);text-align:center;padding:36px 40px;';

      if (opts.success) {
        const big = el('h1', 'tsb-title-glow', '任務完成');
        big.style.cssText = 'margin:0;font-size:48px;font-weight:900;letter-spacing:0.3em;';
        const levelName = el('p', '', `— ${opts.levelName} —`);
        levelName.style.cssText = 'margin:8px 0 0;font-size:15px;color:rgba(230,237,243,0.7);letter-spacing:0.2em;';
        panel.append(big, levelName);

        if (opts.rank) {
          const badge = el('div', `tsb-result-rank tsb-result-rank--${opts.rank}`, opts.rank);
          panel.append(badge);
        }

        const stats = el('div', 'tsb-result-stats');
        const moneyRow = el('div');
        const moneyNum = el('span', 'tsb-num', 'NT$ 0');
        moneyRow.append(document.createTextNode('💰 賞金入帳　'), moneyNum);
        const spRow = el('div');
        const spNum = el('span', 'tsb-num', '0 點');
        spRow.append(document.createTextNode('✨ 技能點　'), spNum);
        stats.append(moneyRow, spRow);
        panel.append(stats);

        countUp(moneyNum, opts.moneyEarned, 'NT$ ');
        countUp(spNum, opts.skillPointsEarned, '', ' 點');

        const contBtn = el('button', 'tsb-btn tsb-btn--accent', '前往夜市補給');
        contBtn.addEventListener('click', opts.onContinue);
        panel.append(contBtn);
      } else {
        const big = el('h1', '', '正義尚未伸張');
        big.style.cssText =
          'margin:0;font-size:42px;font-weight:900;letter-spacing:0.25em;color:#FF6B35;text-shadow:0 0 16px rgba(255,107,53,0.7);';
        const sub = el('p', '', `${opts.levelName}　——　西裝皺了，但骨氣還在。`);
        sub.style.cssText = 'margin:14px 0 26px;font-size:15px;color:rgba(230,237,243,0.7);';
        panel.append(big, sub);

        const btnRow = el('div');
        btnRow.style.cssText = 'display:flex;justify-content:center;gap:16px;';
        const retryBtn = el('button', 'tsb-btn tsb-btn--accent', '↻ 再戰一次');
        retryBtn.addEventListener('click', () => (opts.onRetry ?? opts.onContinue)());
        const mapBtn = el('button', 'tsb-btn tsb-btn--ghost', '🗺 回路線圖');
        mapBtn.addEventListener('click', () => (opts.onMap ?? opts.onContinue)());
        btnRow.append(retryBtn, mapBtn);
        panel.append(btnRow);
      }

      screen.append(panel);
      screen.style.display = 'flex';
    },
    hide() {
      screen.style.display = 'none';
    },
  };
}
