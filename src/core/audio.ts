// 輕量音效播放：manifest 有檔就播，沒有就用 WebAudio 合成短音 fallback，永不報錯。

let manifest: Record<string, string> = {};
let ctx: AudioContext | null = null;
const cache = new Map<string, HTMLAudioElement>();

export function initAudio(audioManifest: Record<string, string>): void {
  manifest = audioManifest;
}

function synthBeep(freq: number, durationMs: number, type: OscillatorType = 'square', gain = 0.06): void {
  try {
    ctx ??= new AudioContext();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs / 1000);
    osc.connect(g).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000);
  } catch {
    /* 無聲也不影響遊戲 */
  }
}

const SYNTH_FALLBACK: Record<string, () => void> = {
  punchHit: () => synthBeep(120, 90, 'square', 0.08),
  punchSwing: () => synthBeep(300, 50, 'sine', 0.03),
  heavyHit: () => synthBeep(80, 160, 'sawtooth', 0.1),
  dodge: () => synthBeep(500, 60, 'sine', 0.04),
  hurt: () => synthBeep(160, 140, 'triangle', 0.07),
  enemyDown: () => synthBeep(100, 220, 'triangle', 0.07),
  rage: () => synthBeep(60, 400, 'sawtooth', 0.1),
  uiClick: () => synthBeep(700, 40, 'square', 0.04),
  buy: () => synthBeep(900, 80, 'sine', 0.05),
  upgrade: () => synthBeep(550, 120, 'sine', 0.05),
  heal: () => synthBeep(440, 150, 'sine', 0.05),
  questDone: () => synthBeep(660, 200, 'sine', 0.06),
};

export function playSound(key: string): void {
  const url = manifest[key];
  if (url) {
    try {
      let el = cache.get(key);
      if (!el) {
        el = new Audio(url);
        cache.set(key, el);
      }
      el.currentTime = 0;
      el.volume = 0.5;
      void el.play().catch(() => SYNTH_FALLBACK[key]?.());
      return;
    } catch {
      /* fall through */
    }
  }
  SYNTH_FALLBACK[key]?.();
}
