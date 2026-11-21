// The Velvet Hour — sound: every effect is synthesised with WebAudio,
// so the game ships no audio files and makes no network request.
// Footsteps tell you where a guard is; the alert sting, the pickup chime
// and the win/lose jingles are all short oscillator phrases.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.master = null;
  }

  /** Create the context on the first user gesture; safe to call any time. */
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  /** One short tone: frequency slide, gain envelope, optional pan. */
  tone(freq, duration, type, volume, slideTo, when, pan) {
    if (!this.ctx || this.muted) return;
    try {
      const t0 = this.ctx.currentTime + (when || 0);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + duration);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(volume || 0.2, t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
      let node = osc;
      if (pan !== undefined && this.ctx.createStereoPanner) {
        const panner = this.ctx.createStereoPanner();
        panner.pan.value = Math.max(-1, Math.min(1, pan));
        osc.connect(panner);
        node = panner;
      }
      node.connect(gain);
      gain.connect(this.master);
      osc.start(t0);
      osc.stop(t0 + duration + 0.05);
    } catch {
      // Sound is garnish: a failure here must never stop the game.
    }
  }

  /** A soft thud, panned by where the step came from relative to the player. */
  footstep(stance, pan) {
    const volume = stance === 'run' ? 0.22 : stance === 'sneak' ? 0.05 : 0.12;
    this.tone(stance === 'run' ? 120 : 95, 0.09, 'triangle', volume, 55, 0, pan);
  }

  /** A guard's step: lower, so you can tell it apart from your own. */
  guardStep(pan, distance) {
    const volume = Math.max(0.02, 0.16 * (1 - distance / 420));
    this.tone(78, 0.11, 'triangle', volume, 48, 0, pan);
  }

  /** Two-note rising sting when a guard spots you for good. */
  alertSting() {
    this.tone(392, 0.16, 'square', 0.12, null, 0);
    this.tone(587, 0.28, 'square', 0.14, null, 0.14);
  }

  /** A short questioning blip when a guard grows suspicious. */
  suspiciousBlip() {
    this.tone(330, 0.12, 'sine', 0.12, 415, 0);
  }

  /** Bright chime for loot, higher still for the relic. */
  pickup(isRelic) {
    if (isRelic) {
      this.tone(523, 0.14, 'sine', 0.18, null, 0);
      this.tone(659, 0.14, 'sine', 0.18, null, 0.09);
      this.tone(784, 0.26, 'sine', 0.2, null, 0.18);
    } else {
      this.tone(880, 0.1, 'sine', 0.14, null, 0);
      this.tone(1175, 0.16, 'sine', 0.14, null, 0.07);
    }
  }

  /** A soft descending phrase when the run ends badly. */
  caughtJingle() {
    this.tone(392, 0.2, 'triangle', 0.16, null, 0);
    this.tone(311, 0.2, 'triangle', 0.16, null, 0.18);
    this.tone(233, 0.42, 'triangle', 0.18, null, 0.36);
  }

  /** A rising major phrase when the gallery is cleared. */
  winJingle() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => this.tone(freq, 0.22, 'sine', 0.16, null, i * 0.11));
  }

  click() {
    this.tone(660, 0.06, 'sine', 0.1, null, 0);
  }
}
