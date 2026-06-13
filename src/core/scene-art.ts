// 場景 AI 背景圖載入器：每個主題一張寬幅 backdrop（Behemoth 風），
// 有圖則 builder 用它當遠景視差層取代程式化剪影；缺圖則退回程式繪製。
// /assets/scenes/scenes.json 格式：{ "neon": { "backdrop": "ximen-bg.png" }, ... }

import type { EnvTheme } from '../levels/builder';

interface SceneEntry {
  backdrop?: HTMLImageElement;
}

const scenes = new Map<string, SceneEntry>();
let loaded = false;

export async function loadScenes(): Promise<void> {
  try {
    const res = await fetch('/assets/scenes/scenes.json');
    if (!res.ok) return;
    const data = (await res.json()) as Record<string, { backdrop?: string }>;
    await Promise.all(
      Object.entries(data).map(
        (entry) =>
          new Promise<void>((resolve) => {
            const [theme, def] = entry;
            if (!def.backdrop) { resolve(); return; }
            const img = new Image();
            img.onload = () => { scenes.set(theme, { backdrop: img }); resolve(); };
            img.onerror = () => resolve();
            img.src = `/assets/scenes/${def.backdrop}`;
          }),
      ),
    );
  } catch {
    /* 無場景圖 → 全程式繪製 */
  } finally {
    loaded = true;
  }
}

export function scenesReady(): boolean {
  return loaded;
}

export function getBackdrop(theme: EnvTheme): HTMLImageElement | null {
  return scenes.get(theme)?.backdrop ?? null;
}
