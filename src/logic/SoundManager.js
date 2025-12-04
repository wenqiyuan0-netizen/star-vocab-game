// src/logic/SoundManager.js

export class SoundManager {
  constructor() {
    this.ctx = null;
    this.unlocked = false;
  }

  unlock() {
    if (this.unlocked) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      if (!this.ctx) this.ctx = new AudioContextClass();
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const buffer = this.ctx.createBuffer(1, 1, 22050);
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.ctx.destination);
      source.start(0);
      this.unlocked = true;
    }
  }

  playTone(freq, type, startTime, duration, vol = 0.1) {
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);
      // 增加快速衰减，让音效更短促有力（punchy）
      gain.gain.setValueAtTime(vol, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    } catch (e) {
      console.error(e);
    }
  }

  playMatch() {
    if (!this.ctx) this.unlock();
    const now = this.ctx.currentTime;
    // 成功的音效使用更快速、音高更高的三连音，更有“点燃”感
    this.playTone(600,  'square', now,       0.08, 0.25);
    this.playTone(900,  'triangle', now + 0.05, 0.10, 0.22);
    this.playTone(1200, 'sine',     now + 0.10, 0.15, 0.20); // 加上一个高频尾音
  }

  playError() {
    if (!this.ctx) this.unlock();
    const now = this.ctx.currentTime;
    // 错误的音效使用方波/锯齿波，音调更低、更刺耳，反馈更即时
    this.playTone(180, 'sawtooth', now,     0.1,   0.35);
    this.playTone(100, 'sawtooth', now + 0.05, 0.1,   0.30);
  }

  playSelect() {
    if (!this.ctx) this.unlock();
    const now = this.ctx.currentTime;
    // 选中的音效更清脆，持续时间极短
    this.playTone(880, 'square', now, 0.04, 0.18);
  }

  playClick() {
    if (!this.ctx) this.unlock();
    const now = this.ctx.currentTime;
    // UI 点击使用快速的降调，模拟“确认”感
    this.playTone(700, 'sine', now, 0.05, 0.15);
    this.playTone(500, 'sine', now + 0.04, 0.05, 0.12);
  }

  playBump() {
    if (!this.ctx) this.unlock();
    const now = this.ctx.currentTime;
    // 碰撞使用方波和极低的频率，模拟“厚重”的撞击感
    this.playTone(150, 'square', now, 0.08, 0.20);
  }

  playComboImpact() {
    if (!this.ctx) this.unlock();
    const now = this.ctx.currentTime;
    // 连击冲击音效，快速的频率和波形变化
    this.playTone(400, 'sawtooth',   now,      0.05, 0.20);
    this.playTone(800, 'triangle',   now + 0.04, 0.08, 0.28);
    this.playTone(1200, 'sine',     now + 0.08, 0.10, 0.25);
  }

  playMiss() {
    if (!this.ctx) this.unlock();
    const now = this.ctx.currentTime;
    // Miss 音效使用快速降频，更具“滑落”感
    this.playTone(400, 'triangle', now, 0.10, 0.3);
    this.playTone(200, 'triangle', now + 0.05, 0.1, 0.25);
  }

  playVictory() {
    if (!this.ctx) this.unlock();
    const now = this.ctx.currentTime;

    // 胜利音效使用柔和的正弦波，但节奏更快，更具兴奋感
    this.playTone(523, 'sine', now,     0.15, 0.25); // C5
    this.playTone(659, 'sine', now + 0.10, 0.15, 0.25); // E5
    this.playTone(784, 'sine', now + 0.20, 0.20, 0.28); // G5
  }

  playGameOver() {
    if (!this.ctx) this.unlock();
    const now = this.ctx.currentTime;

    // 失败音效使用低沉的方波和快速的降调，模拟“断电”或“失败”
    this.playTone(250, 'square', now,     0.30, 0.35);
    this.playTone(100, 'square', now + 0.15, 0.40, 0.30);
    this.playTone(50, 'square', now + 0.30, 0.50, 0.25);
  }
}
export const soundManager = new SoundManager();