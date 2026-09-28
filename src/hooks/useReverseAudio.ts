"use client";
import { useMemo } from "react";
import { reverseBuffer } from "@/lib/audio";

/** Memoized reversal: `reversed` updates whenever `source` changes. */
export function useReverseAudio(source: AudioBuffer | null) {
  const reversed = useMemo(() => (source ? reverseBuffer(source) : null), [source]);
  return { reversed, reverse: reverseBuffer };
}
