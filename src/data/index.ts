// 《西裝正義》遊戲資料入口 — 統一以正確型別輸出五份 JSON 資料。
// JSON 由 resolveJsonModule 載入後為寬鬆型別（string 等），此處集中斷言為 types.ts 契約型別。

import type { EnemyDef, SkillDef, ShopItemDef, QuestDef, LevelDef, LevelId } from '../types';

import enemiesJson from './enemies.json';
import skillsJson from './skills.json';
import shopJson from './shop.json';
import questsJson from './quests.json';
import levelsJson from './levels.json';

export const ENEMIES = enemiesJson as unknown as EnemyDef[];
export const SKILLS = skillsJson as unknown as SkillDef[];
export const SHOP_ITEMS = shopJson as unknown as ShopItemDef[];
export const QUESTS = questsJson as unknown as QuestDef[];
export const LEVELS = levelsJson as unknown as LevelDef[];

/** 依 id 取得敵人定義（找不到時丟出錯誤，及早暴露資料/程式不一致） */
export function getEnemyDef(id: string): EnemyDef {
  const def = ENEMIES.find((e) => e.id === id);
  if (!def) throw new Error(`[data] 找不到敵人定義：${id}`);
  return def;
}

/** 取得某關卡的全部任務（主線在前、支線在後，維持 JSON 原始順序） */
export function getQuestsForLevel(levelId: LevelId): QuestDef[] {
  return QUESTS.filter((q) => q.levelId === levelId);
}

/** 依關卡 id 取得關卡定義 */
export function getLevelDef(id: LevelId): LevelDef {
  const def = LEVELS.find((l) => l.id === id);
  if (!def) throw new Error(`[data] 找不到關卡定義：${id}`);
  return def;
}
