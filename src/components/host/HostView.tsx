"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Ban, Bot, Check, Copy, Eye, EyeOff, Lock, LockOpen, Minus, Plus, Power, Shuffle, SkipForward, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { VolumeControl } from "@/components/VolumeControl";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { Visualizer } from "@/components/Visualizer";
import { useAudioPlayback } from "@/hooks/useAudioPlayback";
import { useRoomState } from "@/hooks/useRoom";
import { api } from "@/lib/api-client";
import { DEFAULT_MAX_PLAYERS, MAX_PLAYERS_LIMIT } from "@/lib/constants";
import { decodeAudio, getAudioContext } from "@/lib/audio";
import { useI18n } from "@/lib/i18n/client";
import { playChime } from "@/lib/sounds";
import type { RoomState, Verdict } from "@/lib/types";
import { LastResult } from "../LastResult";
import { SecondsSince } from "../SecondsSince";
import { GuidedRound } from "./GuidedRound";

type HostAction = "pick" | "skip" | "ban" | "reveal" | "close" | "finish" | "lock" | "unlock" | "setMax";

export function HostView({ initial, token, devTools }: { initial: RoomState; token: string | null; devTools: boolean }) {
  const code = initial.code;
  const { state, apply } = useRoomState(code, initial, { token, pollMs: 5000 });
  const room = state ?? initial;
  const { t, fmt } = useI18n();

  const playback = useAudioPlayback();
  const [original, setOriginal] = useState<AudioBuffer | null>(null);
  /** Round hidden locally by Panic before the server has even answered. */
  const [droppedRound, setDroppedRound] = useState<number | null>(null);

  const [busy, setBusy] = useState<HostAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clipFailed, setClipFailed] = useState(false);

  const { stop: stopAudio } = playback;

  // Fetch the viewer's clip when it arrives, with a short ding so the streamer notices.
  useEffect(() => {
    stopAudio();
    setOriginal(null);
    setClipFailed(false);
    if (!room.clipId) return;
    let cancelled = false;
    fetch(`/api/rooms/${code}/clip/${room.clipId}`)
      .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject()))
      .then(decodeAudio)
      .then((buffer) => {
        if (cancelled) return;
        setOriginal(buffer);
        playChime("clip");
      })
      .catch(() => !cancelled && setClipFailed(true));
    return () => {
      cancelled = true;
    };
  }, [code, room.clipId, stopAudio]);

  const act = useCallback(
    async (action: HostAction, extra?: { verdict: Verdict } | { maxPlayers: number }) => {
      getAudioContext(); // unlock audio on this click, so later sounds play without a gesture
      setBusy(action);
      setError(null);
      try {
        apply(await api<RoomState>(`/api/rooms/${code}/host`, { method: "POST", json: { action, ...extra } }));
        return true;
      } catch (e) {
        setError((e as Error).message);
        return false;
      } finally {
        setBusy(null);
      }
    },
    [apply, code],
  );

  async function panic() {
    // Silence first, network second: the stream must go quiet instantly.
    stopAudio();
    setOriginal(null);
    setDroppedRound(room.round); // unmounts the round, which also stops the mic
    if (!(await act("ban"))) setDroppedRound(null);
  }

  const showRound = (room.phase === "guessing" || room.phase === "reveal") && room.picked && droppedRound !== room.round;
  const inRound = room.phase === "recording" || room.phase === "guessing" || room.phase === "reveal";

  if (room.phase === "closed") {
    return (
      <main className="app-bg grid min-h-dvh place-items-center px-4">
        <div className="glass rounded-3xl p-10 text-center">
          <h1 className="font-display text-3xl font-bold">{t("host.closedTitle")}</h1>
          <p className="mt-2 text-white/60">{t("host.closedBody")}</p>
          <Link href="/host" className="mt-6 inline-block font-semibold text-neon-300 hover:underline">
            {t("host.newRoom")}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="app-bg min-h-dvh">
      <div className="mx-auto flex min-h-dvh max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <Logo />
          <div className="flex flex-wrap items-center gap-2">
            <VolumeControl />
            <LanguageSwitch />
            <Button
              variant={room.locked ? "primary" : "ghost"}
              size="sm"
              onClick={() => act(room.locked ? "unlock" : "lock")}
              loading={busy === "lock" || busy === "unlock"}
            >
              {room.locked ? <LockOpen className="size-4" /> : <Lock className="size-4" />}
              {room.locked ? t("host.unlockLobby") : t("host.lockLobby")}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => confirm(t("host.endConfirm")) && act("close")} loading={busy === "close"}>
              <Power className="size-4" /> {t("host.endRoom")}
            </Button>
          </div>
        </header>

        <RoomBanner
          code={code}
          members={room.memberCount}
          maxPlayers={room.maxPlayers ?? DEFAULT_MAX_PLAYERS}
          locked={!!room.locked}
          onSetMax={(maxPlayers) => act("setMax", { maxPlayers })}
        />

        <div className="grid flex-1 gap-5 lg:grid-cols-[1fr_320px]">
          <section className="glass relative flex min-h-[480px] flex-col overflow-hidden rounded-3xl p-6 sm:p-10">
            {!showRound && <Visualizer analyser={null} bars={64} className="h-28 sm:h-36" />}

            <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
              <AnimatePresence mode="wait">
                {room.phase === "lobby" && (
                  <Stage key="lobby">
                    <p className="text-sm font-semibold uppercase tracking-[0.3em] text-white/40">{t("host.round", { n: room.round + 1 })}</p>
                    <h2 className="mt-3 font-display text-4xl font-bold sm:text-5xl">
                      {room.playerCount > 0 ? (
                        <>
                          <span className="neon-text tabular-nums">{fmt(room.playerCount)}</span> {t("host.inLobby")}
                        </>
                      ) : (
                        t("host.waiting")
                      )}
                    </h2>
                    <Button size="xl" className="mt-10" onClick={() => act("pick")} loading={busy === "pick"} disabled={!room.playerCount}>
                      <Shuffle className="size-7" /> {t("host.pick")}
                    </Button>
                  </Stage>
                )}

                {room.phase === "recording" && room.picked && (
                  <Stage key={`rec-${room.round}`}>
                    <motion.div initial={{ scale: 0.4, rotate: -12 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", bounce: 0.5 }}>
                      <Avatar player={room.picked} size="xl" className="neon-glow" />
                    </motion.div>
                    <h2 className="mt-5 font-display text-4xl font-bold sm:text-5xl">{room.picked.name}</h2>
                    <p className="mt-3 flex items-center gap-2 text-lg text-white/60">
                      <span className="size-2.5 animate-pulse rounded-full bg-rose-500" />
                      {t("host.recordingClip")} <SecondsSince since={room.pickedAt} />
                    </p>
                    <NoResponse
                      since={room.pickedAt}
                      onSkip={() => {
                        stopAudio();
                        void act("skip");
                      }}
                      loading={busy === "skip"}
                    />
                  </Stage>
                )}

                {showRound && (
                  <Stage key={`round-${room.clipId}`}>
                    <GuidedRound
                      player={room.picked!}
                      original={original}
                      playback={playback}
                      onReveal={() => room.phase === "guessing" && void act("reveal")}
                      onVerdict={(verdict) => act("finish", { verdict })}
                      finishing={busy === "finish"}
                    />
                  </Stage>
                )}
              </AnimatePresence>
            </div>

            {(error || clipFailed) && <p className="text-center text-sm text-rose-400">{error ?? t("host.clipLoadError")}</p>}
          </section>

          <aside className="flex flex-col gap-5">
            <AnimatePresence>
              {inRound && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="glass rounded-3xl border-rose-500/30 p-5"
                >
                  <p className="text-xs font-semibold uppercase tracking-widest text-rose-300/80">{t("host.moderation")}</p>
                  <div className="mt-3 grid gap-2">
                    <Button variant="danger" size="lg" onClick={panic} loading={busy === "ban"}>
                      <Ban className="size-5" /> {t("host.panic")}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        stopAudio();
                        void act("skip");
                      }}
                      loading={busy === "skip"}
                    >
                      <SkipForward className="size-4" /> {t("host.skip")}
                    </Button>
                  </div>
                  <p className="mt-3 text-xs text-white/40">{t("host.panicHint")}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <LastResult result={room.lastResult} />

            <div className="glass rounded-3xl p-5 text-sm text-white/60">
              <p className="text-xs font-semibold uppercase tracking-widest text-white/40">{t("host.howTitle")}</p>
              <ol className="mt-3 space-y-2">
                <li>1. {t("host.how1")}</li>
                <li>2. {t("host.how2")}</li>
                <li>3. {t("host.how3")}</li>
              </ol>
            </div>

            {devTools && <DevTools code={code} />}
          </aside>
        </div>
      </div>
    </main>
  );
}

