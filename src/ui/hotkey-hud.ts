// 右下角快捷鍵提示 + 音樂開關。
// Tab 鍵或點按鈕可摺疊；M 切換 BGM。LocalStorage 記住偏好。
import { uiRoot, el } from './styles';
import { bgm } from '../core/music';

const STORAGE_KEY = 'tsb-hotkey-pref';

interface Pref { collapsed: boolean }
function load(): Pref { try { return Object.assign({ collapsed: false }, JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')); } catch { return { collapsed: false }; } }
function save(p: Pref): void { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch { /* noop */ } }

const KEYS: Array<[string, string]> = [
  ['WASD', '移動'],
  ['J', '輕拳'],
  ['K', '蓄力重擊'],
  ['Space', '閃避'],
  ['L', '必殺'],
  ['F', '撿起/投擲'],
  ['E', '喝珍奶'],
  ['M', '背景音樂'],
  ['Tab', '顯示/收起'],
];

export function mountHotkeyHud(): { update(): void } {
  ensureStyles();
  const pref = load();

  const box = el('div', 'tsb-hk');
  if (pref.collapsed) box.classList.add('tsb-hk--collapsed');

  const head = el('div', 'tsb-hk-head');
  const title = el('span', 'tsb-hk-title', '快捷鍵');
  const bgmBtn = el('button', 'tsb-hk-toggle', '');
  const collapseBtn = el('button', 'tsb-hk-collapse', '');
  head.append(title, bgmBtn, collapseBtn);

  const body = el('div', 'tsb-hk-body');
  for (const [k, label] of KEYS) {
    const row = el('div', 'tsb-hk-row');
    const kk = el('span', 'tsb-hk-key', k);
    const lb = el('span', 'tsb-hk-label', label);
    row.append(kk, lb);
    body.append(row);
  }
  box.append(head, body);
  uiRoot().append(box);

  const refresh = () => {
    bgmBtn.textContent = bgm.isOn ? '♪ 音樂 開' : '♪ 音樂 關';
    bgmBtn.classList.toggle('tsb-hk-toggle--off', !bgm.isOn);
    collapseBtn.textContent = box.classList.contains('tsb-hk--collapsed') ? '▲' : '▼';
  };

  bgmBtn.addEventListener('click', () => { bgm.toggle(); refresh(); });
  collapseBtn.addEventListener('click', () => {
    box.classList.toggle('tsb-hk--collapsed');
    save({ collapsed: box.classList.contains('tsb-hk--collapsed') });
    refresh();
  });
  title.addEventListener('click', () => collapseBtn.click());

  // 鍵盤快捷：Tab 摺疊；M 切換 BGM
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key === 'Tab') { e.preventDefault(); collapseBtn.click(); }
    if (e.key === 'm' || e.key === 'M') { bgmBtn.click(); }
  });

  refresh();
  return { update: refresh };
}

function ensureStyles(): void {
  if (document.getElementById('tsb-hk-style')) return;
  const s = document.createElement('style');
  s.id = 'tsb-hk-style';
  s.textContent = `
    .tsb-hk { position: fixed; right: 14px; bottom: 14px; min-width: 188px; pointer-events: auto;
      font-family: 'Noto Sans TC', sans-serif; color: var(--tsb-text);
      background: rgba(13,17,23,0.78); backdrop-filter: blur(8px);
      border: 1px solid rgba(0,212,255,0.35); border-radius: 10px;
      box-shadow: 0 0 16px rgba(0,212,255,0.18); z-index: 60;
      transition: max-height 0.2s ease, min-width 0.2s ease;
      max-height: 360px; overflow: hidden; }
    .tsb-hk--collapsed { max-height: 36px; min-width: 132px; }
    .tsb-hk-head { display: flex; align-items: center; gap: 8px; padding: 8px 10px;
      border-bottom: 1px solid rgba(0,212,255,0.22); user-select: none; }
    .tsb-hk-title { font-size: 12px; font-weight: 900; letter-spacing: 0.2em; color: var(--tsb-primary); cursor: pointer; flex: 1; }
    .tsb-hk-toggle, .tsb-hk-collapse { background: transparent; color: var(--tsb-text);
      border: 1px solid rgba(230,237,243,0.28); border-radius: 5px;
      font-family: inherit; font-size: 10.5px; padding: 2px 7px; cursor: pointer;
      font-weight: 700; }
    .tsb-hk-collapse { padding: 2px 6px; min-width: 26px; }
    .tsb-hk-toggle:hover, .tsb-hk-collapse:hover { background: rgba(0,212,255,0.18); border-color: var(--tsb-primary); }
    .tsb-hk-toggle--off { color: rgba(230,237,243,0.4); }
    .tsb-hk-body { padding: 8px 10px; display: grid; grid-template-columns: auto 1fr; gap: 4px 10px; font-size: 11.5px; }
    .tsb-hk-row { display: contents; }
    .tsb-hk-key { display: inline-block; min-width: 24px; padding: 1px 6px;
      background: rgba(0,212,255,0.12); border: 1px solid rgba(0,212,255,0.5);
      border-radius: 4px; font-weight: 900; font-size: 10.5px; text-align: center;
      color: var(--tsb-primary); }
    .tsb-hk-label { color: rgba(230,237,243,0.78); align-self: center; }
    .tsb-hk--collapsed .tsb-hk-body { display: none; }
  `;
  document.head.append(s);
}
