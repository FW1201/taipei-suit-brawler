// 標題畫面 — 霓虹 LOGO + 開始 / 繼續 + 操作說明。

import type { TitleAPI } from '../types';
import { ensureStyles, uiRoot, el } from './styles';

const CONTROLS: Array<[string, string]> = [
  ['WASD', '移動'],
  ['J', '輕拳'],
  ['K', '重拳'],
  ['Space', '閃避'],
  ['L', '必殺'],
  ['E', '喝珍奶'],
];

export function createTitle(): TitleAPI {
  ensureStyles();

  const screen = el('div', 'tsb-screen');
  screen.style.display = 'none';
  uiRoot().append(screen);

  return {
    show(onStart, hasSave, onContinue) {
      screen.innerHTML = '';

      const wrap = el('div');
      wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:26px;text-align:center;';

      const logo = el('h1', 'tsb-title-logo tsb-title-glow', '西裝正義');
      const sub = el('p', 'tsb-title-sub', 'TAIPEI SUIT BRAWLER');
      const tagline = el('p', '', '雙拳主持正義・台北五大戰場');
      tagline.style.cssText = 'margin:0;font-size:15px;color:rgba(230,237,243,0.7);letter-spacing:0.2em;';

      const btnRow = el('div');
      btnRow.style.cssText = 'display:flex;gap:18px;margin-top:8px;';

      const startBtn = el('button', 'tsb-btn tsb-btn--accent', '開始遊戲');
      startBtn.addEventListener('click', onStart);
      btnRow.append(startBtn);

      if (hasSave) {
        const contBtn = el('button', 'tsb-btn', '繼續');
        contBtn.addEventListener('click', onContinue);
        btnRow.append(contBtn);
      }

      const controls = el('div', 'tsb-title-controls');
      for (const [key, label] of CONTROLS) {
        const item = el('div');
        const k = el('span', 'tsb-key', key);
        item.append(k, document.createTextNode(` ${label}`));
        controls.append(item);
      }
      const controlsPanel = el('div', 'tsb-panel');
      controlsPanel.style.cssText = 'padding:14px 22px;margin-top:10px;';
      const controlsTitle = el('div', '', '操作說明');
      controlsTitle.style.cssText = 'font-size:12px;letter-spacing:0.4em;color:#00D4FF;margin-bottom:10px;font-weight:700;';
      controlsPanel.append(controlsTitle, controls);

      // 素材署名（CC-BY 要求）
      const credits = el(
        'div',
        '',
        '素材：Kenney.nl（CC0）・Quaternius（CC0）・"White Taipei 101" by Elaine Wijaya Oey（CC-BY 3.0）',
      );
      credits.style.cssText = 'font-size:10px;color:#5a6470;margin-top:14px;letter-spacing:0.05em;';

      wrap.append(logo, sub, tagline, btnRow, controlsPanel, credits);
      screen.append(wrap);
      screen.style.display = 'flex';
    },
    hide() {
      screen.style.display = 'none';
    },
  };
}
