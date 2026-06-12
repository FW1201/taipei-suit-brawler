// 素材路徑清單（來源與授權見 ASSETS.md）
// 2D 版：音效沿用 Kenney CC0；圖像素材改 AI 生成（/assets/sprites/，由 core/sprites.ts 載入）。

export const MANIFEST = {
  audio: {
    punchHit1: '/assets/audio/punch_hit_1.ogg',
    punchHit2: '/assets/audio/punch_hit_2.ogg',
    punchHeavy1: '/assets/audio/punch_heavy_1.ogg',
    punchHeavy2: '/assets/audio/punch_heavy_2.ogg',
    punchWhiff: '/assets/audio/punch_whiff.ogg',
    bodyFall: '/assets/audio/body_fall.ogg',
    footstep1: '/assets/audio/footstep_1.ogg',
    footstep2: '/assets/audio/footstep_2.ogg',
    hitMetal: '/assets/audio/hit_metal.ogg',
    uiClick: '/assets/audio/ui_click.ogg',
    uiBuy: '/assets/audio/ui_buy.ogg',
    uiUpgrade: '/assets/audio/ui_upgrade.ogg',
    uiError: '/assets/audio/ui_error.ogg',
    uiBack: '/assets/audio/ui_back.ogg',
  } as Record<string, string>,
};
