# ASSETS.md — 素材授權清單
《西裝正義 Taipei Suit Brawler》使用之第三方素材。最後更新：2026-06-12。

所有 glb 均已以 `@gltf-transform/cli optimize --compress meshopt` 壓縮（載入時需註冊 MeshoptDecoder）。
`public/assets/` 總大小：約 8.5 MB。

## 3D 模型 — 城市（public/assets/models/city/）

| 檔名 | 來源 URL | 作者 | 授權 | 用途 |
|------|----------|------|------|------|
| road-straight.glb | https://kenney.nl/assets/city-kit-roads | Kenney | CC0 | 道路直線 |
| road-bend.glb | https://kenney.nl/assets/city-kit-roads | Kenney | CC0 | 道路轉角 |
| road-crossroad.glb | https://kenney.nl/assets/city-kit-roads | Kenney | CC0 | 十字路口 |
| road-intersection.glb | https://kenney.nl/assets/city-kit-roads | Kenney | CC0 | T 字路口 |
| road-crossing.glb | https://kenney.nl/assets/city-kit-roads | Kenney | CC0 | 斑馬線路段 |
| road-end.glb | https://kenney.nl/assets/city-kit-roads | Kenney | CC0 | 道路盡頭 |
| light-curved.glb | https://kenney.nl/assets/city-kit-roads | Kenney | CC0 | 路燈（彎柱） |
| light-square-double.glb | https://kenney.nl/assets/city-kit-roads | Kenney | CC0 | 路燈（雙頭） |
| construction-cone.glb | https://kenney.nl/assets/city-kit-roads | Kenney | CC0 | 三角錐道具 |
| construction-barrier.glb | https://kenney.nl/assets/city-kit-roads | Kenney | CC0 | 施工圍欄道具 |
| sign-highway.glb | https://kenney.nl/assets/city-kit-roads | Kenney | CC0 | 公路招牌 |
| building-a.glb ～ building-h.glb（8 棟） | https://kenney.nl/assets/city-kit-commercial | Kenney | CC0 | 商業街建築 |
| building-skyscraper-a.glb ～ c.glb（3 棟） | https://kenney.nl/assets/city-kit-commercial | Kenney | CC0 | 高樓大廈 |
| detail-awning.glb / detail-awning-wide.glb | https://kenney.nl/assets/city-kit-commercial | Kenney | CC0 | 遮雨棚細節件 |
| detail-overhang.glb / detail-overhang-wide.glb | https://kenney.nl/assets/city-kit-commercial | Kenney | CC0 | 騎樓突出細節件 |
| detail-parasol-a.glb / detail-parasol-b.glb | https://kenney.nl/assets/city-kit-commercial | Kenney | CC0 | 路邊遮陽傘 |

## 3D 模型 — 角色（public/assets/models/characters/）

| 檔名 | 來源 URL | 作者 | 授權 | 用途 |
|------|----------|------|------|------|
| hero.glb | https://quaternius.com/packs/universalbasecharacters.html （itch.io: https://quaternius.itch.io/universal-base-characters ，取 Standard 版 Godot/UE rig 的 Superhero_Male_FullBody） | Quaternius | CC0 | 主角人形模型（rigged，骨架相容 Universal Animation Library Godot 版） |

## 3D 模型 — 地標（public/assets/models/landmarks/）

| 檔名 | 來源 URL | 作者 | 授權 | 用途 |
|------|----------|------|------|------|
| taipei101.glb | https://poly.pizza/m/c4ZLE4L0gT3 | Elaine Wijaya Oey | CC-BY 3.0 | 台北 101 地標 |

