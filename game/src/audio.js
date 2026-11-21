// Audio: fully synthesised WebAudio — engine hum, gunshots, sirens, a tiny
// procedural radio loop, UI clicks. No audio files, no network. Everything
// is guarded: in shot mode (or when AudioContext is unavailable) every call
// is a silent no-op, so headless screenshots never crash on sound.
export function createAudio() {
  const audio = {
    ctx: null,
    enabled: false,
    engineOsc: null,
    engineGain: null,
    radioTimer: 0,
    init() {
      if (this.ctx) return;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.enabled = true;
        // Engine: a low sawtooth whose pitch follows speed (set by update).
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.value = 55;
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 420;
        this.engineOsc.connect(filter);
        filter.connect(this.engineGain);
        this.engineGain.connect(this.ctx.destination);
        this.engineOsc.start();
      } catch {
        this.enabled = false;
      }
    },
    // Short noise burst through a bandpass = a gunshot.
    gunshot() {
      if (!this.enabled) return;
      try {
        const t = this.ctx.currentTime;
        const len = 0.14;
        const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * len, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        const src = this.ctx.createBufferSource();
        src.buffer = buffer;
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 1400;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.5, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + len);
        src.connect(bp); bp.connect(gain); gain.connect(this.ctx.destination);
        src.start(t);
      } catch { /* sound is decoration; never break the game */ }
    },
    enemyShot() {
      if (!this.enabled) return;
      try {
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(220, t);
        osc.frequency.exponentialRampToValueAtTime(60, t + 0.09);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        osc.connect(gain); gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.11);
      } catch { /* ignore */ }
    },
    // Two-tone police siren, one cycle.
    siren() {
      if (!this.enabled) return;
      try {
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(660, t);
        osc.frequency.linearRampToValueAtTime(880, t + 0.4);
        osc.frequency.linearRampToValueAtTime(660, t + 0.8);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.05, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.85);
        osc.connect(gain); gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.85);
      } catch { /* ignore */ }
    },
    click() {
      if (!this.enabled) return;
      try {
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = 880;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.08, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
        osc.connect(gain); gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.08);
      } catch { /* ignore */ }
    },
    // Per-frame: engine pitch from speed, radio blips, siren while wanted.
    update(dt, game) {
      if (!this.enabled) return;
      try {
        const p = game.player;
        const speed = p.mode === 'car' && p.car ? Math.abs(p.car.speed) : Math.abs(p.speed);
        const target = p.mode === 'car' ? 0.035 + speed * 0.0022 : 0;
        this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
        this.engineOsc.frequency.setTargetAtTime(55 + speed * 3.2, this.ctx.currentTime, 0.08);
        // A little procedural radio: a soft chord blip every few seconds.
        this.radioTimer -= dt;
        if (this.radioTimer <= 0) {
          this.radioTimer = 2.4;
          const t = this.ctx.currentTime;
          for (const [i, freq] of [220, 277, 330].entries()) {
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.02, t + i * 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
            osc.connect(gain); gain.connect(this.ctx.destination);
            osc.start(t + i * 0.02);
            osc.stop(t + 0.95);
          }
        }
        if (game.police.stars >= 1 && Math.floor(game.time * 2) !== Math.floor((game.time - dt) * 2)) {
          this.siren();
        }
      } catch { /* ignore */ }
    },
  };
  return audio;
}
