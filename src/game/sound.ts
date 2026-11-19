// Lightweight Web Audio API synthesizer for game feedback (zero external assets)

class SoundFX {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;

  constructor() {
    try {
      this.muted = localStorage.getItem('singularity_muted') === 'true';
    } catch {
      this.muted = false;
    }
  }

  private getContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    try {
      localStorage.setItem('singularity_muted', String(muted));
    } catch {
      // Ignore storage errors
    }
  }

  private tone(freq: number, endFreq: number, duration: number, type: OscillatorType = 'sine', gainVal = 0.08) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    }
    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  launch() {
    this.tone(180, 480, 0.18, 'triangle', 0.1);
  }

  phaseShift(toWave: boolean) {
    if (toWave) {
      this.tone(320, 740, 0.15, 'sine', 0.08);
    } else {
      this.tone(620, 260, 0.15, 'triangle', 0.08);
    }
  }

  stardust() {
    this.tone(880, 1180, 0.07, 'sine', 0.045);
  }

  fragment() {
    this.tone(523.25, 783.99, 0.14, 'sine', 0.09);
    setTimeout(() => this.tone(1046.5, 1318.5, 0.18, 'sine', 0.08), 65);
  }

  bounce() {
    this.tone(140, 65, 0.1, 'triangle', 0.09);
  }

  portal() {
    this.tone(240, 960, 0.22, 'sine', 0.08);
  }

  lockedGoal() {
    this.tone(190, 120, 0.16, 'sawtooth', 0.06);
  }

  win() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      setTimeout(() => this.tone(n, n, 0.22, 'sine', 0.08), idx * 75);
    });
  }

  loss() {
    this.tone(260, 85, 0.35, 'sawtooth', 0.08);
  }
}

export const soundFX = new SoundFX();