**CC-BY 署名（必須隨遊戲 credits 顯示）：**
> "White Taipei 101" by Elaine Wijaya Oey, licensed under CC-BY 3.0 (https://creativecommons.org/licenses/by/3.0/), via Poly Pizza (https://poly.pizza/m/c4ZLE4L0gT3).

## 動畫（public/assets/animations/）

| 檔名 | 來源 URL | 作者 | 授權 | 用途 |
|------|----------|------|------|------|
| universal_animations.glb | https://github.com/J-Ponzo/gltf-universal-animation-library （原始出處：https://quaternius.itch.io/universal-animation-library Standard 免費版，glTF Godot Standard） | Quaternius（glTF mirror 由 J-Ponzo 提供） | CC0 | 戰鬥／移動動畫庫，單檔含 46 個 clips |

戰鬥會用到的 clip 名稱（檔內 AnimationClip name）：
`Idle_Loop`、`Walk_Loop`、`Walk_Formal_Loop`、`Jog_Fwd_Loop`、`Sprint_Loop`、
`Punch_Enter`（出拳起手／格擋姿態）、`Punch_Jab`、`Punch_Cross`、
`Roll`／`Roll_RM`（閃避翻滾）、`Hit_Chest`、`Hit_Head`（受擊反應）、
`Death01`（倒地／死亡）、`Crouch_Idle_Loop`、`Jump_Start`／`Jump_Loop`／`Jump_Land`。
（免費 Standard 版無 hook／heavy attack／block 專用動畫；heavy attack 可用 `Sword_Attack` 重新計時替代，block 以 `Punch_Enter` 定格替代。）

## 音效（public/assets/audio/）

| 檔名 | 來源 URL | 作者 | 授權 | 用途 |
|------|----------|------|------|------|
| punch_hit_1.ogg（原 impactPunch_medium_000） | https://kenney.nl/assets/impact-sounds | Kenney | CC0 | 拳擊命中（輕） |
| punch_hit_2.ogg（原 impactPunch_medium_002） | https://kenney.nl/assets/impact-sounds | Kenney | CC0 | 拳擊命中（輕，變化音） |
| punch_heavy_1.ogg（原 impactPunch_heavy_001） | https://kenney.nl/assets/impact-sounds | Kenney | CC0 | 重拳命中 |
| punch_heavy_2.ogg（原 impactPunch_heavy_004） | https://kenney.nl/assets/impact-sounds | Kenney | CC0 | 重拳命中（變化音） |
| punch_whiff.ogg（原 impactSoft_medium_001） | https://kenney.nl/assets/impact-sounds | Kenney | CC0 | 揮空 |
| body_fall.ogg（原 impactSoft_heavy_002） | https://kenney.nl/assets/impact-sounds | Kenney | CC0 | 倒地悶響 |
| footstep_1.ogg（原 footstep_concrete_000） | https://kenney.nl/assets/impact-sounds | Kenney | CC0 | 腳步聲（水泥地） |
| footstep_2.ogg（原 footstep_concrete_002） | https://kenney.nl/assets/impact-sounds | Kenney | CC0 | 腳步聲（變化音） |
| hit_metal.ogg（原 impactMetal_heavy_000） | https://kenney.nl/assets/impact-sounds | Kenney | CC0 | 撞擊金屬物（招牌／圍欄） |
| ui_click.ogg（原 select_001） | https://kenney.nl/assets/interface-sounds | Kenney | CC0 | UI 點擊 |
| ui_buy.ogg（原 confirmation_001） | https://kenney.nl/assets/interface-sounds | Kenney | CC0 | 購買成功 |
| ui_upgrade.ogg（原 maximize_001） | https://kenney.nl/assets/interface-sounds | Kenney | CC0 | 升級 |
| ui_error.ogg（原 error_008） | https://kenney.nl/assets/interface-sounds | Kenney | CC0 | 操作失敗／金額不足 |
| ui_back.ogg（原 back_001） | https://kenney.nl/assets/interface-sounds | Kenney | CC0 | 返回／取消 |

## 備註

- Kenney 素材（kenney.nl）與 Quaternius 素材均為 CC0 1.0，無署名義務（仍建議於 credits 致謝）。
- 唯一 CC-BY 素材為 taipei101.glb，署名文字見上方地標段落。
- 城市模型由 Kenney 原始 GLB 重新匯出，已將外部 `Textures/colormap.png` 內嵌進 glb。
- 角色 hero.glb 與動畫庫同為 Quaternius「Godot Standard」骨架，可直接 retarget 共用 AnimationClip。
