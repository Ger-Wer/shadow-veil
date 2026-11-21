// Shadow Veil — sound: every sound is synthesized with WebAudio,
// no audio files. A tiny synth: noise bursts for footsteps, short
// oscillator blips for events, a quiet drone underneath.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.droneNodes = null;
    this.lastStepAt = 0;
    // Some headless browsers ship a partial WebAudio: AudioParam may
    // only offer setValueAtTime (no ramps, no setTargetAtTime).
    // Detect once; every sound below degrades to plain value sets.
    this.canRamp = false;
  }

  // Must be called from a user gesture at least once.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.canRamp = typeof this.ctx.createGain().gain.linearRampToValueAtTime === 'function';
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      this.startDrone();
    } catch {
      this.ctx = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      try {
        this.master.gain.setValueAtTime(muted ? 0 : 0.5, this.ctx.currentTime);
      } catch {
        this.master.gain.value = muted ? 0 : 0.5;
      }
    }
  }

  startDrone() {
    // A very quiet two-oscillator hum: the building at night.
    const oscA = this.ctx.createOscillator();
    const oscB = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    oscA.type = 'sine';
    oscA.frequency.value = 55;
    oscB.type = 'sine';
    oscB.frequency.value = 55.7;
    gain.gain.value = 0.035;
    lfo.type = 'sine';
    lfo.frequency.value = 0.08;
    lfoGain.gain.value = 0.015;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    oscA.connect(gain);
    oscB.connect(gain);
    gain.connect(this.master);
    oscA.start();
    oscB.start();
    lfo.start();
    this.droneNodes = { oscA, oscB, lfo };
  }

  // Short filtered noise burst: a footstep. `loud` 0..1.
  step(loud) {
    if (!this.ctx || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      if (now - this.lastStepAt < 0.09) return;
      this.lastStepAt = now;
      const dur = 0.07;
      const buffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * dur), this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.22 * loud;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start(now);
    } catch {
      // Silence is better than a frozen game.
    }
  }

  // A short tone. `type` is an oscillator type, `slideTo` bends the pitch.
  // Never throws: a sound that fails must not take the game down.
  blip(freq, dur, type = 'sine', volume = 0.25, slideTo = null, delay = 0) {
    if (!this.ctx || this.muted) return;
    try {
      const now = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (slideTo !== null) {
        if (this.canRamp && typeof osc.frequency.exponentialRampToValueAtTime === 'function') {
          osc.frequency.exponentialRampToValueAtTime(slideTo, now + dur);
        } else {
          // Step the pitch in four jumps when ramps are missing.
          for (let i = 1; i <= 4; i += 1) {
            osc.frequency.setValueAtTime(freq + ((slideTo - freq) * i) / 4, now + (dur * i) / 4);
          }
        }
      }
      if (this.canRamp) {
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(volume, now + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      } else {
        gain.gain.setValueAtTime(0, now);
        gain.gain.setValueAtTime(volume, now + 0.012);
        gain.gain.setValueAtTime(0.001, now + dur);
      }
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + dur + 0.05);
    } catch {
      // Silence is better than a frozen game.
    }
  }

  suspicious() {
    this.blip(196, 0.16, 'triangle', 0.2, 165);
  }

  alert() {
    this.blip(620, 0.14, 'square', 0.14, 520);
    this.blip(466, 0.2, 'square', 0.14, 392, 0.13);
  }

  pickup() {
    this.blip(660, 0.12, 'sine', 0.28);
    this.blip(990, 0.18, 'sine', 0.24, null, 0.09);
  }

  unlock() {
    [523, 659, 784].forEach((f, i) => this.blip(f, 0.16, 'sine', 0.22, null, i * 0.09));
  }

  busted() {
    this.blip(220, 0.35, 'sawtooth', 0.2, 110);
    this.blip(110, 0.5, 'sawtooth', 0.18, 55, 0.12);
  }

  win() {
    [523, 659, 784, 1047].forEach((f, i) => this.blip(f, 0.22, 'sine', 0.24, null, i * 0.11));
  }

  lose() {
    [392, 330, 262, 196].forEach((f, i) => this.blip(f, 0.26, 'triangle', 0.2, null, i * 0.13));
  }
}
