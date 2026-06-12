// 《西裝正義》Taipei Suit Brawler — 遊戲入口與狀態機
// title → map → level → result → shop → map …

import { Engine } from './core/engine';
import { bus } from './core/events';
import { initAudio, playSound } from './core/audio';
import { MANIFEST } from './core/manifest';
import { defaultSave, loadSave, writeSave } from './core/save';
import { computePlayerStats } from './systems/stats';
import { LevelRunner } from './levels/level';
import { getLevelDef, getQuestsForLevel, SHOP_ITEMS, SKILLS } from './data';
import { createHUD, createTitle, createLevelMap, createShopUI, createSkillTree, createResult } from './ui';
import type { LevelId, SaveData, ShopItemDef } from './types';

class Game {
  private engine = new Engine(document.getElementById('app')!);
  private hud = createHUD();
  private title = createTitle();
  private map = createLevelMap();
  private shop = createShopUI();
  private skillTree = createSkillTree();
  private result = createResult();

  private save: SaveData;
  private runner: LevelRunner | null = null;
  private currentLevel: LevelId = 1;

  constructor() {
    this.save = loadSave() ?? defaultSave();
    initAudio(MANIFEST.audio);
    this.wireHud();
    this.engine.start();
    this.showTitle();
  }

  // ───────── HUD 事件接線 ─────────
  private wireHud(): void {
    bus.on('player:damaged', ({ hp, maxHp }) => this.hud.setHP(hp, maxHp));
    bus.on('player:healed', ({ hp, maxHp }) => this.hud.setHP(hp, maxHp));
    bus.on('player:rage', ({ rage }) => this.hud.setRage(rage));
    bus.on('player:combo', ({ count }) => this.hud.setCombo(count));
    bus.on('enemy:died', ({ money }) => {
      // 關卡內即時顯示累計（實際入帳在結算）
      this.levelMoneyLive += money;
      this.hud.setMoney(this.save.money + this.levelMoneyLive);
    });
  }

  private levelMoneyLive = 0;

  // ───────── 場景：標題 ─────────
  private showTitle(): void {
    this.buildBackdrop();
    bus.emit('state:changed', { state: 'title' });
    const hasSave = loadSave() !== null;
    this.title.show(
      () => { this.save = defaultSave(); writeSave(this.save); this.title.hide(); this.showMap(); },
      hasSave,
      () => { this.title.hide(); this.showMap(); },
    );
  }

  /** 標題/選關背景：旋轉台北夜景 */
  private backdropOff: (() => void) | null = null;
  private buildBackdrop(): void {
    this.teardownLevel();
    this.engine.clearScene();
    // 重用 builder 的西門町主題當背景
    void import('./levels/builder').then(({ buildEnvironment }) => {
      const env = buildEnvironment(this.engine.scene, 'neon');
      let t = 0;
      this.backdropOff = this.engine.onUpdate((dt) => {
        t += dt;
        env.update(dt, t);
        this.engine.camera.position.set(Math.sin(t * 0.1) * 22, 9, Math.cos(t * 0.1) * 22);
        this.engine.camera.lookAt(0, 3, 0);
      });
    });
  }

  // ───────── 場景：選關地圖 ─────────
  private showMap(): void {
    bus.emit('state:changed', { state: 'map' });
    this.hud.hide();
    this.map.show({
      unlockedLevel: this.save.unlockedLevel,
      clearedRanks: this.save.clearedRanks,
      onSelect: (id) => { this.map.hide(); this.startLevel(id); },
      onShop: () => { this.map.hide(); this.showShop(() => this.showMap()); },
    });
  }

