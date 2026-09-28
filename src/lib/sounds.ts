"use client";
import { getAudioContext, getOutput } from "./audio";

const CHIMES = {
  /** Picked viewer: bright rising arpeggio, played twice so it cuts through a stream in another tab. */
  picked: { notes: [659.25, 880, 1318.5], repeat: 2, gain: 0.35 },
  /** Host: a clip just arrived. */
  clip: { notes: [880, 1174.66], repeat: 1, gain: 0.25 },
  /** Confirms sound works when a viewer turns alerts on. */
  test: { notes: [880], repeat: 1, gain: 0.2 },
};

/** Synthesized with oscillators, so there's no audio file to load or cache. */
export function playChime(kind: keyof typeof CHIMES) {
  const { notes, repeat, gain } = CHIMES[kind];
  const ctx = getAudioContext();
  const start = ctx.currentTime + 0.03;
  for (let r = 0; r < repeat; r++) {
    notes.forEach((freq, i) => {
      const t = start + r * 0.75 + i * 0.12;
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(gain, t + 0.02);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      osc.connect(env).connect(getOutput());
      osc.start(t);
      osc.stop(t + 0.55);
    });
  }
}