function Stage({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -16, scale: 0.98 }}
      transition={{ duration: 0.25 }}
      className="flex w-full flex-col items-center"
    >
      {children}
    </motion.div>
  );
}

const NO_RESPONSE_AFTER_MS = 45_000;

/** After 45 s without a clip, offer the obvious way out right where the streamer is looking. */
function NoResponse({ since, onSkip, loading }: { since: number | null; onSkip: () => void; loading: boolean }) {
  const { t } = useI18n();
  const [late, setLate] = useState(false);
  useEffect(() => {
    if (!since) return;
    const wait = since + NO_RESPONSE_AFTER_MS - Date.now();
    if (wait <= 0) return setLate(true);
    const id = setTimeout(() => setLate(true), wait);
    return () => clearTimeout(id);
  }, [since]);
  if (!late) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-8 flex flex-col items-center gap-3">
      <p className="text-sm text-white/60">{t("host.noResponse")}</p>
      <Button size="lg" onClick={onSkip} loading={loading}>
        <SkipForward className="size-5" /> {t("host.skip")}
      </Button>
    </motion.div>
  );
}

/**
 * Room link for chat. Hidden by default so it isn't readable on stream; copying works either way,
 * and the copied link already contains the code, so viewers only have to click it.
 */
function RoomBanner({
  code,
  members,
  maxPlayers,
  locked,
  onSetMax,
}: {
  code: string;
  members: number;
  maxPlayers: number;
  locked: boolean;
  onSetMax: (n: number) => void;
}) {
  const { t, fmt } = useI18n();
  const full = members >= maxPlayers;
  const [origin, setOrigin] = useState("");
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => setOrigin(window.location.origin), []);
  const link = `${origin}/play/${code}`;

  async function copy() {
    await copyText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="glass flex flex-col gap-4 rounded-3xl px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/40">
          {t("host.roomLink")}
          {locked && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] tracking-wider text-amber-300">
              <Lock className="size-3" /> {t("host.lockedBadge")}
            </span>
          )}
          {full && !locked && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] tracking-wider text-amber-300">
              <Users className="size-3" /> {t("host.fullBadge")}
            </span>
          )}
        </p>
        {visible ? (
          <button
            type="button"
            onClick={copy}
            title={t("host.copyLink")}
            className="mt-1 max-w-full truncate text-left font-display text-2xl font-bold transition hover:text-neon-300 sm:text-3xl"
          >
            {link.replace(/^https?:\/\//, "").replace(code, "")}
            <span className="neon-text">{code}</span>
          </button>
        ) : (
          <p className="mt-1 select-none font-display text-2xl font-bold tracking-widest text-white/25 sm:text-3xl">
            •••••••••••••• <span className="ml-2 align-middle text-sm font-medium tracking-normal">{t("host.linkHidden")}</span>
          </p>
        )}
        <p className="mt-1 text-xs text-white/40">{t("host.linkHint")}</p>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setVisible((v) => !v)}>
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          {visible ? t("host.hide") : t("host.show")}
        </Button>
        <Button size="sm" onClick={copy} disabled={!origin}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? t("host.copied") : t("host.copyLink")}
        </Button>
        <div className="ml-2 flex flex-col items-center">
          <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-white/40">
            <Users className="size-3.5 text-neon-400" /> {t("host.players")}
          </p>
          <div className="mt-1 flex items-center gap-1.5">
            <button
              type="button"
              aria-label={t("host.fewer")}
              disabled={maxPlayers <= 1}
              onClick={() => onSetMax(maxPlayers - 1)}
              className="grid size-6 place-items-center rounded-full bg-white/5 text-white/60 transition hover:bg-white/15 hover:text-white disabled:opacity-30"
            >
              <Minus className="size-3.5" />
            </button>
            <motion.p
              key={members}
              initial={{ scale: 1.2 }}
              animate={{ scale: 1 }}
              className={`font-mono text-2xl font-bold tabular-nums ${full ? "text-amber-300" : ""}`}
            >
              {fmt(members)}
              <span className="text-white/35">/{fmt(maxPlayers)}</span>
            </motion.p>
            <button
              type="button"
              aria-label={t("host.more")}
              disabled={maxPlayers >= MAX_PLAYERS_LIMIT}
              onClick={() => onSetMax(maxPlayers + 1)}
              className="grid size-6 place-items-center rounded-full bg-white/5 text-white/60 transition hover:bg-white/15 hover:text-white disabled:opacity-30"
            >
              <Plus className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Clipboard API with a fallback for browsers/contexts that refuse it. */
async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const el = document.createElement("textarea");
    el.value = text;
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    el.remove();
  }
}

function DevTools({ code }: { code: string }) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  return (
    <div className="rounded-3xl border border-dashed border-amber-400/30 bg-amber-400/5 p-5">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-amber-300/80">
        <Bot className="size-4" /> {t("dev.title")}
      </p>
      <p className="mt-2 text-xs text-white/50">{t("dev.body")}</p>
      <Button
        variant="ghost"
        size="sm"
        className="mt-3"
        loading={loading}
        onClick={async () => {
          setLoading(true);
          await api("/api/dev/seed", { method: "POST", json: { code, count: 25 } }).catch(() => {});
          setLoading(false);
        }}
      >
        {t("dev.addBots")}
      </Button>
    </div>
  );
}
