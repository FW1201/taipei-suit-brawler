// 素材路徑清單（由素材管線填入，來源與授權見 ASSETS.md）
// 所有 .glb 均經 meshopt 壓縮，載入時需向 GLTFLoader 註冊 MeshoptDecoder。

export const MANIFEST = {
  city: {
    // 道路（Kenney City Kit Roads, CC0）
    roadStraight: '/assets/models/city/road-straight.glb',
    roadCorner: '/assets/models/city/road-bend.glb',
    roadCrossroad: '/assets/models/city/road-crossroad.glb',
    roadTJunction: '/assets/models/city/road-intersection.glb',
    roadCrossing: '/assets/models/city/road-crossing.glb',
    roadEnd: '/assets/models/city/road-end.glb',
    // 街道道具
    streetLight: '/assets/models/city/light-curved.glb',
    streetLightDouble: '/assets/models/city/light-square-double.glb',
    constructionCone: '/assets/models/city/construction-cone.glb',
    constructionBarrier: '/assets/models/city/construction-barrier.glb',
    signHighway: '/assets/models/city/sign-highway.glb',
    // 建築（Kenney City Kit Commercial, CC0）
    buildingA: '/assets/models/city/building-a.glb',
    buildingB: '/assets/models/city/building-b.glb',
    buildingC: '/assets/models/city/building-c.glb',
    buildingD: '/assets/models/city/building-d.glb',
    buildingE: '/assets/models/city/building-e.glb',
    buildingF: '/assets/models/city/building-f.glb',
    buildingG: '/assets/models/city/building-g.glb',
    buildingH: '/assets/models/city/building-h.glb',
    skyscraperA: '/assets/models/city/building-skyscraper-a.glb',
    skyscraperB: '/assets/models/city/building-skyscraper-b.glb',
    skyscraperC: '/assets/models/city/building-skyscraper-c.glb',
    // 細節件（招牌／遮雨棚／騎樓）
    awning: '/assets/models/city/detail-awning.glb',
    awningWide: '/assets/models/city/detail-awning-wide.glb',
    overhang: '/assets/models/city/detail-overhang.glb',
    overhangWide: '/assets/models/city/detail-overhang-wide.glb',
    parasolA: '/assets/models/city/detail-parasol-a.glb',
    parasolB: '/assets/models/city/detail-parasol-b.glb',
  } as Record<string, string>,
  characters: {
    // Quaternius Universal Base Characters（CC0，rigged，Godot Standard 骨架）
    hero: '/assets/models/characters/hero.glb',
  } as Record<string, string>,
  animations: {
    // 單檔含 46 個 AnimationClip（Quaternius Universal Animation Library, CC0）
    // 各動作以 clip 名稱取用，見下方 ANIMATION_CLIPS
    library: '/assets/animations/universal_animations.glb',
  } as Record<string, string>,
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
  landmarks: {
    // "White Taipei 101" by Elaine Wijaya Oey（CC-BY 3.0，署名文字見 ASSETS.md）
    taipei101: '/assets/models/landmarks/taipei101.glb',
  } as Record<string, string>,
};

// universal_animations.glb 內的 AnimationClip 名稱 → 遊戲語意對照
export const ANIMATION_CLIPS = {
  idle: 'Idle_Loop',
  walk: 'Walk_Loop',
  walkFormal: 'Walk_Formal_Loop', // 西裝步態
  run: 'Jog_Fwd_Loop',
  sprint: 'Sprint_Loop',
  combatEnter: 'Punch_Enter', // 起手／格擋姿態替代
  punchJab: 'Punch_Jab',
  punchCross: 'Punch_Cross',
  heavyAttack: 'Sword_Attack', // 免費版無徒手重擊，借用並重新計時
  dodgeRoll: 'Roll',
  dodgeRollRM: 'Roll_RM', // root motion 版
  hitChest: 'Hit_Chest',
  hitHead: 'Hit_Head',
  knockedDown: 'Death01',
  crouchIdle: 'Crouch_Idle_Loop',
  jumpStart: 'Jump_Start',
  jumpLoop: 'Jump_Loop',
  jumpLand: 'Jump_Land',
} as Record<string, string>;
