// 程序合成 BGM：每場景一首獨立曲風（chiptune × Streets of Rage 致敬）。
// 全 WebAudio 原創、零檔案、License 乾淨，與 audio.ts 的 synth fallback 同源。
//
// 設計：
//  - bass + lead + arp + drum，每小節推進 16 步
//  - 每場景指定調性、和弦進行、節拍、音色
//  - LocalStorage 記住開關與音量；fadeIn/Out 避免突兀切換

export type BgmKey =
  | 'title' | 'lv1_neon' | 'lv2_nightmarket' | 'lv3_temple'
  | 'lv4_skybridge' | 'lv5_rooftop' | 'shop' | 'result_win' | 'result_fail'
  | 'ending';

interface Track {
  bpm: number;
  /** A 小調為主（情緒契合「夜城清版」） */
  rootMidi: number;
  /** 和弦進行（每元素 = 一個小節 root midi 偏移，相對 rootMidi） */
  chords: number[];
  /** 主旋律音階偏移（半音） */
  scale: number[];
  /** 主奏波形 */
  leadWave: OscillatorType;
  bassWave: OscillatorType;
  /** 鼓組：1=kick, 2=snare, 3=hat（每步 0 表示靜音） */
  drumPattern: number[];
  /** 主旋律機率（每步觸發機率，配合種子） */
  leadDensity: number;
  /** arp（琶音） */
  arp: boolean;
  /** 整體音量乘數 0-1 */
  vol: number;
}

const MINOR = [0, 2, 3, 5, 7, 8, 10, 12, 14]; // 自然小調 + 上行延伸
const PENTA_BLUES = [0, 3, 5, 6, 7, 10, 12, 15]; // 小調藍調
const ORIENTAL = [0, 2, 3, 7, 8, 10, 12, 14];     // 中華調（4 度 5 度跳進）

const TRACKS: Record<BgmKey, Track> = {
  title: {
    bpm: 96, rootMidi: 45, chords: [0, -2, -5, -7], scale: MINOR,
    leadWave: 'sawtooth', bassWave: 'square',
    drumPattern: [1,0,3,0, 2,0,3,0, 1,0,3,0, 2,0,3,1],
    leadDensity: 0.5, arp: true, vol: 0.7,
  },
  lv1_neon: {
    bpm: 124, rootMidi: 45, chords: [0, -2, -5, 3], scale: MINOR,
    leadWave: 'sawtooth', bassWave: 'square',
    drumPattern: [1,0,3,0, 2,0,3,0, 1,0,3,0, 2,3,3,1],
    leadDensity: 0.65, arp: true, vol: 0.7,
  },
  lv2_nightmarket: {
    bpm: 110, rootMidi: 43, chords: [0, 5, 3, -2], scale: PENTA_BLUES,
    leadWave: 'triangle', bassWave: 'sine',
    drumPattern: [1,0,3,2, 1,3,3,2, 1,0,3,2, 1,3,2,1],
    leadDensity: 0.55, arp: false, vol: 0.62,
  },
  lv3_temple: {
    bpm: 88, rootMidi: 41, chords: [0, 7, 5, -5], scale: ORIENTAL,
    leadWave: 'triangle', bassWave: 'sine',
    drumPattern: [1,0,0,2, 0,0,2,0, 1,0,0,2, 0,2,0,2],
    leadDensity: 0.42, arp: false, vol: 0.6,
  },
  lv4_skybridge: {
    bpm: 132, rootMidi: 47, chords: [0, -3, -5, 2], scale: MINOR,
    leadWave: 'sawtooth', bassWave: 'square',
    drumPattern: [1,3,2,3, 1,3,2,3, 1,3,2,3, 1,2,3,1],
    leadDensity: 0.7, arp: true, vol: 0.72,
  },
  lv5_rooftop: {
    bpm: 144, rootMidi: 48, chords: [0, -5, 3, -2], scale: MINOR,
    leadWave: 'sawtooth', bassWave: 'sawtooth',
    drumPattern: [1,3,2,3, 1,3,2,3, 1,3,1,3, 2,3,2,1],
    leadDensity: 0.78, arp: true, vol: 0.8,
  },
  shop: {
    bpm: 84, rootMidi: 46, chords: [0, 5, -2, 3], scale: MINOR,
    leadWave: 'triangle', bassWave: 'sine',
    drumPattern: [0,0,0,0, 2,0,0,0, 0,0,0,0, 2,0,0,0],
    leadDensity: 0.4, arp: false, vol: 0.55,
  },
  result_win: {
    bpm: 120, rootMidi: 50, chords: [0, 5, 7, 12], scale: MINOR,
    leadWave: 'triangle', bassWave: 'square',
    drumPattern: [1,0,2,0, 1,0,2,0, 1,3,2,3, 1,0,2,1],
    leadDensity: 0.7, arp: true, vol: 0.7,
  },
  result_fail: {
    bpm: 70, rootMidi: 38, chords: [0, -2, -5, -7], scale: MINOR,
    leadWave: 'sine', bassWave: 'sine',
    drumPattern: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
    leadDensity: 0.25, arp: false, vol: 0.5,
  },
  // 結局：壯麗凱旋；大調根（M3+4 度上揚），雙倍 lead，鼓密集
  ending: {
    bpm: 128, rootMidi: 52, chords: [0, 5, 7, 12, 0, -5, -2, 5], scale: [0, 2, 4, 5, 7, 9, 11, 12, 14],
    leadWave: 'sawtooth', bassWave: 'square',
    drumPattern: [1,3,2,3, 1,3,2,3, 1,3,2,3, 1,2,3,1],
    leadDensity: 0.85, arp: true, vol: 0.85,
  },
};

