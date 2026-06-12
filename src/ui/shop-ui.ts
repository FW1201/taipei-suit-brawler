// 夜市商店「阿婆ㄟ攤仔」— 商品卡片網格 + 技能修練入口。

import type { ShopUIAPI, ShopItemDef, SaveData, EquipmentState } from '../types';
import { ensureStyles, uiRoot, el } from './styles';

const BUBBLE_TEA_MAX = 3;

/** 裝備類商品效果 → 存檔 equipment 欄位對應 */
const EQUIP_KEY: Partial<Record<ShopItemDef['effect'], keyof EquipmentState>> = {
  damageReduction: 'vest',
  moveSpeed: 'shoes',
  critChance: 'tie',
};

interface ShopOpts {
  money: number;
  save: SaveData;
  items: ShopItemDef[];
  onBuy: (itemId: string) => boolean;
  onClose: () => void;
  onSkillTree: () => void;
}

export function createShopUI(): ShopUIAPI {
  ensureStyles();

  const screen = el('div', 'tsb-screen');
  screen.style.display = 'none';
  uiRoot().append(screen);

  let current: ShopOpts | null = null;

  function render(): void {
    if (!current) return;
    const { money, save, items } = current;
    screen.innerHTML = '';

    const panel = el('div', 'tsb-panel');
    panel.style.cssText = 'width:min(820px,92vw);max-height:86vh;overflow-y:auto;';

    // 頂部列：標題 + 金額
    const topRow = el('div');
    topRow.style.cssText = 'display:flex;align-items:baseline;justify-content:space-between;gap:16px;flex-wrap:wrap;';
    const title = el('h2', 'tsb-title-glow', '🏮 阿婆ㄟ攤仔');
    title.style.cssText = 'margin:0;font-size:30px;font-weight:900;letter-spacing:0.15em;';
    const moneyLabel = el('div', '', `持有 NT$ ${money.toLocaleString('zh-TW')}`);
    moneyLabel.style.cssText = 'font-size:19px;font-weight:900;color:#FFD75E;text-shadow:0 0 8px rgba(255,215,94,0.5);';
    topRow.append(title, moneyLabel);

    const slogan = el('p', '', '「少年仔，呷飽未？要拚正義嘛要先補一下。」');
    slogan.style.cssText = 'margin:6px 0 0;font-size:13px;color:rgba(230,237,243,0.6);';

    // 商品網格
    const grid = el('div', 'tsb-shop-grid');
    for (const item of items) {
      const equipKey = item.type === 'equipment' ? EQUIP_KEY[item.effect] : undefined;
      const owned = equipKey ? save.equipment[equipKey] : false;
      const isTea = item.effect === 'healFull';
      const teaFull = isTea && save.bubbleTeaCount >= BUBBLE_TEA_MAX;
      const affordable = money >= item.price;
      const buyable = !owned && !teaFull && affordable;

      const card = el('div', 'tsb-shop-card');
      if (!buyable) card.classList.add('tsb-shop-card--disabled');

      const icon = el('div', 'tsb-shop-icon', item.icon);
      const name = el('div', 'tsb-shop-name', item.name);
      const desc = el('div', 'tsb-shop-desc', item.description);
      card.append(icon, name, desc);

      if (isTea) {
        const stock = el('div', '', `庫存 ${save.bubbleTeaCount} / ${BUBBLE_TEA_MAX}`);
        stock.style.cssText = 'font-size:12px;color:#00D4FF;';
        card.append(stock);
      }

      const bottom = el('div');
      bottom.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;';
      const price = el('div', 'tsb-shop-price', `NT$ ${item.price.toLocaleString('zh-TW')}`);
      bottom.append(price);

      if (owned) {
        bottom.append(el('div', 'tsb-shop-owned', '✔ 已擁有'));
      } else {
        const buyBtn = el('button', 'tsb-skill-btn', teaFull ? '庫存已滿' : '購買');
        buyBtn.disabled = !buyable;
        buyBtn.addEventListener('click', () => {
          const ok = current!.onBuy(item.id);
          if (!ok) {
            card.classList.remove('tsb-shake');
            void card.offsetWidth;
            card.classList.add('tsb-shake');
          }
        });
        bottom.append(buyBtn);
      }
      card.append(bottom);
      grid.append(card);
    }

    // 底部按鈕列
    const btnRow = el('div');
    btnRow.style.cssText = 'display:flex;justify-content:flex-end;gap:14px;margin-top:20px;';
    const skillBtn = el('button', 'tsb-btn', '🥋 技能修練');
    skillBtn.addEventListener('click', () => current!.onSkillTree());
    const closeBtn = el('button', 'tsb-btn tsb-btn--accent', '🚇 出發');
    closeBtn.addEventListener('click', () => current!.onClose());
    btnRow.append(skillBtn, closeBtn);

    panel.append(topRow, slogan, grid, btnRow);
    screen.append(panel);
  }

  return {
    show(opts) {
      current = opts;
      render();
      screen.style.display = 'flex';
    },
    refresh(money, save) {
      if (!current) return;
      current = { ...current, money, save };
      render();
    },
    hide() {
      screen.style.display = 'none';
    },
  };
}
