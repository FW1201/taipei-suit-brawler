# 西裝正義 Taipei Suit Brawler

> 西裝暴徒靠雙拳主持正義——以台北為舞台的 3D 清版動作遊戲（beat 'em up）

**🎮 立即遊玩：https://taipei-suit-brawler.vercel.app**

![Three.js](https://img.shields.io/badge/Three.js-r182-00d4ff) ![Vite](https://img.shields.io/badge/Vite-7-7b2fff) ![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6)

## 遊戲介紹

夜幕下的台北，一名身穿深藍西裝、繫著橘色領帶的男人，用雙拳替城市討回公道。
從西門町的徒步區一路打上台北 101 頂樓，在五大戰場掃蕩惡勢力。

### 五大關卡（台北實景風格化）

| 關卡 | 地點 | 主題 | 頭目 |
|------|------|------|------|
| 1 | 西門町 | 霓虹徒步區 | 西門哥 |
| 2 | 士林夜市 | 攤販窄巷 | 刀疤土豪 |
| 3 | 龍山寺 | 廟埕防守戰 | 壯漢阿義 |
| 4 | 信義商圈 | 百貨空橋 | 黑傘紳士 |
| 5 | 台北 101 頂樓 | 直升機坪決戰 | 主席（三階段） |

### 操作

| 按鍵 | 動作 |
|------|------|
| `W A S D` | 移動 |
| `J` | 輕拳（可連擊 3~5 段） |
| `K` | 重拳（破格擋、擊倒） |
| `Space` | 閃避翻滾（無敵幀＋反擊加成） |
| `L` | 必殺「正義制裁」（怒氣滿時） |
| `E` | 喝珍珠奶茶（回滿 HP） |

### 遊戲系統

- **戰鬥**：連擊狀態機、hitstop 頓幀、鏡頭震動、浮動傷害數字、暴擊與閃避反擊
- **敵人**：6 種 AI 原型（混混／刀手／壯漢／投擲手／保鑣／狂徒）＋ 5 名頭目，
  經典 beat 'em up 圍毆權杖系統（同時出手上限 2 人，其餘環繞走位）
- **任務**：每關主線＋支線（擊倒數／限時／保護目標／無傷／生存波次），影響通關評價 S~C
- **技能樹**：鐵拳／身法／體魄三系九技能
- **商店**：夜市攤販「阿婆ㄟ攤仔」——珍奶回血、滷味加血量上限、防彈西裝背心、義大利皮鞋、幸運領帶
- **存檔**：localStorage 自動保存進度、金錢、技能與裝備

## 技術架構

- **引擎**：Three.js + TypeScript + Vite（無框架、無物理引擎，自寫輕量碰撞）
- **角色**：程式化 low-poly 西裝人（雙關節四肢、姿勢混合動畫、墨鏡＋領帶＋口袋巾）
- **場景**：程式化台北場景 + Kenney City Kit 模型混搭，台北 101 採 CC-BY 模型
- **音效**：Kenney CC0 音效 + WebAudio 合成 fallback
- **資料驅動**：敵人／技能／商品／任務／關卡全部 JSON 配置（`src/data/`）

```bash
npm install
npm run dev      # http://localhost:5180
npm run build    # tsc + vite build
```

## 素材授權

| 素材 | 來源 | 授權 |
|------|------|------|
| 城市建物／道具 | [Kenney City Kit](https://kenney.nl) | CC0 |
| 音效 | [Kenney Audio](https://kenney.nl/assets?q=audio) | CC0 |
| 動畫庫（保留供未來使用） | [Quaternius UAL](https://quaternius.com) | CC0 |
| 台北 101 模型 | "White Taipei 101" by Elaine Wijaya Oey | CC-BY 3.0 |

完整清單見 [ASSETS.md](ASSETS.md)。

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
