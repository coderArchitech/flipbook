const preferenceKey = "flipbook-sound";

/** A short paper rustle, synthesized locally. No audio file or network request. */
export class FlipSound {
  constructor() {
    this.enabled = true;
    this.sources = new Set();
    try {
      this.enabled = localStorage.getItem(preferenceKey) !== "off";
    } catch {}
  }
  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    try {
      localStorage.setItem(preferenceKey, this.enabled ? "on" : "off");
    } catch {}
    if (!this.enabled) this.stop();
  }
  async play() {
    if (!this.enabled || this.destroyed) return;
    try {
      // Called only by a page turn following user interaction, never on load.
      const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Audio) return;
      this.context ||= new Audio({ latencyHint: "interactive" });
      const context = this.context;
      if (context.state === "suspended") await context.resume();
      if (!this.enabled || this.destroyed || context.state !== "running")
        return;
      if (!this.buffer) {
        this.buffer = context.createBuffer(
          1,
          Math.ceil(context.sampleRate * 0.22),
          context.sampleRate,
        );
        const samples = this.buffer.getChannelData(0);
        for (let i = 0; i < samples.length; i++)
          samples[i] = Math.random() * 2 - 1;
      }
      this.stop(); // Rapid turns should never accumulate loud overlapping sounds.
      const source = context.createBufferSource(),
        filter = context.createBiquadFilter(),
        gain = context.createGain();
      source.buffer = this.buffer;
      filter.type = "bandpass";
      filter.frequency.value = 1250;
      filter.Q.value = 0.7;
      const now = context.currentTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.11, now + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.21);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(context.destination);
      this.sources.add(source);
      source.onended = () => {
        this.sources.delete(source);
        source.disconnect();
        filter.disconnect();
        gain.disconnect();
      };
      source.start(now);
      source.stop(now + 0.22);
    } catch {
      /* Unavailable or blocked audio must not block reading. */
    }
  }
  stop() {
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {}
    }
    this.sources.clear();
  }
  destroy() {
    this.destroyed = true;
    this.stop();
    this.context?.close().catch(() => {});
  }
}
