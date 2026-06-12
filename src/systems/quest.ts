import type { QuestDef, QuestProgress } from '../types';
import { bus } from '../core/events';
import { playSound } from '../core/audio';

interface TrackedQuest {
  def: QuestDef;
  progress: number;
  done: boolean;
  failed: boolean;
  timer: number; // timed 用，倒數
}

/** 單一關卡的任務追蹤器：由 LevelRunner 餵入事件，對外發 quest:updated */
export class QuestTracker {
  private quests: TrackedQuest[] = [];

  constructor(defs: QuestDef[]) {
    this.quests = defs.map((def) => ({
      def,
      progress: 0,
      done: false,
      failed: false,
      timer: def.timeLimit ?? 0,
    }));
    this.publish();
  }

  update(dt: number): void {
    let changed = false;
    for (const q of this.quests) {
      if (q.done || q.failed) continue;
      if (q.def.type === 'timed' && q.def.timeLimit) {
        q.timer -= dt;
        if (q.timer <= 0) {
          q.failed = true;
          changed = true;
          bus.emit('quest:failed', { questId: q.def.id });
        }
      }
    }
    if (changed) this.publish();
  }

  onEnemyDied(isBoss: boolean): void {
    let changed = false;
    for (const q of this.quests) {
      if (q.done || q.failed) continue;
      if (q.def.type === 'kill_count' && !isBoss) {
        q.progress += 1;
        if (q.progress >= q.def.target) this.complete(q);
        changed = true;
      } else if (q.def.type === 'timed' && !isBoss) {
        q.progress += 1;
        if (q.progress >= q.def.target) this.complete(q);
        changed = true;
      } else if (q.def.type === 'kill_boss' && isBoss) {
        q.progress = 1;
        this.complete(q);
        changed = true;
      }
    }
    if (changed) this.publish();
  }

  onPlayerDamaged(): void {
    let changed = false;
    for (const q of this.quests) {
      if (q.done || q.failed) continue;
      if (q.def.type === 'no_damage') {
        q.failed = true;
        changed = true;
        bus.emit('quest:failed', { questId: q.def.id });
      }
    }
    if (changed) this.publish();
  }

  onWaveCleared(): void {
    let changed = false;
    for (const q of this.quests) {
      if (q.done || q.failed) continue;
      if (q.def.type === 'survive') {
        q.progress += 1;
        if (q.progress >= q.def.target) this.complete(q);
        changed = true;
      }
    }
    if (changed) this.publish();
  }

  /** protect 目標受損：pct = 剩餘比例 0-1，歸零即失敗 */
  onProtectDamaged(pct: number): void {
    let changed = false;
    for (const q of this.quests) {
      if (q.done || q.failed) continue;
      if (q.def.type === 'protect') {
        q.progress = Math.round(pct * 100);
        if (pct <= 0) {
          q.failed = true;
          bus.emit('quest:failed', { questId: q.def.id });
        }
        changed = true;
      }
    }
    if (changed) this.publish();
  }

  /** 關卡結束時呼叫：存活類任務若未失敗即完成 */
  finalize(): void {
    for (const q of this.quests) {
      if (q.done || q.failed) continue;
      if (q.def.type === 'no_damage' || q.def.type === 'protect') this.complete(q);
    }
    this.publish();
  }

  private complete(q: TrackedQuest): void {
    q.done = true;
    q.progress = q.def.target;
    playSound('questDone');
  }

  get allMainDone(): boolean {
    return this.quests.filter((q) => q.def.main).every((q) => q.done);
  }

  get anyMainFailed(): boolean {
    return this.quests.some((q) => q.def.main && q.failed);
  }

  get sideQuestsDone(): number {
    return this.quests.filter((q) => !q.def.main && q.done).length;
  }

  get sideQuestsTotal(): number {
    return this.quests.filter((q) => !q.def.main).length;
  }

  get rewards(): { money: number; skillPoints: number } {
    let money = 0, skillPoints = 0;
    for (const q of this.quests) {
      if (q.done) {
        money += q.def.rewardMoney;
        skillPoints += q.def.rewardSkillPoints;
      }
    }
    return { money, skillPoints };
  }

  snapshot(): QuestProgress[] {
    return this.quests.map((q) => ({
      questId: q.def.id,
      progress: q.progress,
      done: q.done,
      failed: q.failed,
    }));
  }

  /** HUD 顯示用 */
  hudList(): { title: string; progressText: string; done: boolean; failed: boolean; main: boolean }[] {
    return this.quests.map((q) => {
      let progressText = '';
      switch (q.def.type) {
        case 'kill_count': progressText = `${q.progress}/${q.def.target}`; break;
        case 'timed': progressText = q.done || q.failed ? `${q.progress}/${q.def.target}` : `${q.progress}/${q.def.target}（剩 ${Math.max(0, Math.ceil(q.timer))} 秒）`; break;
        case 'kill_boss': progressText = q.done ? '完成' : '擊敗頭目'; break;
        case 'protect': progressText = q.failed ? '失敗' : `${q.progress || 100}%`; break;
        case 'no_damage': progressText = q.failed ? '失敗' : q.done ? '完成' : '維持中'; break;
        case 'survive': progressText = `${q.progress}/${q.def.target} 波`; break;
      }
      return { title: q.def.title, progressText, done: q.done, failed: q.failed, main: q.def.main };
    });
  }

  private publish(): void {
    bus.emit('quest:updated', { progress: this.snapshot() });
  }
}
