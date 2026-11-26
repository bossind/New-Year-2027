/* ===== Original Web Audio API Synth & Music Engine Bridge ===== */
import { MUSIC } from './music';

export type SfxType = 'boom' | 'pop' | 'tick' | 'open';

class SoundEngine {
  private ac: AudioContext | null = null;
  private out: GainNode | null = null;
  private nb: AudioBuffer | null = null;
  private lastBoom: number = 0;
  public isOn: boolean = false;
  private listeners: Set<(on: boolean) => void> = new Set();

  public subscribe(fn: (on: boolean) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    this.listeners.forEach((fn) => fn(this.isOn));
  }

  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ac) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ac = new AudioCtx();
      this.out = this.ac.createGain();
      this.out.gain.value = 0.7;
      this.out.connect(this.ac.destination);
    }
    if (this.ac.state === 'suspended') {
      this.ac.resume().catch(() => {});
    }
    return this.ac;
  }

  public set(v: boolean) {
    this.isOn = v;
    if (v && this.ensure()) {
      MUSIC.playSong();
    } else {
      MUSIC.stop();
    }
    this.notify();
  }

  public toggle() {
    this.set(!this.isOn);
  }

  private noise(): AudioBuffer | null {
    if (!this.ac) return null;
    if (this.nb) return this.nb;
    const ac = this.ac;
    const b = ac.createBuffer(1, Math.floor(ac.sampleRate * 1.5), ac.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      d[i] = Math.random() * 2 - 1;
    }
    this.nb = b;
    return b;
  }

  private env(node: AudioNode, t: number, a: number, peak: number, dec: number): GainNode | null {
    if (!this.ac || !this.out) return null;
    const g = this.ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0008, t + a + dec);
    node.connect(g);
    g.connect(this.out);
    return g;
  }

  public boom() {
    if (!this.isOn || !this.ac) return;
    const ac = this.ac;
    const t = ac.currentTime;
    if (t - this.lastBoom < 0.14) return;
    this.lastBoom = t;

    const nb = this.noise();
    if (nb) {
      const n = ac.createBufferSource();
      n.buffer = nb;
      const f = ac.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(1400, t);
      f.frequency.exponentialRampToValueAtTime(160, t + 0.9);
      n.connect(f);
      this.env(f, t, 0.006, 0.28, 1.1);
      n.start(t);
      n.stop(t + 1.3);
    }

    const o = ac.createOscillator();
    o.frequency.setValueAtTime(95, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.4);
    this.env(o, t, 0.004, 0.3, 0.45);
    o.start(t);
    o.stop(t + 0.5);
  }

  public pop() {
    if (!this.isOn || !this.ac) return;
    const ac = this.ac;
    const t = ac.currentTime;
    const nb = this.noise();
    if (nb) {
      const n = ac.createBufferSource();
      n.buffer = nb;
      const f = ac.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 2400;
      n.connect(f);
      this.env(f, t, 0.002, 0.45, 0.18);
      n.start(t);
      n.stop(t + 0.25);
    }

    [880, 1320, 1760].forEach((fr, i) => {
      const o = ac.createOscillator();
      o.type = 'sine';
      o.frequency.value = fr;
      this.env(o, t + 0.05 + i * 0.07, 0.005, 0.12, 0.6);
      o.start(t + 0.05 + i * 0.07);
      o.stop(t + 1);
    });
  }

  public open() {
    this.pop();
  }

  public tick() {
    if (!this.isOn || !this.ac) return;
    const ac = this.ac;
    const t = ac.currentTime;
    const o = ac.createOscillator();
    o.frequency.value = 1250;
    this.env(o, t, 0.002, 0.18, 0.08);
    o.start(t);
    o.stop(t + 0.12);
  }

  public play(k: SfxType) {
    if (k === 'boom') this.boom();
    else if (k === 'pop' || k === 'open') this.pop();
    else if (k === 'tick') this.tick();
  }
}

export const SND = new SoundEngine();
