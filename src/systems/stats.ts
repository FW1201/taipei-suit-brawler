import type { PlayerStats, SaveData, SkillDef } from '../types';

const BASE: PlayerStats = {
  maxHp: 100,
  lightDamage: 10,
  heavyDamage: 22,
  heavyRadius: 0,
  comboLength: 3,
  moveSpeed: 5.2,
  dodgeIFrames: 0.35,
  counterMult: 1.0,
  rageGainMult: 1.0,
  reviveHpMult: 1.0,
  damageReduction: 0,
  critChance: 0,
};

/** 由存檔（技能等級 + 裝備 + 永久加成）彙整玩家實際數值 */
export function computePlayerStats(save: SaveData, skills: SkillDef[]): PlayerStats {
  const s: PlayerStats = { ...BASE };

  for (const skill of skills) {
    const lv = save.skillLevels[skill.id] ?? 0;
    if (lv <= 0) continue;
    const v = skill.valuePerLevel * lv;
    switch (skill.effect) {
      case 'lightDamageMult': s.lightDamage *= 1 + v; break;
      case 'comboLength': s.comboLength = BASE.comboLength + lv; break;
      case 'heavyRadius': s.heavyRadius += v; break;
      case 'moveSpeedMult': s.moveSpeed *= 1 + v; break;
      case 'dodgeIFrames': s.dodgeIFrames += v; break;
      case 'counterMult': s.counterMult = 1 + v; break;
      case 'maxHpBonus': s.maxHp += v; break;
      case 'rageGainMult': s.rageGainMult = 1 + v; break;
      case 'reviveHpMult': s.reviveHpMult = 1 + v; break;
    }
  }

  // 滷味永久加成
  s.maxHp += save.maxHpPermanentBonus;
  // 裝備
  if (save.equipment.vest) s.damageReduction += 0.15;
  if (save.equipment.shoes) s.moveSpeed *= 1.1;
  if (save.equipment.tie) s.critChance += 0.1;

  // 重拳傷害隨輕拳成長
  s.heavyDamage = Math.round(BASE.heavyDamage * (s.lightDamage / BASE.lightDamage));
  s.lightDamage = Math.round(s.lightDamage);
  s.maxHp = Math.round(s.maxHp);
  return s;
}
