"use client";
import { Volume1, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DEFAULT_VOLUME, getVolume, setVolume } from "@/lib/audio";
import { useI18n } from "@/lib/i18n/client";

/** Master volume for everything the app plays. Remembered per device. */
export function VolumeControl({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  // Read storage after mount so server and client render the same markup.
  const [value, setValue] = useState(DEFAULT_VOLUME);
  const beforeMute = useRef(DEFAULT_VOLUME);
  useEffect(() => setValue(getVolume()), []);

  function change(v: number) {
    setValue(v);
    setVolume(v);
  }

  const Icon = value === 0 ? VolumeX : value < 0.5 ? Volume1 : Volume2;
  return (
    <div className={`inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] py-1 pl-1 pr-3 ${className}`}>
      <button
        type="button"
        title={t("volume.mute")}
        aria-label={t("volume.mute")}
        onClick={() => {
          if (value > 0) {
            beforeMute.current = value;
            change(0);
          } else change(beforeMute.current || DEFAULT_VOLUME);
        }}
        className="grid size-7 place-items-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
      >
        <Icon className="size-4" />
      </button>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(e) => change(Number(e.target.value) / 100)}
        aria-label={t("volume.label")}
        className="h-1 w-20 cursor-pointer accent-neon-400 sm:w-24"
      />
    </div>
  );
}
