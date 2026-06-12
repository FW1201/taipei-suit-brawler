// 《西裝正義》共用型別契約 — 所有模組（core/combat/enemies/systems/levels/ui/data）共同遵守。
// 並行開發時以此檔為整合介面，修改前需確認不破壞其他模組。

// ───────────────────────── 遊戲流程 ─────────────────────────

export type GameStateName = 'title' | 'map' | 'level' | 'result' | 'shop';

export type LevelId = 1 | 2 | 3 | 4 | 5;

export type LevelRank = 'S' | 'A' | 'B' | 'C';

// ───────────────────────── 敵人 ─────────────────────────

export type EnemyKind =
  | 'punk'       // 混混：近戰圍毆、成群
  | 'knifer'     // 刀手：快速突進、高傷低血
  | 'bruiser'    // 壯漢：慢速高血、霸體
  | 'thrower'    // 投擲手：遠距丟酒瓶
  | 'bodyguard'  // 保鑣：格擋，連擊可破
  | 'berserker'  // 狂徒：半血狂暴加速
  | 'boss';

export interface EnemyDef {
  id: string;            // 'punk' | 'knifer' | ... | 'boss_ximen' 等
  kind: EnemyKind;
  name: string;          // 顯示名（中文）
  hp: number;
  damage: number;        // 每次攻擊傷害
  speed: number;         // 移動速度 m/s
  attackRange: number;   // 出手距離 m
  attackCooldown: number;// 攻擊間隔（秒）
  money: number;         // 擊倒掉落 NT$
  scale: number;         // 模型縮放（壯漢 > 1）
  tint: string;          // 服裝主色 hex，用於變體區分
  // 特殊行為參數
  blockChance?: number;  // 保鑣格擋機率 0-1
  projectile?: boolean;  // 投擲手
  enrageBelow?: number;  // 狂徒：HP 比例低於此值狂暴
  phases?: number;       // Boss 階段數
}

// ───────────────────────── 技能 ─────────────────────────

export type SkillBranch = 'fist' | 'agility' | 'body'; // 鐵拳 / 身法 / 體魄

export type SkillEffectKey =
  | 'lightDamageMult'   // 輕拳傷害倍率加成（每級 +0.15）
  | 'comboLength'       // 連擊段數（3 + 級數）
  | 'heavyRadius'       // 重拳破防範圍加成
  | 'moveSpeedMult'     // 移速加成
  | 'dodgeIFrames'      // 閃避無敵幀延長（秒）
  | 'counterMult'       // 閃避後反擊加成
  | 'maxHpBonus'        // 最大 HP 加成（每級 +25）
  | 'rageGainMult'      // 怒氣累積加成
  | 'reviveHpMult';     // 復活回血量加成

export interface SkillDef {
  id: string;
  branch: SkillBranch;
  name: string;
  description: string;
  maxLevel: number;
  costPerLevel: number[];   // 各級所需技能點，長度 = maxLevel
  effect: SkillEffectKey;
  valuePerLevel: number;    // 每級效果數值
}

// ───────────────────────── 商店 ─────────────────────────

export type ShopItemType = 'consumable' | 'permanent' | 'equipment';

export type ShopEffectKey =
  | 'healFull'        // 回滿 HP（珍奶）
  | 'maxHpPermanent'  // 永久 max HP+（滷味）
  | 'damageReduction' // 受傷減免（背心）
  | 'moveSpeed'       // 移速（皮鞋）
  | 'critChance'      // 暴擊率（領帶）
  | 'skillReset';     // 技能重置券

export interface ShopItemDef {
  id: string;
  name: string;
  description: string;
  price: number;          // NT$
  type: ShopItemType;
  effect: ShopEffectKey;
  value: number;          // 效果數值（如 0.15 = 15%）
  icon: string;           // emoji 或圖示字串
}

// ───────────────────────── 任務 ─────────────────────────

export type QuestType =
  | 'kill_count'  // 擊倒 N 名敵人
  | 'kill_boss'   // 擊敗 Boss
  | 'timed'       // 限時完成（搭配其他條件）
  | 'protect'     // 保護目標（HP 不歸零）
  | 'no_damage'   // 區段內無傷
  | 'survive';    // 生存 N 秒 / N 波

export interface QuestDef {
  id: string;
  levelId: LevelId;
  main: boolean;          // 主線（過關必要）或支線
  type: QuestType;
  title: string;
  description: string;
  target: number;         // kill 數量 / 秒數 / 波數
  timeLimit?: number;     // 秒，timed 用
  rewardMoney: number;
  rewardSkillPoints: number;
}

export interface QuestProgress {
  questId: string;
  progress: number;       // 當前進度值
  done: boolean;
  failed: boolean;
}

// ───────────────────────── 關卡 ─────────────────────────

export interface EnemyWave {
  /** 該波出怪：enemyDefId → 數量 */
  spawns: Record<string, number>;
  /** 觸發：前一波清完(clear) 或 進入區域(zone index) */
  trigger: 'clear' | number;
}

