// 關卡選擇 — 台北捷運路線圖風格：五站沿霓虹路線排列。

import type { LevelMapAPI, LevelId, LevelRank } from '../types';
import { ensureStyles, uiRoot, el } from './styles';

interface StationMeta {
  id: LevelId;
  station: string;   // 捷運站名
  levelName: string; // 戰場名
}

const STATIONS: StationMeta[] = [
  { id: 1, station: '西門', levelName: '西門町' },
  { id: 2, station: '劍潭／士林', levelName: '士林夜市' },
  { id: 3, station: '龍山寺', levelName: '龍山寺' },
  { id: 4, station: '台北101／世貿', levelName: '信義商圈' },
  { id: 5, station: '101 頂樓', levelName: '最終決戰' },
];

export function createLevelMap(): LevelMapAPI {
  ensureStyles();

  const screen = el('div', 'tsb-screen');
  screen.style.display = 'none';
  uiRoot().append(screen);

  return {
    show(opts) {
      screen.innerHTML = '';

      const wrap = el('div');
      wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:34px;width:100%;';

      const header = el('div');
      header.style.cssText = 'text-align:center;';
      const title = el('h2', 'tsb-title-glow', '正義路線圖');
      title.style.cssText = 'margin:0;font-size:38px;font-weight:900;letter-spacing:0.25em;';
      const sub = el('p', '', 'TAIPEI JUSTICE LINE — 選擇你的戰場');
      sub.style.cssText = 'margin:6px 0 0;font-size:13px;letter-spacing:0.3em;color:rgba(230,237,243,0.6);';
      header.append(title, sub);

      const mapWrap = el('div', 'tsb-map-wrap');
      const line = el('div', 'tsb-map-line');
      const stations = el('div', 'tsb-map-stations');

      for (const meta of STATIONS) {
        const unlocked = meta.id <= opts.unlockedLevel;
        const rank: LevelRank | undefined = opts.clearedRanks[meta.id];

        const btn = el('button', 'tsb-station');
        btn.disabled = !unlocked;
        if (!unlocked) btn.classList.add('tsb-station--locked');

        const dot = el('div', 'tsb-station-dot', unlocked ? String(meta.id) : '🔒');
        const name = el('div', 'tsb-station-name', meta.station);
        const subName = el('div', 'tsb-station-sub', meta.levelName);

        btn.append(dot, name, subName);

        if (rank) {
          const badge = el('span', `tsb-rank-badge tsb-rank-${rank}`, rank);
          btn.append(badge);
        }

        if (unlocked) {
          btn.addEventListener('click', () => opts.onSelect(meta.id));
        }
        stations.append(btn);
      }

      mapWrap.append(line, stations);

      const shopBtn = el('button', 'tsb-btn tsb-btn--accent', '🏮 夜市商店');
      shopBtn.style.cssText = 'position:absolute;right:32px;bottom:32px;';
      shopBtn.addEventListener('click', opts.onShop);

      wrap.append(header, mapWrap);
      screen.append(wrap, shopBtn);
      screen.style.display = 'flex';
    },
    hide() {
      screen.style.display = 'none';
    },
  };
}
