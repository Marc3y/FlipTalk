"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getAudioContext } from "@/lib/audio";

/**
 * Plays AudioBuffers through an analyser (for visualizers). Only one sound plays at a time;
 * `play` resolves when the sound ends or is stopped, so calls can be chained.
 */
export function useAudioPlayback() {
  const [playing, setPlaying] = useState<string | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const current = useRef<{ source: AudioBufferSourceNode; done: () => void } | null>(null);
  /** Bumped by every public play/stop; a running sequence bails once it no longer matches. */
  const generation = useRef(0);

  const halt = useCallback(() => {
    const c = current.current;
    current.current = null;
    if (!c) return;
    c.source.onended = null;
    try {
      c.source.stop();
    } catch {}
    c.done();
  }, []);

  const start = useCallback(
    (buffer: AudioBuffer, key: string) => {
      halt();
      const ctx = getAudioContext();
      const node = ctx.createAnalyser();
      node.fftSize = 256;
      node.connect(ctx.destination);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(node);
      setAnalyser(node);
      setPlaying(key);
      return new Promise<void>((resolve) => {
        current.current = { source, done: resolve };
        source.onended = () => {
          if (current.current?.source === source) {
            current.current = null;
            setPlaying(null);
          }
          resolve();
        };
        source.start();
      });
    },
    [halt],
  );

  const stop = useCallback(() => {
    generation.current++;
    halt();
    setPlaying(null);
  }, [halt]);

  const play = useCallback(
    (buffer: AudioBuffer, key = "clip") => {
      generation.current++;
      return start(buffer, key);
    },
    [start],
  );

  /** Plays buffers back to back; a later `stop()` or `play()` cancels the rest. */
  const playSequence = useCallback(
    async (items: Array<[AudioBuffer, string]>, gapMs = 600) => {
      const id = ++generation.current;
      for (const [i, [buffer, key]] of items.entries()) {
        if (i > 0) await new Promise((r) => setTimeout(r, gapMs));
        if (generation.current !== id) return;
        await start(buffer, key);
      }
    },
    [start],
  );

  useEffect(() => stop, [stop]);

  return { play, playSequence, stop, playing, analyser };
}