const STORAGE_KEY = 'tsb-bgm-prefs';
interface Prefs { on: boolean; vol: number; }
function loadPrefs(): Prefs {
  try { return Object.assign({ on: true, vol: 0.55 }, JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')); }
  catch { return { on: true, vol: 0.55 }; }
}
function savePrefs(p: Prefs): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch { /* noop */ }
}

class Bgm {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer = 0;
  private prefs = loadPrefs();
  private current: BgmKey | null = null;
  private stepIdx = 0;
  private barIdx = 0;
  private rand: () => number = mulberry32(7);

  get isOn(): boolean { return this.prefs.on; }
  get volume(): number { return this.prefs.vol; }

  toggle(): void {
    this.prefs.on = !this.prefs.on;
    savePrefs(this.prefs);
    if (this.prefs.on && this.current) {
      const k = this.current; this.current = null; this.play(k);
    } else {
      this.stop();
    }
  }

  setVolume(v: number): void {
    this.prefs.vol = Math.max(0, Math.min(1, v));
    savePrefs(this.prefs);
    if (this.master && this.ctx) this.master.gain.setValueAtTime(this.prefs.vol, this.ctx.currentTime);
  }

  play(key: BgmKey): void {
    if (this.current === key) return;
    this.stop();
    this.current = key;
    if (!this.prefs.on) return;
    this.ensureCtx();
    if (!this.ctx || !this.master) return;
    this.master.gain.setValueAtTime(0, this.ctx.currentTime);
    this.master.gain.linearRampToValueAtTime(this.prefs.vol, this.ctx.currentTime + 0.4);
    this.stepIdx = 0; this.barIdx = 0;
    this.rand = mulberry32(key.length * 991 + 17);
    this.loop();
  }

  stop(): void {
    if (this.timer) { clearTimeout(this.timer); this.timer = 0; }
    if (this.master && this.ctx) {
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(this.master.gain.value, now);
      this.master.gain.linearRampToValueAtTime(0, now + 0.3);
    }
  }

  private ensureCtx(): void {
    if (this.ctx) return;
    try {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.ctx.destination);
    } catch { this.ctx = null; }
  }

  private loop(): void {
    if (!this.current || !this.prefs.on || !this.ctx || !this.master) return;
    const t = TRACKS[this.current];
    const stepDur = 60 / t.bpm / 4; // 16 步 = 1 小節 = 4 拍
    const now = this.ctx.currentTime;
    const chord = t.chords[this.barIdx % t.chords.length];
    const rootHz = midi2hz(t.rootMidi + chord);

    // 鼓
    const drum = t.drumPattern[this.stepIdx];
    if (drum === 1) this.kick(now);
    else if (drum === 2) this.snare(now);
    if (drum === 3 || this.stepIdx % 2 === 1) this.hat(now, drum === 3 ? 0.04 : 0.018);

    // 貝斯：每拍（4 步）一次
    if (this.stepIdx % 4 === 0) this.bass(now, rootHz / 2, stepDur * 3.5, t.bassWave);

    // 琶音
    if (t.arp) {
      const a = t.scale[this.stepIdx % t.scale.length];
      this.lead(now, midi2hz(t.rootMidi + chord + a + 12), stepDur * 0.9, t.leadWave, 0.035);
    }

    // 主旋律
    if (this.rand() < t.leadDensity) {
      const note = t.scale[Math.floor(this.rand() * t.scale.length)];
      const oct = this.rand() > 0.7 ? 24 : 12;
      this.lead(now, midi2hz(t.rootMidi + chord + note + oct), stepDur * 1.6, t.leadWave, 0.05 * t.vol);
    }

    this.stepIdx = (this.stepIdx + 1) % 16;
    if (this.stepIdx === 0) this.barIdx += 1;

    this.timer = window.setTimeout(() => this.loop(), stepDur * 1000);
  }

  // ── 音色 ──
  private kick(at: number): void {
    if (!this.ctx || !this.master) return;
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(120, at);
    o.frequency.exponentialRampToValueAtTime(40, at + 0.18);
    g.gain.setValueAtTime(0.32, at); g.gain.exponentialRampToValueAtTime(0.001, at + 0.2);
    o.connect(g).connect(this.master); o.start(at); o.stop(at + 0.22);
  }

  private snare(at: number): void {
    if (!this.ctx || !this.master) return;
    const b = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.15, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() - 0.5) * Math.exp(-i / (d.length * 0.18));
    const src = this.ctx.createBufferSource(); src.buffer = b;
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1800;
    const g = this.ctx.createGain(); g.gain.value = 0.22;
    src.connect(f).connect(g).connect(this.master); src.start(at);
  }

  private hat(at: number, gain: number): void {
    if (!this.ctx || !this.master) return;
    const b = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.05, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() - 0.5) * Math.exp(-i / (d.length * 0.1));
    const src = this.ctx.createBufferSource(); src.buffer = b;
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6500;
    const g = this.ctx.createGain(); g.gain.value = gain;
    src.connect(f).connect(g).connect(this.master); src.start(at);
  }

  private bass(at: number, hz: number, dur: number, wave: OscillatorType): void {
    if (!this.ctx || !this.master) return;
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = wave; o.frequency.value = hz;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.18, at + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, at + dur);
    o.connect(g).connect(this.master); o.start(at); o.stop(at + dur + 0.02);
  }

  private lead(at: number, hz: number, dur: number, wave: OscillatorType, gain: number): void {
    if (!this.ctx || !this.master) return;
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 3200;
    o.type = wave; o.frequency.value = hz;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(gain, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, at + dur);
    o.connect(g).connect(f).connect(this.master); o.start(at); o.stop(at + dur + 0.02);
  }
}

function midi2hz(m: number): number { return 440 * Math.pow(2, (m - 69) / 12); }

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const bgm = new Bgm();
