/**
 * Tiny Web Audio synth used by the simulator to give aural feedback to
 * pheromone deposition, food pickups, and nest returns.
 *
 * Design constraints:
 *   • no external samples — everything is a short oscillator + envelope
 *   • muted by default (Chrome/Safari autoplay policy will block otherwise)
 *   • cheap to call — the deposit ping is throttled internally
 *   • lazy — AudioContext is only created on first unmute
 */

type Voice = "ping" | "chime" | "boom";

class Synth {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private lastPingAt = 0;
  private muted = true;

  private ensure(): AudioContext | null {
    if (this.muted) return null;
    if (this.ctx) return this.ctx;
    try {
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      return this.ctx;
    } catch {
      return null;
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted && this.master) this.master.gain.value = 0;
    else if (this.master) this.master.gain.value = 0.35;
    if (!muted) this.ensure();
    // On unmute, poke the context — some browsers suspend until user gesture.
    if (!muted && this.ctx?.state === "suspended") {
      void this.ctx.resume();
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  play(voice: Voice): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const now = ctx.currentTime;
    if (voice === "ping") {
      // Rate-limit the deposit tick — one hit per 90 ms max.
      if (performance.now() - this.lastPingAt < 90) return;
      this.lastPingAt = performance.now();
      this.beep(ctx, now, { freq: 1400, dur: 0.045, gain: 0.05, type: "square" });
    } else if (voice === "chime") {
      // Food found — bright ascending triad.
      this.beep(ctx, now, { freq: 660, dur: 0.14, gain: 0.16, type: "sine" });
      this.beep(ctx, now + 0.06, { freq: 990, dur: 0.16, gain: 0.14, type: "sine" });
    } else {
      // Nest return — warm low tone.
      this.beep(ctx, now, { freq: 220, dur: 0.22, gain: 0.18, type: "triangle" });
    }
  }

  private beep(
    ctx: AudioContext,
    at: number,
    opts: { freq: number; dur: number; gain: number; type: OscillatorType },
  ): void {
    if (!this.master) return;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = opts.type;
    osc.frequency.setValueAtTime(opts.freq, at);
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(opts.gain, at + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, at + opts.dur);
    osc.connect(env);
    env.connect(this.master);
    osc.start(at);
    osc.stop(at + opts.dur + 0.02);
  }
}

/** Global synth singleton — the app has at most one AudioContext. */
export const synth = new Synth();
