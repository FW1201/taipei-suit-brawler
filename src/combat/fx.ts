// 戰鬥視覺回饋：浮動傷害數字 + 敵人頭頂血條（DOM overlay，投影自 2D 世界座標）。
import { Vec3 } from '../core/vec';
import type { GameCamera } from '../core/camera';
import type { Enemy } from '../enemies/enemy';

const _v = new Vec3();

export class CombatFX {
  private layer: HTMLDivElement;
  private bars = new Map<Enemy, HTMLDivElement>();

  constructor() {
    this.layer = document.createElement('div');
    this.layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;';
    document.getElementById('ui-root')!.appendChild(this.layer);
    if (!document.getElementById('tsb-fx-style')) {
      const style = document.createElement('style');
      style.id = 'tsb-fx-style';
      style.textContent = `
        @keyframes tsb-dmg-rise {
          0% { transform: translate(-50%, 0) scale(0.6); opacity: 0; }
          15% { transform: translate(-50%, -14px) scale(1.15); opacity: 1; }
          100% { transform: translate(-50%, -52px) scale(1); opacity: 0; }
        }
        .tsb-dmg {
          position: absolute; font-family: 'Noto Sans TC', sans-serif;
          font-weight: 900; text-shadow: 0 2px 6px rgba(0,0,0,0.8);
          animation: tsb-dmg-rise 0.7s ease-out forwards; pointer-events: none;
        }
        .tsb-ehp {
          position: absolute; width: 46px; height: 5px; transform: translate(-50%, 0);
          background: rgba(0,0,0,0.65); border: 1px solid rgba(255,255,255,0.25);
          border-radius: 3px; overflow: hidden; pointer-events: none;
        }
        .tsb-ehp > div { height: 100%; background: linear-gradient(90deg,#ff4444,#ff8866); transition: width 0.12s; }
      `;
      document.head.appendChild(style);
    }
  }

  /** 浮動傷害數字 */
  damageNumber(worldPos: Vec3, amount: number, isCrit: boolean, camera: GameCamera): void {
    const { x, y } = camera.worldToScreen(worldPos);
    const el = document.createElement('div');
    el.className = 'tsb-dmg';
    el.textContent = String(Math.round(amount));
    el.style.left = `${x + (Math.random() - 0.5) * 24}px`;
    el.style.top = `${y}px`;
    el.style.fontSize = isCrit ? '30px' : '20px';
    el.style.color = isCrit ? '#FFD700' : '#FFFFFF';
    if (isCrit) el.textContent += '!';
    this.layer.appendChild(el);
    setTimeout(() => el.remove(), 750);
  }

  /** 每幀更新敵人頭頂血條 */
  updateEnemyBars(enemies: readonly Enemy[], camera: GameCamera): void {
    for (const e of enemies) {
      const show = e.isAlive() && e.hp < e.maxHp;
      let bar = this.bars.get(e);
      if (show && !bar) {
        bar = document.createElement('div');
        bar.className = 'tsb-ehp';
        bar.innerHTML = '<div></div>';
        this.layer.appendChild(bar);
        this.bars.set(e, bar);
      }
      if (!bar) continue;
      if (!show) {
        bar.remove();
        this.bars.delete(e);
        continue;
      }
      _v.copy(e.position);
      _v.y = 2.15 * e.def.scale;
      const { x, y } = camera.worldToScreen(_v);
      bar.style.display = 'block';
      bar.style.left = `${x}px`;
      bar.style.top = `${y}px`;
      (bar.firstElementChild as HTMLDivElement).style.width = `${(e.hp / e.maxHp) * 100}%`;
    }
  }

  dispose(): void {
    this.layer.remove();
    this.bars.clear();
  }
}
