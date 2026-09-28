"use client";
import { motion } from "framer-motion";
import { Loader2, Mic, Square } from "lucide-react";
import type { RecorderStatus } from "@/hooks/useAudioRecorder";
import { useI18n } from "@/lib/i18n/client";

/** Big round mic button with a countdown ring that fills up to the clip cap. */
export function RecordButton({
  status,
  elapsed,
  maxSeconds,
  onStart,
  onStop,
  size = 176,
  disabled,
}: {
  status: RecorderStatus;
  elapsed: number;
  maxSeconds: number;
  onStart: () => void;
  onStop: () => void;
  size?: number;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const recording = status === "recording";
  const busy = status === "requesting" || status === "processing";
  const r = size / 2 - 8;
  const circumference = 2 * Math.PI * r;
  const progress = recording ? elapsed / maxSeconds : 0;

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      {recording && (
        <motion.span
          className="absolute inset-0 rounded-full bg-rose-500/25"
          animate={{ scale: [1, 1.18, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 1.4, repeat: Infinity }}
        />
      )}
      <svg width={size} height={size} className="absolute -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgb(255 255 255 / 0.08)" strokeWidth={6} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={recording ? "#fb7185" : "#a855f7"}
          strokeWidth={6}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          style={{ transition: "stroke-dashoffset 60ms linear" }}
        />
      </svg>
      <motion.button
        type="button"
        whileTap={{ scale: 0.92 }}
        disabled={disabled || busy}
        onClick={recording ? onStop : onStart}
        aria-label={recording ? t("rec.stop") : t("rec.start")}
        className={`relative grid place-items-center rounded-full text-white transition-colors disabled:opacity-50 ${
          recording
            ? "bg-gradient-to-b from-rose-500 to-rose-600 shadow-[0_0_60px_-5px_rgb(244_63_94/0.8)]"
            : "bg-gradient-to-b from-neon-500 to-neon-600 shadow-[0_0_60px_-5px_rgb(168_85_247/0.8)]"
        }`}
        style={{ width: size - 36, height: size - 36 }}
      >
        {busy ? (
          <Loader2 className="size-10 animate-spin" />
        ) : recording ? (
          <div className="flex flex-col items-center">
            <Square className="size-9 fill-current" />
            <span className="mt-1 font-mono text-sm tabular-nums">{(maxSeconds - elapsed).toFixed(1)}s</span>
          </div>
        ) : (
          <Mic className="size-12" />
        )}
      </motion.button>
    </div>
  );
}
