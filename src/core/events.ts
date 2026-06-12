import type { GameEvents, GameEventName } from '../types';

type Handler<K extends GameEventName> = (payload: GameEvents[K]) => void;

class EventBus {
  private handlers = new Map<GameEventName, Set<Handler<any>>>();

  on<K extends GameEventName>(event: K, handler: Handler<K>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler);
    return () => set!.delete(handler);
  }

  emit<K extends GameEventName>(event: K, payload: GameEvents[K]): void {
    this.handlers.get(event)?.forEach((h) => h(payload));
  }

  clear(): void {
    this.handlers.clear();
  }
}

/** 全域事件匯流排：戰鬥層發事件，系統層/HUD 訂閱 */
export const bus = new EventBus();
