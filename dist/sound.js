(() => {
  "use strict";

  const chimes = {
    select: [[620, 0, 0.09, 0.09]],
    build: [[196, 0, 0.17, 0.32], [392, 0.045, 0.30, 0.15]],
    upgrade: [[392, 0, 0.30, 0.19], [494, 0.08, 0.32, 0.15], [587, 0.16, 0.46, 0.17]],
    wave: [[147, 0, 0.46, 0.30], [220, 0.14, 0.58, 0.23]],
    leak: [[185, 0, 0.14, 0.24], [139, 0.07, 0.24, 0.22]],
    end: [[294, 0, 0.54, 0.18], [220, 0.21, 0.66, 0.16], [147, 0.44, 0.86, 0.20]]
  };

  class GameSound {
    constructor() {
      this.context = null;
      this.master = null;
      this.ember = null;
      this.enabled = false;
      this.lastHit = -Infinity;
    }

    enable(enabled) {
      this.enabled = Boolean(enabled);
      if (!this.enabled) {
        if (this.master) this.master.gain.setTargetAtTime(0, this.context.currentTime, 0.008);
        return;
      }

      try {
        if (!this.context) {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          if (!AudioContext) return;
          this.context = new AudioContext();
          this.master = this.context.createGain();
          this.master.gain.value = 0;
          this.master.connect(this.context.destination);
          this.ember = this.context.createBuffer(1, Math.ceil(this.context.sampleRate * 0.10), this.context.sampleRate);
          const samples = this.ember.getChannelData(0);
          let previous = 0;
          for (let i = 0; i < samples.length; i++) {
            previous = previous * 0.72 + (Math.random() * 2 - 1) * 0.28;
            samples[i] = previous;
          }
        }
        this.master.gain.setTargetAtTime(0.32, this.context.currentTime, 0.012);
        if (this.context.state !== "running") this.context.resume().catch(() => {});
      } catch {
        this.enabled = false;
      }
    }

    play(name) {
      if (!this.enabled || !this.context || this.context.state !== "running") return;
      const now = this.context.currentTime;
      if (name === "hit") {
        if (now - this.lastHit < 0.12) return;
        this.lastHit = now;
        const ember = this.context.createBufferSource();
        ember.buffer = this.ember;
        ember.playbackRate.value = 0.92 + Math.random() * 0.22;
        this.sound(ember, now, 0.08, 0.22);
        return;
      }
      const notes = chimes[name];
      if (!Array.isArray(notes)) return;
      for (const [pitch, delay, duration, volume] of notes) {
        const bell = this.context.createOscillator();
        bell.type = name === "wave" || name === "leak" ? "triangle" : "sine";
        bell.frequency.setValueAtTime(pitch * 1.006, now + delay);
        bell.frequency.exponentialRampToValueAtTime(pitch, now + delay + 0.045);
        this.sound(bell, now + delay, duration, volume);
      }
    }

    sound(source, start, duration, volume) {
      const envelope = this.context.createGain();
      envelope.gain.setValueAtTime(0.0001, start);
      envelope.gain.exponentialRampToValueAtTime(volume, start + 0.008);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      source.connect(envelope);
      envelope.connect(this.master);
      source.onended = () => {
        source.disconnect();
        envelope.disconnect();
      };
      source.start(start);
      source.stop(start + duration + 0.01);
    }
  }

  window.GameSound = GameSound;
})();
