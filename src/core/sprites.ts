// Sprite 註冊表：載入 AI 生成的 sprite sheet（Higgsfield AutoSprite 輸出）。
// manifest 不存在或缺角色/狀態時回傳 null → 角色改用程式化向量繪製 fallback。
//
// /assets/sprites/sprites.json 格式：
// {
//   "hero": {
//     "heightM": 1.9,                      // 角色世界高度（公尺），決定繪製縮放
//     "clips": {
//       "idle": { "src": "hero-idle.png", "frames": 8, "fps": 12, "loop": true,
//                 "frameW": 256, "frameH": 256, "anchorX": 0.5, "anchorY": 0.96 }
//     }
//   }
// }

export interface SpriteClip {
  image: HTMLImageElement;
  frames: number;
  fps: number;
  loop: boolean;
  frameW: number;
  frameH: number;
  anchorX: number; // 0-1，腳底錨點
  anchorY: number;
}

interface SheetDef {
  heightM: number;
  clips: Record<string, { src: string; frames: number; fps: number; loop?: boolean; frameW: number; frameH: number; anchorX?: number; anchorY?: number }>;
}

const sheets = new Map<string, { heightM: number; clips: Map<string, SpriteClip> }>();
let loaded = false;

export async function loadSprites(): Promise<void> {
  try {
    const res = await fetch('/assets/sprites/sprites.json');
    if (!res.ok) return;
    const data = (await res.json()) as Record<string, SheetDef>;
    await Promise.all(
      Object.entries(data).map(async ([id, def]) => {
        const clips = new Map<string, SpriteClip>();
        await Promise.all(
          Object.entries(def.clips).map(
            (entry) =>
              new Promise<void>((resolve) => {
                const [state, c] = entry;
                const image = new Image();
                image.onload = () => {
                  clips.set(state, {
                    image,
                    frames: c.frames,
                    fps: c.fps,
                    loop: c.loop ?? true,
                    frameW: c.frameW,
                    frameH: c.frameH,
                    anchorX: c.anchorX ?? 0.5,
                    anchorY: c.anchorY ?? 0.96,
                  });
                  resolve();
                };
                image.onerror = () => resolve(); // 單格失敗不阻斷
                image.src = `/assets/sprites/${c.src}`;
              }),
          ),
        );
        sheets.set(id, { heightM: def.heightM, clips });
      }),
    );
  } catch {
    /* 無 sprite 素材 → 全程式化繪製 */
  } finally {
    loaded = true;
  }
}

export function spritesReady(): boolean {
  return loaded;
}

export function getClip(sheetId: string, state: string): { clip: SpriteClip; heightM: number } | null {
  const sheet = sheets.get(sheetId);
  if (!sheet) return null;
  const clip = sheet.clips.get(state);
  return clip ? { clip, heightM: sheet.heightM } : null;
}
