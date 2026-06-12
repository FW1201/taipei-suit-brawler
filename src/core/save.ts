import type { SaveData } from '../types';

const KEY = 'taipei-suit-brawler-save-v1';

export function defaultSave(): SaveData {
  return {
    version: 1,
    unlockedLevel: 1,
    clearedRanks: {},
    money: 0,
    skillPoints: 0,
    skillLevels: {},
    maxHpPermanentBonus: 0,
    equipment: { vest: false, shoes: false, tie: false },
    bubbleTeaCount: 1, // 新手送一杯珍奶
  };
}

export function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    if (data.version !== 1) return null;
    return { ...defaultSave(), ...data };
  } catch {
    return null;
  }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // 隱私模式等情況下靜默失敗，遊戲仍可玩
  }
}

export function clearSave(): void {
  localStorage.removeItem(KEY);
}
