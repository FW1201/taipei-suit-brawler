// 《西裝正義》UI 共用樣式 — Neon Circuit 設計系統。
// 第一次呼叫 ensureStyles() 時注入 <style>，之後為 no-op。

export const COLORS = {
  bg: '#0D1117',
  primary: '#00D4FF',
  secondary: '#7B2FFF',
  accent: '#FF6B35',
  text: '#E6EDF3',
} as const;

let injected = false;

/** 取得 UI 掛載點 #ui-root */
export function uiRoot(): HTMLElement {
  const root = document.getElementById('ui-root');
  if (!root) throw new Error('[ui] 找不到 #ui-root');
  return root;
}

/** 建立元素小工具 */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function ensureStyles(): void {
  if (injected) return;
  injected = true;
  const style = document.createElement('style');
  style.id = 'tsb-ui-styles';
  style.textContent = `
:root {
  --tsb-bg: ${COLORS.bg};
  --tsb-primary: ${COLORS.primary};
  --tsb-secondary: ${COLORS.secondary};
  --tsb-accent: ${COLORS.accent};
  --tsb-text: ${COLORS.text};
}

.tsb-screen {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Noto Sans TC', sans-serif;
  color: var(--tsb-text);
  background: radial-gradient(ellipse at 50% 30%, rgba(123, 47, 255, 0.12), transparent 60%),
    rgba(13, 17, 23, 0.82);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  animation: tsb-fade-in 0.25s ease-out;
  z-index: 20;
}

@keyframes tsb-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.tsb-panel {
  background: rgba(13, 17, 23, 0.78);
  border: 1px solid rgba(0, 212, 255, 0.35);
  border-radius: 14px;
  box-shadow: 0 0 24px rgba(0, 212, 255, 0.18), inset 0 0 32px rgba(0, 212, 255, 0.05);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  padding: 24px 28px;
}

.tsb-title-glow {
  color: var(--tsb-primary);
  text-shadow: 0 0 12px rgba(0, 212, 255, 0.8), 0 0 36px rgba(0, 212, 255, 0.45);
}

.tsb-btn {
  font-family: 'Noto Sans TC', sans-serif;
  font-size: 17px;
  font-weight: 700;
  color: var(--tsb-text);
  background: rgba(0, 212, 255, 0.08);
  border: 1px solid rgba(0, 212, 255, 0.55);
  border-radius: 8px;
  padding: 10px 28px;
  cursor: pointer;
  letter-spacing: 0.12em;
  transition: all 0.15s ease;
  box-shadow: 0 0 10px rgba(0, 212, 255, 0.2);
}
.tsb-btn:hover:not(:disabled) {
  background: rgba(0, 212, 255, 0.22);
  box-shadow: 0 0 18px rgba(0, 212, 255, 0.55);
  transform: translateY(-1px);
}
.tsb-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
  box-shadow: none;
}
.tsb-btn--accent {
  border-color: rgba(255, 107, 53, 0.65);
  background: rgba(255, 107, 53, 0.1);
  box-shadow: 0 0 10px rgba(255, 107, 53, 0.25);
}
.tsb-btn--accent:hover:not(:disabled) {
  background: rgba(255, 107, 53, 0.25);
  box-shadow: 0 0 18px rgba(255, 107, 53, 0.6);
}
.tsb-btn--ghost {
  border-color: rgba(230, 237, 243, 0.3);
  background: rgba(230, 237, 243, 0.05);
  box-shadow: none;
}

/* ───────── HUD ───────── */
.tsb-hud { position: absolute; inset: 0; pointer-events: none; font-family: 'Noto Sans TC', sans-serif; color: var(--tsb-text); z-index: 10; }
.tsb-hud * { pointer-events: none; }

.tsb-hud-topleft { position: absolute; top: 18px; left: 18px; display: flex; flex-direction: column; gap: 8px; width: 300px; }
.tsb-bar { position: relative; height: 18px; border-radius: 9px; background: rgba(13, 17, 23, 0.7); border: 1px solid rgba(230, 237, 243, 0.25); overflow: hidden; }
.tsb-bar-fill { height: 100%; border-radius: 8px; transition: width 0.18s ease-out; }
.tsb-bar-fill--hp { background: linear-gradient(90deg, #FF2F4E, #FF6B35); box-shadow: 0 0 10px rgba(255, 47, 78, 0.7); }
.tsb-bar-fill--rage { background: linear-gradient(90deg, #00D4FF, #7B2FFF); box-shadow: 0 0 12px rgba(0, 212, 255, 0.8); }
.tsb-bar--rage { height: 12px; }
.tsb-bar-label { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; text-shadow: 0 1px 2px rgba(0,0,0,0.8); letter-spacing: 0.08em; }
.tsb-tea-row { display: flex; gap: 6px; align-items: center; }
.tsb-tea-slot { width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; font-size: 16px; border: 1px solid rgba(0, 212, 255, 0.4); border-radius: 6px; background: rgba(13, 17, 23, 0.6); }
.tsb-tea-slot--empty { filter: grayscale(1); opacity: 0.3; }

.tsb-hud-quests { position: absolute; top: 18px; right: 18px; width: 280px; display: flex; flex-direction: column; gap: 6px; background: rgba(13, 17, 23, 0.55); border: 1px solid rgba(0, 212, 255, 0.25); border-radius: 10px; padding: 12px 14px; backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
.tsb-hud-quests h4 { margin: 0 0 2px; font-size: 12px; letter-spacing: 0.3em; color: var(--tsb-primary); font-weight: 700; }
.tsb-quest { display: flex; gap: 8px; align-items: baseline; font-size: 13px; line-height: 1.45; }
.tsb-quest--main { color: #FFD75E; font-weight: 700; }
.tsb-quest--side { color: rgba(230, 237, 243, 0.75); }
.tsb-quest--done { opacity: 0.75; }
.tsb-quest--done .tsb-quest-title { color: #5BE38A; }
.tsb-quest--failed .tsb-quest-title { text-decoration: line-through; opacity: 0.5; }
.tsb-quest-progress { margin-left: auto; font-size: 12px; opacity: 0.85; white-space: nowrap; }

.tsb-hud-money { position: absolute; left: 18px; bottom: 18px; font-size: 22px; font-weight: 900; color: #FFD75E; text-shadow: 0 0 10px rgba(255, 215, 94, 0.5); letter-spacing: 0.04em; }

.tsb-hud-combo { position: absolute; right: 12%; top: 42%; font-size: 64px; font-weight: 900; color: var(--tsb-accent); text-shadow: 0 0 16px rgba(255, 107, 53, 0.8), 0 2px 0 rgba(0,0,0,0.4); display: none; transform-origin: center; }
.tsb-hud-combo small { display: block; font-size: 18px; letter-spacing: 0.4em; color: var(--tsb-text); text-align: center; }
.tsb-hud-combo.tsb-pop { animation: tsb-combo-pop 0.22s ease-out; }
@keyframes tsb-combo-pop {
  0% { transform: scale(1.5); }
  60% { transform: scale(0.92); }
  100% { transform: scale(1); }
}

.tsb-bossbar { position: absolute; top: 24px; left: 50%; transform: translateX(-50%); width: min(560px, 60vw); display: none; flex-direction: column; gap: 4px; }
.tsb-bossbar-name { text-align: center; font-size: 16px; font-weight: 900; letter-spacing: 0.3em; color: var(--tsb-accent); text-shadow: 0 0 12px rgba(255, 107, 53, 0.7); }
.tsb-bossbar .tsb-bar { height: 14px; border-color: rgba(255, 107, 53, 0.5); }
.tsb-bossbar .tsb-bar-fill { background: linear-gradient(90deg, #7B2FFF, #FF2F4E); box-shadow: 0 0 12px rgba(255, 47, 78, 0.8); }

.tsb-announce { position: absolute; inset: 0; display: none; align-items: center; justify-content: center; }
.tsb-announce span { font-size: 56px; font-weight: 900; letter-spacing: 0.25em; color: var(--tsb-text); text-shadow: 0 0 20px rgba(0, 212, 255, 0.9), 0 0 60px rgba(123, 47, 255, 0.6); }
.tsb-announce.tsb-announce--show { display: flex; animation: tsb-announce-fade var(--tsb-announce-ms, 1800ms) ease-in-out forwards; }
@keyframes tsb-announce-fade {
  0% { opacity: 0; transform: scale(1.15); }
  12% { opacity: 1; transform: scale(1); }
  82% { opacity: 1; }
  100% { opacity: 0; }
}

/* ───────── 標題畫面 ───────── */
.tsb-title-logo { font-size: clamp(56px, 9vw, 110px); font-weight: 900; margin: 0; letter-spacing: 0.12em; }
.tsb-title-sub { margin: 4px 0 0; font-size: 18px; letter-spacing: 0.5em; color: var(--tsb-secondary); text-shadow: 0 0 14px rgba(123, 47, 255, 0.8); }
.tsb-title-controls { display: grid; grid-template-columns: repeat(3, auto); gap: 6px 26px; font-size: 14px; color: rgba(230, 237, 243, 0.8); }
.tsb-title-controls b { color: var(--tsb-primary); font-weight: 700; margin-right: 6px; }
.tsb-key { display: inline-block; min-width: 20px; padding: 1px 7px; border: 1px solid rgba(0, 212, 255, 0.5); border-radius: 5px; background: rgba(0, 212, 255, 0.08); color: var(--tsb-primary); font-weight: 700; text-align: center; }

/* ───────── 關卡地圖 ───────── */
.tsb-map-wrap { position: relative; width: min(960px, 92vw); }
.tsb-map-line { position: absolute; left: 4%; right: 4%; top: 50%; height: 6px; transform: translateY(-50%); border-radius: 3px; background: linear-gradient(90deg, #00D4FF, #7B2FFF, #FF6B35); box-shadow: 0 0 16px rgba(0, 212, 255, 0.6); }
.tsb-map-stations { position: relative; display: flex; justify-content: space-between; padding: 0 2%; }
.tsb-station { display: flex; flex-direction: column; align-items: center; gap: 10px; width: 150px; background: none; border: none; cursor: pointer; font-family: 'Noto Sans TC', sans-serif; color: var(--tsb-text); padding: 12px 4px; }
.tsb-station-dot { width: 34px; height: 34px; border-radius: 50%; border: 3px solid var(--tsb-primary); background: var(--tsb-bg); box-shadow: 0 0 14px rgba(0, 212, 255, 0.8); display: flex; align-items: center; justify-content: center; font-size: 15px; transition: transform 0.15s ease; }
.tsb-station:hover:not(:disabled) .tsb-station-dot { transform: scale(1.25); }
.tsb-station:hover:not(:disabled) .tsb-station-name { color: var(--tsb-primary); }
.tsb-station:disabled { cursor: not-allowed; }
.tsb-station--locked { opacity: 0.45; }
.tsb-station--locked .tsb-station-dot { border-color: rgba(230, 237, 243, 0.3); box-shadow: none; filter: grayscale(1); }
.tsb-station-name { font-size: 16px; font-weight: 700; letter-spacing: 0.08em; transition: color 0.15s ease; }
.tsb-station-sub { font-size: 11px; color: rgba(230, 237, 243, 0.55); line-height: 1.4; min-height: 30px; }
.tsb-rank-badge { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 50%; font-weight: 900; font-size: 14px; }
.tsb-rank-S { background: linear-gradient(135deg, #FFD75E, #FF9D2E); color: #2A1A00; box-shadow: 0 0 12px rgba(255, 215, 94, 0.9); }
.tsb-rank-A { background: linear-gradient(135deg, #E8ECF2, #9BA7B8); color: #1A2230; box-shadow: 0 0 8px rgba(232, 236, 242, 0.7); }
.tsb-rank-B { background: linear-gradient(135deg, #D08A4E, #8C5A2E); color: #2A1400; }
.tsb-rank-C { background: #3A4250; color: #C8D0DC; }

/* ───────── 商店 ───────── */
.tsb-shop-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 16px; }
.tsb-shop-card { border: 1px solid rgba(0, 212, 255, 0.3); border-radius: 10px; padding: 14px; background: rgba(0, 212, 255, 0.04); display: flex; flex-direction: column; gap: 6px; transition: all 0.15s ease; }
.tsb-shop-card:not(.tsb-shop-card--disabled):hover { border-color: rgba(0, 212, 255, 0.7); box-shadow: 0 0 14px rgba(0, 212, 255, 0.3); }
.tsb-shop-card--disabled { opacity: 0.45; filter: grayscale(0.7); }
.tsb-shop-icon { font-size: 34px; line-height: 1; }
.tsb-shop-name { font-size: 16px; font-weight: 700; }
.tsb-shop-desc { font-size: 12px; color: rgba(230, 237, 243, 0.7); line-height: 1.5; flex: 1; }
.tsb-shop-price { font-size: 15px; font-weight: 900; color: #FFD75E; }
.tsb-shop-owned { color: #5BE38A; font-weight: 700; font-size: 13px; }
.tsb-shake { animation: tsb-shake 0.3s ease; }
@keyframes tsb-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-6px); }
  50% { transform: translateX(6px); }
  75% { transform: translateX(-4px); }
}

/* ───────── 技能樹 ───────── */
.tsb-skill-cols { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 14px; }
.tsb-skill-col { border-radius: 10px; padding: 14px; border: 1px solid; display: flex; flex-direction: column; gap: 12px; }
.tsb-skill-col h3 { margin: 0; font-size: 17px; font-weight: 900; letter-spacing: 0.2em; text-align: center; }
.tsb-skill { border: 1px solid rgba(230, 237, 243, 0.15); border-radius: 8px; padding: 10px 12px; background: rgba(13, 17, 23, 0.55); display: flex; flex-direction: column; gap: 5px; }
.tsb-skill-name { font-size: 15px; font-weight: 700; }
.tsb-skill-desc { font-size: 12px; color: rgba(230, 237, 243, 0.65); line-height: 1.5; }
.tsb-skill-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.tsb-skill-dots { font-size: 14px; letter-spacing: 3px; }
.tsb-skill-btn { font-family: 'Noto Sans TC', sans-serif; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 6px; border: 1px solid rgba(0, 212, 255, 0.5); background: rgba(0, 212, 255, 0.1); color: var(--tsb-text); cursor: pointer; transition: all 0.12s ease; white-space: nowrap; }
.tsb-skill-btn:hover:not(:disabled) { background: rgba(0, 212, 255, 0.3); box-shadow: 0 0 10px rgba(0, 212, 255, 0.5); }
.tsb-skill-btn:disabled { opacity: 0.35; cursor: not-allowed; }

/* ───────── 結算 ───────── */
.tsb-result-rank { width: 130px; height: 130px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 72px; font-weight: 900; margin: 12px auto; border: 4px solid; }
.tsb-result-rank--S { color: #FFD75E; border-color: #FFD75E; box-shadow: 0 0 30px rgba(255, 215, 94, 0.8), inset 0 0 24px rgba(255, 215, 94, 0.25); animation: tsb-rank-spin 2.4s ease-in-out infinite; }
@keyframes tsb-rank-spin {
  0%, 100% { transform: rotateY(0deg); filter: drop-shadow(0 0 10px rgba(255, 215, 94, 0.8)); }
  50% { transform: rotateY(360deg); filter: drop-shadow(0 0 26px rgba(255, 215, 94, 1)); }
}
.tsb-result-rank--A { color: #E8ECF2; border-color: #E8ECF2; box-shadow: 0 0 20px rgba(232, 236, 242, 0.6); }
.tsb-result-rank--B { color: #D08A4E; border-color: #D08A4E; box-shadow: 0 0 14px rgba(208, 138, 78, 0.5); }
.tsb-result-rank--C { color: #9BA7B8; border-color: #9BA7B8; }
.tsb-result-stats { display: flex; flex-direction: column; gap: 8px; margin: 18px 0; font-size: 18px; }
.tsb-result-stats .tsb-num { font-weight: 900; color: #FFD75E; font-variant-numeric: tabular-nums; }
`;
  document.head.appendChild(style);
}
