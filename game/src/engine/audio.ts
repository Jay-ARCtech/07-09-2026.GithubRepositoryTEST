/**
 * Fully synthesised audio - no sample files anywhere in the bundle.
 *
 * Three reasons this is synthesis rather than assets:
 *  1. Size. The whole sound design costs zero kilobytes of download.
 *  2. Licensing. Nothing here can be a copyright claim on a store listing.
 *  3. Responsiveness. Sounds are built per-trigger, so pitch can track the
 *     combo counter and a 30x parry chain literally sounds higher than a 2x.
 *
 * Mobile browsers and both native webviews require a user gesture before audio
 * will start; `unlock()` is wired to the first pointer/key event.
 */

export type SfxName =
  | 'block'
  | 'parry'
  | 'perfect'
  | 'hurt'
  | 'overdrive'
  | 'wave'
  | 'ui'
  | 'uiBack'
  | 'gameover'
  | 'turret'
  | 'absorb'
  | 'stun'
  | 'unlock'
  | 'heal'
  | 'spawn';

interface AudioSettings {
  sfx: boolean;
  music: boolean;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private comp: DynamicsCompressorNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private unlocked = false;
  private failed = false;

  private musicTimer: number | null = null;
  private musicStep = 0;
  private musicIntensity = 0;

  settings: AudioSettings = { sfx: true, music: true };