export interface LevelDef {
  id: LevelId;
  name: string;           // 「西門町」
  subtitle: string;       // 「行人徒步區的不速之客」
  description: string;
  bossId: string;
  waves: EnemyWave[];
  envTheme: 'neon' | 'nightmarket' | 'temple' | 'skybridge' | 'rooftop';
}

// ───────────────────────── 玩家 / 存檔 ─────────────────────────

export interface EquipmentState {
  vest: boolean;    // 防彈背心
  shoes: boolean;   // 皮鞋
  tie: boolean;     // 領帶
}

export interface SaveData {
  version: 1;
  unlockedLevel: LevelId;          // 已解鎖至第幾關
  clearedRanks: Partial<Record<LevelId, LevelRank>>;
  money: number;
  skillPoints: number;
  skillLevels: Record<string, number>;  // skillId → 已升級數
  maxHpPermanentBonus: number;          // 滷味累計
  equipment: EquipmentState;
  bubbleTeaCount: number;               // 珍奶庫存（上限 3）
}

/** 由技能/裝備/永久加成彙整出的玩家實際數值 */
export interface PlayerStats {
  maxHp: number;
  lightDamage: number;
  heavyDamage: number;
  heavyRadius: number;   // 重拳額外範圍（公尺）
  comboLength: number;
  moveSpeed: number;
  dodgeIFrames: number;
  counterMult: number;
  rageGainMult: number;
  reviveHpMult: number;
  damageReduction: number;
  critChance: number;
}

// ───────────────────────── 事件匯流排 ─────────────────────────
// systems/ui 透過事件解耦：戰鬥層發事件，系統層與 HUD 訂閱。

export interface GameEvents {
  'player:damaged': { hp: number; maxHp: number };
  'player:healed': { hp: number; maxHp: number };
  'player:rage': { rage: number };               // 0-100
  'player:combo': { count: number };             // 當前連擊數，0 = 中斷
  'player:downed': { revivesLeft: number };
  'player:revived': { hp: number };
  'enemy:spawned': { defId: string };
  'enemy:damaged': { defId: string; hp: number; maxHp: number };
  'enemy:died': { defId: string; money: number };
  'boss:phase': { phase: number };
  'quest:updated': { progress: QuestProgress[] };
  'quest:failed': { questId: string };
  'money:changed': { money: number };
  'wave:started': { index: number; total: number };
  'level:completed': { levelId: LevelId; rank: LevelRank; moneyEarned: number; skillPointsEarned: number };
  'level:failed': { levelId: LevelId };
  'state:changed': { state: GameStateName };
}

export type GameEventName = keyof GameEvents;

// ───────────────────────── UI 契約 ─────────────────────────
// ui/ 模組各自輸出 create 函式，回傳控制 API；main/systems 負責呼叫。

export interface HudAPI {
  show(): void;
  hide(): void;
  setHP(cur: number, max: number): void;
  setRage(rage: number): void;            // 0-100
  setCombo(count: number): void;          // 0 = 隱藏
  setMoney(money: number): void;
  setQuests(quests: { title: string; progressText: string; done: boolean; failed: boolean; main: boolean }[]): void;
  setBubbleTea(count: number): void;
  showBossBar(name: string): void;
  setBossHP(cur: number, max: number): void;
  hideBossBar(): void;
  announce(text: string, durationMs?: number): void;  // 大字提示（如「第 2 波」）
}

export interface TitleAPI {
  show(onStart: () => void, hasSave: boolean, onContinue: () => void): void;
  hide(): void;
}

export interface LevelMapAPI {
  show(opts: {
    unlockedLevel: LevelId;
    clearedRanks: Partial<Record<LevelId, LevelRank>>;
    onSelect: (id: LevelId) => void;
    onShop: () => void;
  }): void;
  hide(): void;
}

export interface ShopUIAPI {
  show(opts: {
    money: number;
    save: SaveData;
    items: ShopItemDef[];
    onBuy: (itemId: string) => boolean;   // 回傳是否購買成功
    onClose: () => void;
    onSkillTree: () => void;
  }): void;
  refresh(money: number, save: SaveData): void;
  hide(): void;
}

export interface SkillTreeAPI {
  show(opts: {
    skillPoints: number;
    skills: SkillDef[];
    levels: Record<string, number>;
    onUpgrade: (skillId: string) => boolean;
    onClose: () => void;
  }): void;
  refresh(skillPoints: number, levels: Record<string, number>): void;
  hide(): void;
}

export interface ResultAPI {
  show(opts: {
    success: boolean;
    levelName: string;
    rank: LevelRank | null;
    moneyEarned: number;
    skillPointsEarned: number;
    onContinue: () => void;   // 成功 → 商店；失敗 → 重試選單
    onRetry?: () => void;
    onMap?: () => void;
  }): void;
  hide(): void;
}
