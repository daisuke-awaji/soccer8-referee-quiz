/** 効果音（Web Audio で合成）と振動。設定で切れるように、毎回 enabled() を確かめる */
type Ctx = AudioContext;

export function createSound(enabled: () => boolean) {
  let ctx: Ctx | null = null;
  const ok = () => enabled() && ctx;
  function tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.06, at = 0) {
    const c = ctx!;
    const t = c.currentTime + at;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  return {
    /** ブラウザの制約で、最初のタップのときに音を出せる状態にする */
    unlock() {
      if (!enabled()) return;
      try {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!ctx && AC) ctx = new AC();
        if (ctx?.state === 'suspended') void ctx.resume();
      } catch {
        ctx = null;
      }
    },
    whistle() {
      if (!ok()) return;
      const c = ctx!;
      const t = c.currentTime;
      const o = c.createOscillator();
      const lfo = c.createOscillator();
      const lg = c.createGain();
      const g = c.createGain();
      o.frequency.setValueAtTime(2900, t);
      lfo.frequency.value = 30;
      lg.gain.value = 140;
      lfo.connect(lg);
      lg.connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.09, t + 0.02);
      g.gain.setValueAtTime(0.09, t + 0.3);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
      o.connect(g);
      g.connect(c.destination);
      o.start(t);
      lfo.start(t);
      o.stop(t + 0.45);
      lfo.stop(t + 0.45);
    },
    tick() {
      if (ok()) tone(1100, 0.07, 'sine', 0.04);
    },
    good() {
      if (!ok()) return;
      tone(660, 0.12, 'triangle', 0.07);
      tone(990, 0.2, 'triangle', 0.07, 0.1);
    },
    bad() {
      if (ok()) tone(200, 0.22, 'square', 0.03);
    },
  };
}
export type Sound = ReturnType<typeof createSound>;

export function createHaptics(enabled: () => boolean) {
  return (pattern: number | number[]) => {
    if (!enabled() || !navigator.vibrate) return;
    try {
      navigator.vibrate(pattern);
    } catch {
      /* 対応していない端末 */
    }
  };
}
