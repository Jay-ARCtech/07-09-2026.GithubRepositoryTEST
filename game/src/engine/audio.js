// Fully procedural WebAudio engine: every sound and music layer is
// synthesized at runtime. No external audio assets means zero licensing
// risk and zero binary payload to ship.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.musicNodes = [];
    this.musicTimer = null;
    this.intensity = 0; // 0..1, driven by boss/low-hp state
    this.settings = { masterVolume: 0.8, musicVolume: 0.6, sfxVolume: 0.9 };
    this.unlocked = false;
  }

  ensureContext() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.musicGain.connect(this.master);
    this.sfxGain.connect(this.master);
    this.master.connect(this.ctx.destination);
    this.applySettings(this.settings);
  }

  // Browsers block audio until a user gesture; call this from the first
  // click/keydown on the title screen.
  unlock() {
    this.ensureContext();
    if (this.ctx.state === "suspended") this.ctx.resume();
    this.unlocked = true;
  }

  applySettings(settings) {
    this.settings = settings;
    if (!this.ctx) return;
    this.master.gain.value = settings.masterVolume;
    this.musicGain.gain.value = settings.musicVolume;
    this.sfxGain.gain.value = settings.sfxVolume;
  }

  tone({ freq = 440, dur = 0.12, type = "sine", gain = 0.2, slideTo = null, delay = 0 }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(gain, t0 + 0.01);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(env);
    env.connect(this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noiseBurst({ dur = 0.15, gain = 0.25, filterFreq = 1200, delay = 0 }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const bufferSize = this.ctx.sampleRate * dur;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = filterFreq;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(gain, t0);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(env);
    env.connect(this.sfxGain);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  // --- Named SFX -----------------------------------------------------
  sfxShoot(kind = "blaster") {
    const map = {
      blaster: { freq: 720, slideTo: 260, dur: 0.07, type: "square", gain: 0.12 },
      orbiter: { freq: 300, dur: 0.05, type: "triangle", gain: 0.08 },
      missile: { freq: 220, slideTo: 500, dur: 0.12, type: "sawtooth", gain: 0.1 },
      lightning: { freq: 900, slideTo: 1400, dur: 0.06, type: "square", gain: 0.1 },
    };
    this.tone(map[kind] || map.blaster);
  }
  sfxHit() {
    this.noiseBurst({ dur: 0.08, gain: 0.18, filterFreq: 2200 });
  }
  sfxEnemyDeath() {
    this.tone({ freq: 180, slideTo: 40, dur: 0.18, type: "sawtooth", gain: 0.14 });
  }
  sfxExplosion() {
    this.noiseBurst({ dur: 0.3, gain: 0.3, filterFreq: 800 });
    this.tone({ freq: 90, slideTo: 30, dur: 0.3, type: "sine", gain: 0.2 });
  }
  sfxLevelUp() {
    [523, 659, 784, 1046].forEach((f, i) =>
      this.tone({ freq: f, dur: 0.16, type: "triangle", gain: 0.16, delay: i * 0.07 })
    );
  }
  sfxPickup() {
    this.tone({ freq: 880, slideTo: 1320, dur: 0.06, type: "sine", gain: 0.08 });
  }
  sfxHurt() {
    this.tone({ freq: 140, slideTo: 60, dur: 0.15, type: "sawtooth", gain: 0.18 });
  }
  sfxChest() {
    this.tone({ freq: 400, dur: 0.1, type: "square", gain: 0.12 });
    this.tone({ freq: 600, dur: 0.15, type: "square", gain: 0.12, delay: 0.1 });
  }
  sfxBossRoar() {
    this.noiseBurst({ dur: 0.6, gain: 0.25, filterFreq: 400 });
    this.tone({ freq: 60, dur: 0.6, type: "sawtooth", gain: 0.22 });
  }
  sfxUiClick() {
    this.tone({ freq: 500, dur: 0.04, type: "square", gain: 0.06 });
  }

  // --- Procedural music ------------------------------------------------
  // A slow evolving pad (root + fifth) plus a rhythmic pulse whose density
  // scales with `intensity`. Everything is generated -- no music files.
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const scale = [220, 261.6, 293.7, 329.6, 392, 440]; // A minor-ish pentatonic-adjacent
    let step = 0;
    const playStep = () => {
      const beat = 60 / 96; // 96bpm base
      const t = this.ctx.currentTime;
      const bassFreq = scale[0] / 2;
      this.tone({ freq: bassFreq, dur: beat * 1.9, type: "sine", gain: 0.05 * (0.6 + this.intensity), delay: 0 });
      if (step % 2 === 0) {
        const note = scale[Math.floor(step / 2) % scale.length];
        this.tone({ freq: note, dur: beat * 0.8, type: "triangle", gain: 0.035 + this.intensity * 0.03 });
      }
      if (this.intensity > 0.4 && step % 4 === 1) {
        this.noiseBurst({ dur: 0.05, gain: 0.05 * this.intensity, filterFreq: 3000 });
      }
      step++;
      this.musicTimer = setTimeout(playStep, beat * 1000);
    };
    playStep();
  }
  stopMusic() {
    if (this.musicTimer) clearTimeout(this.musicTimer);
    this.musicTimer = null;
  }
  setIntensity(v) {
    this.intensity = Math.max(0, Math.min(1, v));
  }
}

export const audio = new AudioEngine();
