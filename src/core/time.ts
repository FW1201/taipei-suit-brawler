// 全域時間控制：hitstop（命中瞬間微慢動作）強化打擊感。

let hitstopLeft = 0;

export const timeCtl = {
  /** 觸發 hitstop：duration 秒內遊戲時間幾乎凍結 */
  hitstop(duration: number): void {
    hitstopLeft = Math.max(hitstopLeft, duration);
  },
  /** 由 Engine 每幀呼叫：傳入真實 dt，回傳縮放後 dt */
  scale(realDt: number): number {
    if (hitstopLeft > 0) {
      hitstopLeft -= realDt;
      return realDt * 0.08;
    }
    return realDt;
  },
};