  /** Safe to call repeatedly; only the first successful call does work. */
  unlock(): void {
    if (this.unlocked || this.failed) return;
    try {
      const Ctor: typeof AudioContext =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) {
        this.failed = true;
        return;
      }
      const ctx = new Ctor();
      this.ctx = ctx;

      // A gentle limiter keeps a 40x combo chain from clipping into distortion.
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -10;
      comp.knee.value = 12;
      comp.ratio.value = 6;
      comp.attack.value = 0.003;
      comp.release.value = 0.18;

      const master = ctx.createGain();
      master.gain.value = 0.85;

      const sfxBus = ctx.createGain();
      sfxBus.gain.value = this.settings.sfx ? 1 : 0;
      const musicBus = ctx.createGain();
      musicBus.gain.value = this.settings.music ? 0.34 : 0;

      sfxBus.connect(comp);
      musicBus.connect(comp);
      comp.connect(master);
      master.connect(ctx.destination);

      this.comp = comp;
      this.master = master;
      this.sfxBus = sfxBus;
      this.musicBus = musicBus;
      this.noiseBuffer = this.makeNoise(ctx);
      this.unlocked = true;

      void ctx.resume();
    } catch {
      // Audio is a nicety, never a hard dependency. If the platform refuses,
      // the game keeps running silently.
      this.failed = true;
    }
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  setSfx(on: boolean): void {
    this.settings.sfx = on;
    if (this.sfxBus && this.ctx) {
      this.sfxBus.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.02);
    }
  }

  setMusic(on: boolean): void {
    this.settings.music = on;
    if (this.musicBus && this.ctx) {
      this.musicBus.gain.setTargetAtTime(on ? 0.34 : 0, this.ctx.currentTime, 0.05);
    }
  }

  private makeNoise(ctx: AudioContext): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * 0.5);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    // Deterministic noise: a fixed LCG rather than Math.random, so the texture
    // is identical every session.
    let s = 0x2545f491;
    for (let i = 0; i < len; i++) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      data[i] = (s / 2147483648 - 1) * 0.6;
    }
    return buf;
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    opts: { sweepTo?: number; delay?: number; attack?: number } = {},
  ): void {
    const ctx = this.ctx;
    const bus = this.sfxBus;
    if (!ctx || !bus) return;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.sweepTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.sweepTo), t0 + dur);
    }
    const attack = opts.attack ?? 0.004;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(bus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private noise(
    dur: number,
    gain: number,
    filterHz: number,
    opts: { delay?: number; sweepTo?: number; q?: number } = {},
  ): void {
    const ctx = this.ctx;
    const bus = this.sfxBus;
    if (!ctx || !bus || !this.noiseBuffer) return;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.setValueAtTime(filterHz, t0);
    filt.Q.value = opts.q ?? 1.1;
    if (opts.sweepTo !== undefined) {
      filt.frequency.exponentialRampToValueAtTime(Math.max(40, opts.sweepTo), t0 + dur);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(bus);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  /**
   * @param name  which sound
   * @param pitch multiplier applied to the base frequency; the game feeds the
   *              combo count in here so chains rise in pitch.
   */
  play(name: SfxName, pitch = 1): void {
    if (!this.unlocked || !this.settings.sfx) return;
    const p = Math.min(Math.max(pitch, 0.5), 4);
    switch (name) {
      case 'block':
        this.noise(0.09, 0.22, 900 * p, { sweepTo: 320 * p });
        this.tone(180 * p, 0.07, 'square', 0.08, { sweepTo: 90 * p });
        break;
      case 'parry':
        this.tone(660 * p, 0.14, 'triangle', 0.18, { sweepTo: 1320 * p });
        this.noise(0.07, 0.14, 2600, { sweepTo: 5200 });
        break;
      case 'perfect':
        this.tone(880 * p, 0.2, 'triangle', 0.2, { sweepTo: 1760 * p });
        this.tone(1320 * p, 0.16, 'sine', 0.12, { delay: 0.03 });
        this.noise(0.05, 0.1, 4200, { sweepTo: 7000 });
        break;
      case 'hurt':
        this.tone(220, 0.3, 'sawtooth', 0.2, { sweepTo: 55 });
        this.noise(0.22, 0.2, 420, { sweepTo: 110 });
        break;
      case 'overdrive':
        this.tone(140, 0.55, 'sawtooth', 0.22, { sweepTo: 700 });
        this.tone(280, 0.5, 'square', 0.12, { sweepTo: 1400, delay: 0.02 });
        this.noise(0.45, 0.22, 600, { sweepTo: 6000 });
        break;
      case 'wave':
        this.tone(330, 0.16, 'sine', 0.14);
        this.tone(495, 0.2, 'sine', 0.12, { delay: 0.1 });
        this.tone(660, 0.26, 'sine', 0.12, { delay: 0.2 });
        break;
      case 'ui':
        this.tone(760, 0.05, 'square', 0.06, { sweepTo: 1140 });
        break;
      case 'uiBack':
        this.tone(560, 0.06, 'square', 0.06, { sweepTo: 320 });
        break;
      case 'gameover':
        this.tone(330, 0.5, 'triangle', 0.16, { sweepTo: 82 });
        this.tone(220, 0.7, 'sine', 0.12, { sweepTo: 55, delay: 0.12 });
        break;
      case 'turret':
        this.noise(0.28, 0.24, 1500, { sweepTo: 180 });
        this.tone(120, 0.24, 'square', 0.14, { sweepTo: 40 });
        break;
      case 'absorb':
        this.tone(330, 0.24, 'sine', 0.12, { sweepTo: 880 });
        break;
      case 'stun':
        this.tone(140, 0.3, 'square', 0.14, { sweepTo: 70 });
        this.noise(0.3, 0.12, 300, { q: 4 });
        break;
      case 'unlock':
        this.tone(523, 0.14, 'triangle', 0.16);
        this.tone(659, 0.14, 'triangle', 0.16, { delay: 0.1 });
        this.tone(784, 0.14, 'triangle', 0.16, { delay: 0.2 });
        this.tone(1047, 0.3, 'triangle', 0.18, { delay: 0.3 });
        break;
      case 'heal':
        this.tone(523, 0.18, 'sine', 0.14, { sweepTo: 1046 });
        break;
      case 'spawn':
        this.tone(1200 * p, 0.05, 'sine', 0.05, { sweepTo: 800 * p });
        break;
    }
  }

  // --- Adaptive music bed ---------------------------------------------------
  // A slow minor arpeggio over a drone. `intensity` (0..1) is driven by the
  // wave number, and it raises the octave and shortens the step time, so the
  // soundtrack tightens as the run gets harder without a single audio file.

  private static readonly SCALE = [0, 3, 5, 7, 10, 12, 15, 14];

  startMusic(): void {
    if (!this.unlocked || this.musicTimer !== null) return;
    this.musicStep = 0;
    const tick = (): void => {
      this.musicNote();
      const interval = 340 - this.musicIntensity * 120;
      this.musicTimer = window.setTimeout(tick, interval);
    };
    this.musicTimer = window.setTimeout(tick, 200);
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
  }

  setIntensity(v: number): void {
    this.musicIntensity = Math.min(Math.max(v, 0), 1);
  }

  private musicNote(): void {
    const ctx = this.ctx;
    const bus = this.musicBus;
    if (!ctx || !bus || !this.settings.music) return;
    const t0 = ctx.currentTime;
    const step = this.musicStep++;

    const semis = AudioEngine.SCALE[step % AudioEngine.SCALE.length]!;
    const octave = this.musicIntensity > 0.62 ? 2 : 1;
    const base = 110 * octave;
    const freq = base * Math.pow(2, semis / 12);

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 600 + this.musicIntensity * 2200;
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const dur = 0.34;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.09, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(filt);
    filt.connect(g);
    g.connect(bus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);

    // Drone on the downbeat.
    if (step % 8 === 0) {
      const d = ctx.createOscillator();
      const dg = ctx.createGain();
      d.type = 'sine';
      d.frequency.value = base / 2;
      dg.gain.setValueAtTime(0.0001, t0);
      dg.gain.exponentialRampToValueAtTime(0.12, t0 + 0.4);
      dg.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.6);
      d.connect(dg);
      dg.connect(bus);
      d.start(t0);
      d.stop(t0 + 2.7);
    }
  }

  dispose(): void {
    this.stopMusic();
    try {
      this.master?.disconnect();
      this.comp?.disconnect();
      void this.ctx?.close();
    } catch {
      /* context may already be closed */
    }
    this.ctx = null;
    this.unlocked = false;
  }
}
