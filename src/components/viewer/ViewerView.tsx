"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Ban, Bell, BellRing, DoorOpen, Headphones, Mic, PartyPopper, Radio, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { LastResult } from "@/components/LastResult";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { UserBadge } from "@/components/UserBadge";
import { useMe, useRoomState } from "@/hooks/useRoom";
import { api, ApiError } from "@/lib/api-client";
import { getAudioContext, isAudioUnlocked } from "@/lib/audio";
import { useI18n } from "@/lib/i18n/client";
import { playChime } from "@/lib/sounds";
import type { MeState, RoomState } from "@/lib/types";
import { RecordPanel } from "./RecordPanel";

export function ViewerView({ initial, initialMe, token }: { initial: RoomState; initialMe: MeState; token: string | null }) {
  const code = initial.code;
  const { state, apply } = useRoomState(code, initial, { token });
  const room = state ?? initial;
  const { t, fmt } = useI18n();
  const { me, setMe, refresh: refreshMe } = useMe(code, initialMe);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Browsers only allow sound after a tap on the page. Joining counts; after a reload we ask again.
  const [soundOn, setSoundOn] = useState(false);
  useEffect(() => setSoundOn(isAudioUnlocked()), []);

  function enableSound() {
    getAudioContext();
    playChime("test");
    setSoundOn(true);
  }

  const isPicked = !!me.user && room.picked?.id === me.user.id;
  // Being picked removes you from the pool server-side, so don't show "in queue" during your turn.
  const inQueue = me.joined && !isPicked;

  // Only the one viewer whose turn just ended refetches (joined/banned changed); everyone else derives state locally.
  const wasPicked = useRef(isPicked);
  useEffect(() => {
    if (isPicked && !wasPicked.current && room.phase === "recording") {
      playChime("picked");
      navigator.vibrate?.([200, 100, 200, 100, 400]);
    }
    if (!isPicked && wasPicked.current) void refreshMe();
    wasPicked.current = isPicked;
  }, [isPicked, refreshMe, room.phase]);

  // Flash the tab title while it's your turn, in case the stream is in another tab.
  const yourTurn = isPicked && room.phase === "recording";
  const flashText = t("viewer.titleFlash");
  useEffect(() => {
    if (!yourTurn) return;
    const original = document.title;
    let on = false;
    const id = setInterval(() => (document.title = (on = !on) ? flashText : original), 900);
    return () => {
      clearInterval(id);
      document.title = original;
    };
  }, [yourTurn, flashText]);

  async function join() {
    getAudioContext();
    setSoundOn(true);
    setBusy(true);
    setError(null);
    try {
      await api(`/api/rooms/${code}/join`, { method: "POST" });
      setMe((m) => ({ ...m, joined: true }));
    } catch (e) {
      if (e instanceof ApiError && e.code === "err.banned") setMe((m) => ({ ...m, banned: true }));
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    setBusy(true);
    try {
      await api(`/api/rooms/${code}/leave`, { method: "POST" });
      setMe((m) => ({ ...m, joined: false }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-bg min-h-dvh pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-6 pt-4">
        <header className="flex items-center justify-between gap-2">
          <Logo />
          {me.user && <UserBadge user={me.user} />}
        </header>

        <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/40">{t("viewer.room")}</p>
            <p className="font-mono text-xl font-bold tracking-[0.2em]">{code}</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-white/60">
            <Radio className="size-4 text-rose-400" />
            <span className="truncate">{room.host.name}</span>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-sm tabular-nums text-white/70">
            <Users className="size-4 text-neon-400" /> {fmt(room.playerCount)}
          </div>
        </div>

        <section className="glass mt-4 flex flex-1 flex-col justify-center rounded-3xl p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={viewKey(room, isPicked, inQueue, me)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
            >
              {room.phase === "closed" ? (
                <Status icon={<DoorOpen className="size-10 text-white/50" />} title={t("viewer.closedTitle")} body={t("viewer.closedBody")}>
                  <Link href="/play" className="mt-4 inline-block font-semibold text-neon-300">
                    {t("viewer.joinAnother")}
                  </Link>
                </Status>
              ) : me.banned ? (
                <Status icon={<Ban className="size-10 text-rose-400" />} title={t("viewer.bannedTitle")} body={t("viewer.bannedBody")} />
              ) : isPicked && room.phase === "recording" ? (
                <>
                  <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0.6 }} className="text-center">
                    <p className="inline-flex items-center gap-2 rounded-full bg-neon-500/20 px-3 py-1 text-xs font-bold uppercase tracking-widest text-neon-300">
                      <Sparkles className="size-3.5" /> {t("viewer.picked")}
                    </p>
                    <h2 className="mt-3 font-display text-3xl font-bold">{t("viewer.recordTitle")}</h2>
                    <p className="mt-1 text-sm text-white/50">{t("viewer.recordBody")}</p>
                  </motion.div>
                  <div className="mt-6">
                    <RecordPanel code={code} onSent={apply} />
                  </div>
                </>
              ) : isPicked ? (
                <Status
                  icon={<PartyPopper className="size-10 text-neon-400" />}
                  title={t("viewer.onStreamTitle")}
                  body={room.phase === "reveal" ? t("viewer.onStreamReveal") : t("phase.guessing", { host: room.host.name })}
                />
              ) : room.phase === "lobby" ? (
                inQueue ? (
                  <Status
                    icon={<QueuePulse />}
                    title={t("viewer.inLobbyTitle")}
                    body={t("viewer.inLobbyBody")}
                  >
                    <SoundToggle on={soundOn} onEnable={enableSound} />
                    <Button variant="ghost" size="sm" className="mt-3" onClick={leave} loading={busy}>
                      {t("viewer.leave")}
                    </Button>
                  </Status>
                ) : (
                  <Status icon={<Mic className="size-10 text-neon-400" />} title={t("viewer.readyTitle")} body={t("viewer.readyBody")}>
                    <Button size="lg" className="mt-6 w-full" onClick={join} loading={busy}>
                      {t("viewer.join")}
                    </Button>
                  </Status>
                )
              ) : (
                room.picked && (
                  <div className="text-center">
                    <Avatar player={room.picked} size="lg" className="mx-auto" />
                    <h2 className="mt-4 font-display text-2xl font-bold">{room.picked.name}</h2>
                    <p className="mt-1 text-white/60">
                      {room.phase === "recording"
                        ? t("host.recordingClip")
                        : room.phase === "guessing"
                          ? t("phase.guessing", { host: room.host.name })
                          : t("phase.reveal")}
                    </p>
                    {inQueue ? (
                      <p className="mt-5 text-xs text-white/40">{t("viewer.stillInLobby")}</p>
                    ) : (
                      <Button size="md" className="mt-6" onClick={join} loading={busy}>
                        {t("viewer.joinNext")}
                      </Button>
                    )}
                  </div>
                )
              )}
            </motion.div>
          </AnimatePresence>
          {error && <p className="mt-4 text-center text-sm text-rose-400">{error}</p>}
        </section>

        <div className="mt-4">
          <LastResult result={room.lastResult} />
        </div>

        <footer className="mt-4 flex flex-col items-center gap-3">
          <p className="flex items-center justify-center gap-1.5 text-center text-xs text-white/30">
            <Headphones className="size-3.5" /> {t("viewer.audioHint")}
          </p>
          <LanguageSwitch />
        </footer>
      </div>
    </main>
  );
}

function SoundToggle({ on, onEnable }: { on: boolean; onEnable: () => void }) {
  const { t } = useI18n();
  if (on) {
    return (
      <p className="mt-5 flex items-center gap-1.5 text-xs text-emerald-300/80">
        <BellRing className="size-3.5" /> {t("viewer.soundOn")}
      </p>
    );
  }
  return (
    <Button variant="primary" size="md" className="mt-5 animate-pulse" onClick={onEnable}>
      <Bell className="size-4" /> {t("viewer.soundEnable")}
    </Button>
  );
}

function viewKey(room: RoomState, isPicked: boolean, inQueue: boolean, me: MeState) {
  return [room.phase, isPicked, inQueue, me.banned, room.round].join(":");
}

function Status({ icon, title, body, children }: { icon: React.ReactNode; title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center">
      {icon}
      <h2 className="mt-4 font-display text-2xl font-bold">{title}</h2>
      <p className="mt-2 text-sm text-white/60">{body}</p>
      {children}
    </div>
  );
}

function QueuePulse() {
  return (
    <div className="relative grid size-20 place-items-center">
      {[0, 1].map((i) => (
        <motion.span
          key={i}
          className="absolute inset-0 rounded-full border-2 border-neon-400"
          animate={{ scale: [0.6, 1.4], opacity: [0.8, 0] }}
          transition={{ duration: 2, repeat: Infinity, delay: i, ease: "easeOut" }}
        />
      ))}
      <span className="grid size-12 place-items-center rounded-full bg-neon-500 neon-glow">
        <Users className="size-6" />
      </span>
    </div>
  );
}
