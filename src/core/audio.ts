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

/** 慘叫合成：聲帶鋸齒 + 雙共振峰（F1≈700, F2≈1200，母音「啊」）+ 喉部雜訊。 */
function synthGrunt(severity: 'light' | 'heavy' | 'down'): void {
  try {
    ctx ??= new AudioContext();
    const dur = severity === 'down' ? 0.55 : severity === 'heavy' ? 0.38 : 0.22;
    const base = (severity === 'down' ? 110 : severity === 'heavy' ? 150 : 200) + (Math.random() * 40 - 20);
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(base * 1.2, now);
    osc.frequency.exponentialRampToValueAtTime(base * 0.7, now + dur);
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 700; f1.Q.value = 6;
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1180; f2.Q.value = 10;
    const noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() - 0.5) * 0.55;
    const noise = ctx.createBufferSource(); noise.buffer = noiseBuf;
    const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 950; nf.Q.value = 3;
    const g = ctx.createGain();
    const peak = severity === 'down' ? 0.16 : severity === 'heavy' ? 0.18 : 0.14;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(peak, now + 0.025);
    g.gain.setValueAtTime(peak * 0.85, now + dur * 0.45);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(f1); osc.connect(f2);
    f1.connect(g); f2.connect(g);
    noise.connect(nf).connect(g);
    g.connect(ctx.destination);
    osc.start(now); osc.stop(now + dur + 0.02);
    noise.start(now);
  } catch { /* 無聲不影響 */ }
}

const SYNTH_FALLBACK: Record<string, () => void> = {
  punchHit: () => synthBeep(120, 90, 'square', 0.08),
  punchSwing: () => synthBeep(300, 50, 'sine', 0.03),
  heavyHit: () => synthBeep(80, 160, 'sawtooth', 0.1),
  dodge: () => synthBeep(500, 60, 'sine', 0.04),
  hurt: () => synthGrunt('light'),
  heavyHurt: () => synthGrunt('heavy'),
  playerDown: () => synthGrunt('down'),
  enemyDown: () => synthGrunt('heavy'),
  rage: () => synthBeep(60, 400, 'sawtooth', 0.1),
  uiClick: () => synthBeep(700, 40, 'square', 0.04),
  buy: () => synthBeep(900, 80, 'sine', 0.05),
  upgrade: () => synthBeep(550, 120, 'sine', 0.05),
  heal: () => synthBeep(440, 150, 'sine', 0.05),
  questDone: () => synthBeep(660, 200, 'sine', 0.06),
  // 結局慶祝喇叭：C 大調琶音上揚（do mi sol do' 高八度）
  fanfare: () => {
    [523, 659, 784, 1047].forEach((hz, i) =>
      setTimeout(() => synthBeep(hz, 280, 'sawtooth', 0.07), i * 90));
    setTimeout(() => synthBeep(1568, 480, 'square', 0.05), 360);
  },
  // 人群歡呼（白噪 + bandpass 模擬）
  cheer: () => {
    try {
      ctx ??= new AudioContext();
      const dur = 1.4;
      const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() - 0.5) * 0.6;
      const src = ctx.createBufferSource(); src.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 1.5;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.25);
      g.gain.setValueAtTime(0.18, ctx.currentTime + 0.9);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      src.connect(f).connect(g).connect(ctx.destination);
      src.start();
    } catch { /* noop */ }
  },
};

// 遊戲語意鍵 → manifest 實際檔案鍵（多個 = 隨機挑一個避免單調）
const KEY_ALIASES: Record<string, string[]> = {
  punchHit: ['punchHit1', 'punchHit2'],
  footstep: ['footstep1', 'footstep2'],
  punchSwing: ['punchWhiff'],
  heavyHit: ['punchHeavy1', 'punchHeavy2'],
  // hurt / heavyHurt / playerDown：保留人聲合成，不映射到金屬擊聲檔
  enemyDown: ['bodyFall'],
  uiClick: ['uiClick'],
  buy: ['uiBuy'],
  upgrade: ['uiUpgrade'],
  heal: ['uiBuy'],
  questDone: ['uiUpgrade'],
};

export function playSound(key: string): void {
  const aliases = KEY_ALIASES[key];
  const resolved = aliases ? aliases[Math.floor(Math.random() * aliases.length)] : key;
  const url = manifest[resolved] ?? manifest[key];
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
