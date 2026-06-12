// 技能修練 — 三系（鐵拳 / 身法 / 體魄）技能樹面板。

import type { SkillTreeAPI, SkillDef, SkillBranch } from '../types';
import { ensureStyles, uiRoot, el } from './styles';

const BRANCH_META: Record<SkillBranch, { label: string; color: string }> = {
  fist: { label: '鐵拳', color: '#FF6B35' },
  agility: { label: '身法', color: '#00D4FF' },
  body: { label: '體魄', color: '#7B2FFF' },
};

interface TreeOpts {
  skillPoints: number;
  skills: SkillDef[];
  levels: Record<string, number>;
  onUpgrade: (skillId: string) => boolean;
  onClose: () => void;
}

export function createSkillTree(): SkillTreeAPI {
  ensureStyles();

  const screen = el('div', 'tsb-screen');
  screen.style.display = 'none';
  uiRoot().append(screen);

  let current: TreeOpts | null = null;

  function render(): void {
    if (!current) return;
    const { skillPoints, skills, levels } = current;
    screen.innerHTML = '';

    const panel = el('div', 'tsb-panel');
    panel.style.cssText = 'width:min(900px,94vw);max-height:88vh;overflow-y:auto;';

    const topRow = el('div');
    topRow.style.cssText = 'display:flex;align-items:baseline;justify-content:space-between;gap:16px;flex-wrap:wrap;';
    const title = el('h2', 'tsb-title-glow', '🥋 技能修練');
    title.style.cssText = 'margin:0;font-size:30px;font-weight:900;letter-spacing:0.15em;';
    const points = el('div', '', `剩餘技能點：${skillPoints}`);
    points.style.cssText = 'font-size:18px;font-weight:900;color:#5BE38A;text-shadow:0 0 8px rgba(91,227,138,0.5);';
    topRow.append(title, points);

    const cols = el('div', 'tsb-skill-cols');
    for (const branch of ['fist', 'agility', 'body'] as SkillBranch[]) {
      const meta = BRANCH_META[branch];
      const col = el('div', 'tsb-skill-col');
      col.style.borderColor = `${meta.color}66`;
      col.style.background = `${meta.color}0D`;

      const head = el('h3', '', meta.label);
      head.style.color = meta.color;
      head.style.textShadow = `0 0 12px ${meta.color}AA`;
      col.append(head);

      for (const skill of skills.filter((s) => s.branch === branch)) {
        const lv = levels[skill.id] ?? 0;
        const maxed = lv >= skill.maxLevel;
        const cost = maxed ? 0 : skill.costPerLevel[lv];
        const canUpgrade = !maxed && skillPoints >= cost;

        const box = el('div', 'tsb-skill');
        const name = el('div', 'tsb-skill-name', skill.name);
        name.style.color = meta.color;
        const desc = el('div', 'tsb-skill-desc', skill.description);

        const row = el('div', 'tsb-skill-row');
        const dots = el('span', 'tsb-skill-dots');
        dots.textContent = '●'.repeat(lv) + '○'.repeat(skill.maxLevel - lv);
        dots.style.color = meta.color;

        const btn = el('button', 'tsb-skill-btn', maxed ? '已滿級' : `升級（${cost} 點）`);
        btn.disabled = !canUpgrade;
        if (!maxed) {
          btn.addEventListener('click', () => {
            current!.onUpgrade(skill.id);
          });
        }

        row.append(dots, btn);
        box.append(name, desc, row);
        col.append(box);
      }
      cols.append(col);
    }

    const btnRow = el('div');
    btnRow.style.cssText = 'display:flex;justify-content:flex-end;margin-top:20px;';
    const closeBtn = el('button', 'tsb-btn tsb-btn--accent', '修練完成');
    closeBtn.addEventListener('click', () => current!.onClose());
    btnRow.append(closeBtn);

    panel.append(topRow, cols, btnRow);
    screen.append(panel);
  }

  return {
    show(opts) {
      current = opts;
      render();
      screen.style.display = 'flex';
    },
    refresh(skillPoints, levels) {
      if (!current) return;
      current = { ...current, skillPoints, levels };
      render();
    },
    hide() {
      screen.style.display = 'none';
    },
  };
}