  // ───────── 場景：關卡 ─────────
  private startLevel(id: LevelId): void {
    bus.emit('state:changed', { state: 'level' });
    this.currentLevel = id;
    this.levelMoneyLive = 0;
    this.teardownLevel();
    this.engine.clearScene();

    const stats = computePlayerStats(this.save, SKILLS);
    this.hud.setMoney(this.save.money);
    this.hud.setBubbleTea(this.save.bubbleTeaCount);
    this.hud.setHP(stats.maxHp, stats.maxHp);
    this.hud.setRage(0);
    this.hud.setCombo(0);

    this.runner = new LevelRunner(
      this.engine,
      getLevelDef(id),
      getQuestsForLevel(id),
      stats,
      {
        tryDrinkTea: () => {
          if (this.save.bubbleTeaCount <= 0) return null;
          this.save.bubbleTeaCount -= 1;
          writeSave(this.save);
          this.hud.setBubbleTea(this.save.bubbleTeaCount);
          return stats.maxHp; // 回滿
        },
      },
      this.hud,
      (outcome) => {
        bus.emit('state:changed', { state: 'result' });
        this.teardownLevel();
        if (outcome.success) {
          // 入帳
          this.save.money += outcome.moneyEarned;
          this.save.skillPoints += outcome.skillPointsEarned;
          if (outcome.rank) {
            const prev = this.save.clearedRanks[id];
            const order = ['C', 'B', 'A', 'S'];
            if (!prev || order.indexOf(outcome.rank) > order.indexOf(prev)) {
              this.save.clearedRanks[id] = outcome.rank;
            }
          }
          if (id < 5) this.save.unlockedLevel = Math.max(this.save.unlockedLevel, (id + 1) as LevelId) as LevelId;
          writeSave(this.save);
        }
        this.buildBackdrop();
        this.result.show({
          success: outcome.success,
          levelName: getLevelDef(id).name,
          rank: outcome.rank,
          moneyEarned: outcome.moneyEarned,
          skillPointsEarned: outcome.skillPointsEarned,
          onContinue: () => {
            this.result.hide();
            if (outcome.success) this.showShop(() => this.showMap());
            else this.showMap();
          },
          onRetry: () => { this.result.hide(); this.startLevel(id); },
          onMap: () => { this.result.hide(); this.showMap(); },
        });
      },
    );
  }

  private teardownLevel(): void {
    this.runner?.dispose();
    this.runner = null;
    if (this.backdropOff) { this.backdropOff(); this.backdropOff = null; }
  }

  // ───────── 場景：商店 + 技能樹 ─────────
  private showShop(onDone: () => void): void {
    bus.emit('state:changed', { state: 'shop' });
    this.shop.show({
      money: this.save.money,
      save: this.save,
      items: SHOP_ITEMS,
      onBuy: (itemId) => {
        const ok = this.tryBuy(SHOP_ITEMS.find((i) => i.id === itemId)!);
        if (ok) {
          playSound('buy');
          this.shop.refresh(this.save.money, this.save);
        }
        return ok;
      },
      onClose: () => { this.shop.hide(); onDone(); },
      onSkillTree: () => {
        this.skillTree.show({
          skillPoints: this.save.skillPoints,
          skills: SKILLS,
          levels: this.save.skillLevels,
          onUpgrade: (skillId) => {
            const ok = this.tryUpgrade(skillId);
            if (ok) {
              playSound('upgrade');
              this.skillTree.refresh(this.save.skillPoints, this.save.skillLevels);
            }
            return ok;
          },
          onClose: () => {
            this.skillTree.hide();
            this.shop.refresh(this.save.money, this.save);
          },
        });
      },
    });
  }

  private tryBuy(item: ShopItemDef): boolean {
    if (this.save.money < item.price) return false;
    switch (item.effect) {
      case 'healFull':
        if (this.save.bubbleTeaCount >= 3) return false;
        this.save.bubbleTeaCount += 1;
        break;
      case 'maxHpPermanent':
        this.save.maxHpPermanentBonus += item.value;
        break;
      case 'damageReduction':
        if (this.save.equipment.vest) return false;
        this.save.equipment.vest = true;
        break;
      case 'moveSpeed':
        if (this.save.equipment.shoes) return false;
        this.save.equipment.shoes = true;
        break;
      case 'critChance':
        if (this.save.equipment.tie) return false;
        this.save.equipment.tie = true;
        break;
      case 'skillReset': {
        const refund = Object.entries(this.save.skillLevels).reduce((sum, [id, lv]) => {
          const def = SKILLS.find((s) => s.id === id);
          if (!def) return sum;
          let c = 0;
          for (let i = 0; i < lv; i++) c += def.costPerLevel[i] ?? 0;
          return sum + c;
        }, 0);
        this.save.skillLevels = {};
        this.save.skillPoints += refund;
        break;
      }
    }
    this.save.money -= item.price;
    writeSave(this.save);
    return true;
  }

  private tryUpgrade(skillId: string): boolean {
    const def = SKILLS.find((s) => s.id === skillId);
    if (!def) return false;
    const lv = this.save.skillLevels[skillId] ?? 0;
    if (lv >= def.maxLevel) return false;
    const cost = def.costPerLevel[lv] ?? Infinity;
    if (this.save.skillPoints < cost) return false;
    this.save.skillPoints -= cost;
    this.save.skillLevels[skillId] = lv + 1;
    writeSave(this.save);
    return true;
  }
}

new Game();
