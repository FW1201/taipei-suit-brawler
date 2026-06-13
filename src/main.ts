// 《西裝正義》Taipei Suit Brawler — 遊戲入口與狀態機
// title → map → level → result → shop → map …

import { Engine } from './core/engine';
import { GameCamera } from './core/camera';
import { bus } from './core/events';
import { initAudio, playSound } from './core/audio';
import { bgm, type BgmKey } from './core/music';
import { MANIFEST } from './core/manifest';
import { loadSprites } from './core/sprites';
import { loadScenes } from './core/scene-art';
import { defaultSave, loadSave, writeSave, clearSave } from './core/save';
import { computePlayerStats } from './systems/stats';
import { LevelRunner } from './levels/level';
import { getLevelDef, getQuestsForLevel, SHOP_ITEMS, SKILLS } from './data';
import { createHUD, createTitle, createLevelMap, createShopUI, createSkillTree, createResult, createEnding } from './ui';
import { mountHotkeyHud } from './ui/hotkey-hud';
import type { LevelId, SaveData, ShopItemDef } from './types';

class Game {
  private engine = new Engine(document.getElementById('app')!);
  private hud = createHUD();
  private title = createTitle();
  private map = createLevelMap();
  private shop = createShopUI();
  private skillTree = createSkillTree();
  private result = createResult();
  private ending = createEnding();

  private save: SaveData;
  private runner: LevelRunner | null = null;
  private currentLevel: LevelId = 1;

  constructor() {
    this.save = loadSave() ?? defaultSave();
    initAudio(MANIFEST.audio);
    void loadSprites(); // AI sprite sheet（有素材自動切換，無素材用程式化角色）
    void loadScenes();  // AI 場景 backdrop（有圖自動用，無圖用程式剪影）
    mountHotkeyHud();   // 右下角快捷鍵提示 + BGM 開關
    this.wireHud();
    this.engine.start();
    this.showTitle();
  }

  // ───────── HUD 事件接線 ─────────
  private wireHud(): void {
    bus.on('player:damaged', ({ hp, maxHp }) => this.hud.setHP(hp, maxHp));
    bus.on('player:healed', ({ hp, maxHp }) => this.hud.setHP(hp, maxHp));
    bus.on('player:rage', ({ rage }) => this.hud.setRage(rage));
    bus.on('player:power', ({ power, ready }) => this.hud.setPower(power, ready));
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
    bgm.play('title');
    const hasSave = loadSave() !== null;
    this.title.show(
      () => { this.save = defaultSave(); writeSave(this.save); this.title.hide(); this.showMap(); },
      hasSave,
      () => { this.title.hide(); this.showMap(); },
    );
  }

  /** 標題/選關背景：橫向緩慢捲動的西門町夜景 */
  private backdropOff: (() => void) | null = null;
  private buildBackdrop(): void {
    this.teardownLevel();
    this.engine.clearScene();
    void import('./levels/builder').then(({ buildEnvironment }) => {
      const LEN = 80;
      const env = buildEnvironment('neon', LEN);
      const cam = new GameCamera();
      cam.setLevelBounds(0, LEN);
      let t = 0;
      this.backdropOff = this.engine.onUpdate((dt) => {
        t += dt;
        cam.update(LEN / 2 + Math.sin(t * 0.06) * (LEN / 2 - 12), dt);
      });
      this.engine.setDraw((ctx, w, h) => {
        cam.viewport(w, h);
        env.drawBackground(ctx, cam, w, h, t);
        env.drawForeground(ctx, cam, w, h, t);
      });
    });
  }

  // ───────── 場景：選關地圖 ─────────
  private showMap(): void {
    bus.emit('state:changed', { state: 'map' });
    bgm.play('title');
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
    const LEVEL_BGM: Record<LevelId, BgmKey> = {
      1: 'lv1_neon', 2: 'lv2_nightmarket', 3: 'lv3_temple',
      4: 'lv4_skybridge', 5: 'lv5_rooftop',
    };
    bgm.play(LEVEL_BGM[id]);
    this.currentLevel = id;
    this.levelMoneyLive = 0;
    this.teardownLevel();
    this.engine.clearScene();

    const stats = computePlayerStats(this.save, SKILLS);
    this.hud.setMoney(this.save.money);
    this.hud.setBubbleTea(this.save.bubbleTeaCount);
    this.hud.setHP(stats.maxHp, stats.maxHp);
    this.hud.setRage(0);
    this.hud.setPower(0, false);
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
        bgm.play(outcome.success ? 'result_win' : 'result_fail');
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
            // 第五關（最終 Boss）通關 → 通關全劇結局畫面
            if (outcome.success && id === 5 && outcome.rank) {
              this.showEnding(outcome.rank, outcome.moneyEarned, outcome.skillPointsEarned);
              return;
            }
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

  // ───────── 場景：通關結局 ─────────
  private showEnding(finalRank: import('./types').LevelRank, finalMoneyEarned: number, finalSkillPointsEarned: number): void {
    bus.emit('state:changed', { state: 'result' });
    bgm.play('ending');
    this.buildBackdrop();
    this.ending.show({
      save: this.save,
      finalRank,
      finalMoneyEarned,
      finalSkillPointsEarned,
      onRestart: () => {
        // 清空存檔 → 預設新檔 → 回標題
        clearSave();
        this.save = defaultSave();
        writeSave(this.save);
        this.ending.hide();
        this.showTitle();
      },
      onFreeplay: () => {
        // 留檔，回選關地圖（自由重玩、累積金錢/技能）
        this.ending.hide();
        this.showMap();
      },
    });
  }

  // ───────── 場景：商店 + 技能樹 ─────────
  private showShop(onDone: () => void): void {
    bus.emit('state:changed', { state: 'shop' });
    bgm.play('shop');
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
