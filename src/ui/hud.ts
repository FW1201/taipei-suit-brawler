// 戰鬥 HUD — 血條 / 怒氣 / 珍奶庫存 / 任務清單 / 金錢 / 連擊 / Boss 血條 / 大字提示。

import type { HudAPI } from '../types';
import { ensureStyles, uiRoot, el } from './styles';

const BUBBLE_TEA_MAX = 3;

export function createHUD(): HudAPI {
  ensureStyles();

  const root = el('div', 'tsb-hud');
  root.style.display = 'none';

  // ── 左上：血條 + 怒氣條 + 珍奶 ──
  const topLeft = el('div', 'tsb-hud-topleft');

  const hpBar = el('div', 'tsb-bar');
  const hpFill = el('div', 'tsb-bar-fill tsb-bar-fill--hp');
  const hpLabel = el('div', 'tsb-bar-label', 'HP 100 / 100');
  hpBar.append(hpFill, hpLabel);

  const rageBar = el('div', 'tsb-bar tsb-bar--rage');
  const rageFill = el('div', 'tsb-bar-fill tsb-bar-fill--rage');
  rageBar.append(rageFill);

  // 重擊蓄力條（金色，滿格可放重擊 K）
  const powerBar = el('div', 'tsb-bar tsb-bar--power');
  const powerFill = el('div', 'tsb-bar-fill tsb-bar-fill--power');
  const powerLabel = el('div', 'tsb-bar-label tsb-bar-label--power', '重擊');
  powerBar.append(powerFill, powerLabel);

  const teaRow = el('div', 'tsb-tea-row');
  const teaSlots: HTMLElement[] = [];
  for (let i = 0; i < BUBBLE_TEA_MAX; i++) {
    const slot = el('div', 'tsb-tea-slot tsb-tea-slot--empty', '🧋');
    teaSlots.push(slot);
    teaRow.append(slot);
  }

  topLeft.append(hpBar, rageBar, powerBar, teaRow);

  // ── 右上：任務清單 ──
  const questBox = el('div', 'tsb-hud-quests');
  const questHeader = el('h4', '', 'MISSION');
  const questList = el('div');
  questBox.append(questHeader, questList);

  // ── 左下：金錢 ──
  const moneyBox = el('div', 'tsb-hud-money', 'NT$ 0');

  // ── 中央偏右：連擊 ──
  const comboBox = el('div', 'tsb-hud-combo');
  const comboNum = el('div', '', '0');
  const comboLabel = el('small', '', 'COMBO');
  comboBox.append(comboNum, comboLabel);

  // ── 上方中央：Boss 血條 ──
  const bossBar = el('div', 'tsb-bossbar');
  const bossName = el('div', 'tsb-bossbar-name', '');
  const bossTrack = el('div', 'tsb-bar');
  const bossFill = el('div', 'tsb-bar-fill');
  bossTrack.append(bossFill);
  bossBar.append(bossName, bossTrack);

  // ── 全螢幕大字提示 ──
  const announceBox = el('div', 'tsb-announce');
  const announceText = el('span', '', '');
  announceBox.append(announceText);
  let announceTimer: number | undefined;

  root.append(topLeft, questBox, moneyBox, comboBox, bossBar, announceBox);
  uiRoot().append(root);

  return {
    show() {
      root.style.display = 'block';
    },
    hide() {
      root.style.display = 'none';
    },
    setHP(cur, max) {
      const safeCur = Math.max(0, Math.min(cur, max));
      hpFill.style.width = `${max > 0 ? (safeCur / max) * 100 : 0}%`;
      hpLabel.textContent = `HP ${Math.ceil(safeCur)} / ${max}`;
    },
    setRage(rage) {
      rageFill.style.width = `${Math.max(0, Math.min(rage, 100))}%`;
    },
    setPower(power, ready) {
      powerFill.style.width = `${Math.max(0, Math.min(power, 100))}%`;
      powerBar.classList.toggle('tsb-bar--power-ready', ready);
    },
    setCombo(count) {
      if (count <= 0) {
        comboBox.style.display = 'none';
        return;
      }
      comboNum.textContent = String(count);
      comboBox.style.display = 'block';
      // 重新觸發跳動動畫
      comboBox.classList.remove('tsb-pop');
      void comboBox.offsetWidth;
      comboBox.classList.add('tsb-pop');
    },
    setMoney(money) {
      moneyBox.textContent = `NT$ ${money.toLocaleString('zh-TW')}`;
    },
    setQuests(quests) {
      questList.innerHTML = '';
      for (const q of quests) {
        const row = el('div', `tsb-quest ${q.main ? 'tsb-quest--main' : 'tsb-quest--side'}`);
        if (q.done) row.classList.add('tsb-quest--done');
        if (q.failed) row.classList.add('tsb-quest--failed');
        const mark = el('span', '', q.done ? '✔' : q.failed ? '✘' : q.main ? '◆' : '◇');
        const title = el('span', 'tsb-quest-title', q.title);
        const progress = el('span', 'tsb-quest-progress', q.progressText);
        row.append(mark, title, progress);
        questList.append(row);
      }
    },
    setBubbleTea(count) {
      teaSlots.forEach((slot, i) => {
        slot.classList.toggle('tsb-tea-slot--empty', i >= count);
      });
    },
    showBossBar(name) {
      bossName.textContent = name;
      bossBar.style.display = 'flex';
    },
    setBossHP(cur, max) {
      bossFill.style.width = `${max > 0 ? (Math.max(0, cur) / max) * 100 : 0}%`;
    },
    hideBossBar() {
      bossBar.style.display = 'none';
    },
    announce(text, durationMs = 1800) {
      if (announceTimer !== undefined) window.clearTimeout(announceTimer);
      announceText.textContent = text;
      announceBox.style.setProperty('--tsb-announce-ms', `${durationMs}ms`);
      announceBox.classList.remove('tsb-announce--show');
      void announceBox.offsetWidth;
      announceBox.classList.add('tsb-announce--show');
      announceTimer = window.setTimeout(() => {
        announceBox.classList.remove('tsb-announce--show');
        announceTimer = undefined;
      }, durationMs);
    },
  };
}
