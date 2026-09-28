"use client";
import { AnimatePresence, motion } from "framer-motion";
import { AudioWaveform, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useRoomState } from "@/hooks/useRoom";
import { useI18n } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";
import type { RoomState } from "@/lib/types";
import { Avatar } from "./ui/Avatar";
import { Visualizer } from "./Visualizer";

const phaseLabel: Record<RoomState["phase"], MessageKey> = {
  lobby: "overlay.lobby",
  recording: "host.recordingClip",
  guessing: "overlay.guessing",
  reveal: "overlay.reveal",
  closed: "overlay.closed",
};

export function Overlay({ initial, token }: { initial: RoomState; token: string | null }) {
  const { state } = useRoomState(initial.code, initial, { token });
  const room = state ?? initial;
  const { t, fmt } = useI18n();
  const [host, setHost] = useState("");
  useEffect(() => setHost(window.location.host), []);

  return (
    <main className="obs-overlay flex min-h-dvh items-end p-10">
      <div className="glass flex w-[560px] flex-col gap-4 rounded-3xl bg-ink-950/70 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-display text-lg font-bold">
            <AudioWaveform className="size-5 -scale-x-100 text-neon-400" /> Reverse Voice Challenge
          </div>
          <div className="flex items-center gap-1.5 font-mono text-lg font-bold tabular-nums">
            <Users className="size-5 text-neon-400" /> {fmt(room.playerCount)}
          </div>
        </div>

        <div className="flex items-end justify-between rounded-2xl bg-white/5 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/50">{t("host.joinAt")}</p>
            <p className="font-display text-2xl font-bold">{host}/play</p>
          </div>
          <p className="neon-text font-mono text-5xl font-black tracking-[0.15em]">{room.code}</p>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={`${room.phase}-${room.round}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-4"
          >
            {room.picked && <Avatar player={room.picked} size="md" />}
            <p className="text-xl font-semibold">
              {room.picked && <span className="text-neon-300">{room.picked.name} </span>}
              <span className="text-white/80">{t(phaseLabel[room.phase])}</span>
            </p>
          </motion.div>
        </AnimatePresence>

        <Visualizer analyser={null} bars={40} className="h-10" />
      </div>
    </main>
  );
}
