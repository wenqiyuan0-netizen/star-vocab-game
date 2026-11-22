// Procedural UI / game sound effects (Web Audio API, no asset files).
// All sounds go through a master gain + compressor so volume/mute is global
// and stacked effects never clip.

const PREF_KEY = 'star_vocab_sfx';

const loadPrefs = () => {
  try {
    const p = JSON.parse(localStorage.getItem(PREF_KEY) || 'null');
    if (p && typeof p.volume === 'number') return { muted: !!p.muted, volume: Math.min(1, Math.max(0, p.volume)) };
  } catch { }
  return { muted: false, volume: 0.6 };
};

export class SoundManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.unlocked = false;
    const prefs = loadPrefs();
    this.muted = prefs.muted;
    this.volume = prefs.volume;
    this._lastTap = 0;
  }

  _savePrefs() {
    try { localStorage.setItem(PREF_KEY, JSON.stringify({ muted: this.muted, volume: this.volume })); } catch { }
    try { window.dispatchEvent(new Event('sfx-changed')); } catch { }
  }

  setMuted(muted) {
    this.muted = !!muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
    this._savePrefs();
  }

  setVolume(v) {
    this.volume = Math.min(1, Math.max(0, Number(v) || 0));
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
    this._savePrefs();
  }

  unlock() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    if (!this.ctx) {
      this.ctx = new AudioContextClass();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 6;
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => { });
    }

    if (this.unlocked) return;
    try {
      const buffer = this.ctx.createBuffer(1, 1, 22050);
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.ctx.destination);
      source.start(0);
      this.unlocked = true;
    } catch (e) { }
  }

  _ready() {
    if (this.muted) return false;
    if (!this.ctx) this.unlock();
    return !!this.ctx;
  }

  // Tone with a short attack (avoids clicks) and exponential decay.
  // `slideTo` glides the pitch for a more "physical" feel.
  playTone(freq, type, startTime, duration, vol = 0.1, slideTo = null) {
    if (!this.ctx || !this.master) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, startTime + duration);
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(vol, startTime + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(startTime);
      osc.stop(startTime + duration + 0.02);
    } catch (e) { }
  }

  // Short filtered noise burst: the "body" of taps, flips and impacts.
  playNoise(startTime, duration, vol = 0.1, freq = 2000, q = 1) {
    if (!this.ctx || !this.master) return;
    try {
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
      const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = freq;
      filter.Q.value = q;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol, startTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      src.connect(filter); filter.connect(gain); gain.connect(this.master);
      src.start(startTime);
    } catch (e) { }
  }

  // ---- UI sounds ----

  playTap() {
    const t = performance.now();
    if (t - this._lastTap < 40) return; // de-dupe nested buttons
    this._lastTap = t;
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    this.playNoise(now, 0.025, 0.12, 3200, 2.5);
    this.playTone(1400, 'sine', now, 0.04, 0.05, 900);
  }

  playToggle(on = true) {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    this.playTone(on ? 660 : 880, 'triangle', now, 0.06, 0.08);
    this.playTone(on ? 990 : 590, 'triangle', now + 0.05, 0.08, 0.07);
  }

  playFlip() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    this.playNoise(now, 0.12, 0.08, 1200, 0.7);
    this.playTone(320, 'sine', now, 0.1, 0.04, 520);
  }

  playKey() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    this.playNoise(now, 0.018, 0.06, 4500 + Math.random() * 1500, 3);
  }

  // ---- Game sounds (names kept for existing callers) ----

  playMatch() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    this.playTone(784, 'triangle', now, 0.09, 0.16);          // G5
    this.playTone(1175, 'triangle', now + 0.05, 0.11, 0.14);  // D6
    this.playTone(1568, 'sine', now + 0.1, 0.22, 0.12);       // G6 shimmer
    this.playNoise(now, 0.05, 0.05, 6000, 1);
  }

  playError() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    this.playTone(220, 'triangle', now, 0.12, 0.2, 160);
    this.playTone(208, 'square', now + 0.06, 0.12, 0.05, 150);
  }

  playSelect() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    this.playTone(1046, 'sine', now, 0.05, 0.1);
  }

  playClick() {
    this.playTap();
  }

  playBump() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    this.playTone(140, 'sine', now, 0.12, 0.22, 70);
    this.playNoise(now, 0.04, 0.08, 600, 1);
  }

  playComboImpact() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    this.playTone(120, 'sine', now, 0.18, 0.28, 55);
    this.playNoise(now, 0.08, 0.12, 900, 0.8);
    this.playTone(1318, 'triangle', now + 0.03, 0.14, 0.1);
    this.playTone(1760, 'sine', now + 0.07, 0.2, 0.08);
  }

  playMiss() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    this.playTone(440, 'triangle', now, 0.22, 0.16, 220);
  }

  playVictory() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    [523, 659, 784, 1046].forEach((f, i) => {
      this.playTone(f, 'triangle', now + i * 0.09, 0.28, 0.16);
      this.playTone(f * 2, 'sine', now + i * 0.09, 0.2, 0.04);
    });
  }

  playGameOver() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    this.playTone(392, 'triangle', now, 0.3, 0.18);
    this.playTone(311, 'triangle', now + 0.18, 0.3, 0.16);
    this.playTone(233, 'triangle', now + 0.36, 0.6, 0.16, 180);
  }
}

export const soundManager = new SoundManager();

// Haptic tick on supporting mobile devices; silently ignored elsewhere.
export const hapticTick = (ms = 8) => {
  try { if (!soundManager.muted && navigator.vibrate) navigator.vibrate(ms); } catch { }
};
