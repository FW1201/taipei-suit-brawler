// 鍵盤輸入：isDown 查持續按住，consumePress 查「這次按下」（取用後清除）

const down = new Set<string>();
const pressed = new Set<string>();

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (!down.has(k)) pressed.add(k);
  down.add(k);
  if (['w', 'a', 's', 'd', ' ', 'j', 'k', 'l', 'e'].includes(k)) e.preventDefault();
});
window.addEventListener('keyup', (e) => down.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => { down.clear(); pressed.clear(); });

export const input = {
  isDown(key: string): boolean {
    return down.has(key.toLowerCase());
  },
  /** 本幀是否剛按下；回傳 true 後即清除，同幀重複呼叫只有第一次為 true */
  consumePress(key: string): boolean {
    const k = key.toLowerCase();
    if (pressed.has(k)) {
      pressed.delete(k);
      return true;
    }
    return false;
  },
  /** 每幀結尾呼叫，清掉未被取用的 press */
  endFrame(): void {
    pressed.clear();
  },
};
