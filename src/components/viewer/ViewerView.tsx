"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Ban, Bell, BellRing, DoorOpen, Headphones, Loader2, Lock, Mic, MicOff, PartyPopper, Radio, RefreshCw, Sparkles, Users, UsersRound } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { LastResult } from "@/components/LastResult";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { UserBadge } from "@/components/UserBadge";
import { VolumeControl } from "@/components/VolumeControl";
import { useMe, useRoomState } from "@/hooks/useRoom";
import { DEFAULT_MAX_PLAYERS } from "@/lib/constants";
import { api, ApiError } from "@/lib/api-client";
import { getAudioContext, isAudioUnlocked } from "@/lib/audio";
import { useI18n } from "@/lib/i18n/client";
import { checkMic, type MicStatus } from "@/lib/mic";
import { playChime } from "@/lib/sounds";
import type { MeState, RoomState } from "@/lib/types";
import { RecordPanel } from "./RecordPanel";

/** When a closed lobby reopens, waiting viewers rejoin spread over this window instead of all at once. */
const REOPEN_JITTER_MS = 3000;

/** No free slot for this viewer: they don't hold one and every slot is taken. */
function isShutOut(room: RoomState, me: MeState) {
  return !me.member && room.picked?.id !== me.user?.id && room.memberCount >= (room.maxPlayers ?? DEFAULT_MAX_PLAYERS);
}

export function ViewerView({ initial, initialMe, token }: { initial: RoomState; initialMe: MeState; token: string | null }) {
  const code = initial.code;
  // Viewers outside a full room get no socket at all; computed from the server data so none opens even briefly.
  const [live, setLive] = useState(() => !isShutOut(initial, initialMe));
  const { state, apply, refresh } = useRoomState(code, initial, { token, live });
  const room = state ?? initial;
  const { t, fmt } = useI18n();
  const { me, setMe, refresh: refreshMe } = useMe(code, initialMe);
  const full = isShutOut(room, me);
  useEffect(() => setLive(!full), [full]);
  const [checking, setChecking] = useState(false);
  const maxPlayers = room.maxPlayers ?? DEFAULT_MAX_PLAYERS;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mic, setMic] = useState<"idle" | "checking" | MicStatus>("idle");
  // Browsers only allow sound after a tap on the page; after the automatic join we offer a button.
  const [soundOn, setSoundOn] = useState(false);
  useEffect(() => setSoundOn(isAudioUnlocked()), []);

  const leftKey = `fliptalk:left:${code}`;
  /** Viewer left on purpose: don't pull them back in automatically (kept across reloads of this tab). */
  const [left, setLeft] = useState(false);
  // sessionStorage only exists in the browser; auto-join waits until it has been read.
  const [storageRead, setStorageRead] = useState(false);
  useEffect(() => {
    try {
      setLeft(sessionStorage.getItem(leftKey) === "1");
    } catch {}
    setStorageRead(true);
  }, [leftKey]);
  /** Had their turn this visit: they rejoin with a button, so others get a chance first. */
  const [hadTurn, setHadTurn] = useState(false);

  const isPicked = !!me.user && room.picked?.id === me.user.id;
  // Being picked removes you from the pool server-side, so don't show "in lobby" during your turn.
  const inQueue = me.joined && !isPicked;

  // Only the one viewer whose turn just ended refetches (joined/banned changed); everyone else derives state locally.
  const wasPicked = useRef(isPicked);
  useEffect(() => {
    if (isPicked && !wasPicked.current && room.phase === "recording") {
      playChime("picked");
      navigator.vibrate?.([200, 100, 200, 100, 400]);
    }
    if (!isPicked && wasPicked.current) {
      setHadTurn(true);
      void refreshMe();
    }
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

  /** Microphone check, then join. Nobody without a usable microphone enters the pool. */
  const enter = useCallback(async () => {
    setError(null);
    setMic("checking");
    const status = await checkMic();
    setMic(status);
    if (status !== "granted") return;
    setBusy(true);
    try {
      await api(`/api/rooms/${code}/join`, { method: "POST", json: { mic: true } });
      setMe((m) => ({ ...m, joined: true, member: true }));
      setHadTurn(false);
    } catch (e) {
      if (e instanceof ApiError && e.code === "err.banned") setMe((m) => ({ ...m, banned: true }));
      // Lost the race for the last slot: show "full" from fresh state instead of an error line.
      else if (e instanceof ApiError && e.code === "err.roomFull") void refresh();
      // A closed lobby is shown from room state; no need for an extra error line.
      else if (!(e instanceof ApiError && e.code === "err.lobbyLocked")) setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [code, setMe, refresh]);

  // Join automatically once signed in: no button to find. Retries only when the lobby reopens.
  const canAutoJoin =
    storageRead && !full && !!me.user && !me.joined && !me.banned && !isPicked && !left && !hadTurn && room.phase !== "closed" && !room.locked;
  const autoTried = useRef(false);
  const waitedForUnlock = useRef(false);
  useEffect(() => {
    if (room.locked) {
      autoTried.current = false;
      waitedForUnlock.current = true;
    }
  }, [room.locked]);
  useEffect(() => {
    if (!canAutoJoin || autoTried.current) return;
    autoTried.current = true;
    const delay = waitedForUnlock.current ? Math.random() * REOPEN_JITTER_MS : 0;
    const id = setTimeout(() => void enter(), delay);
    return () => clearTimeout(id);
  }, [canAutoJoin, enter]);

  function manualJoin() {
    getAudioContext(); // this tap also unlocks the pick sound
    setSoundOn(true);
    try {
      sessionStorage.removeItem(leftKey);
    } catch {}
    setLeft(false);
    void enter();
  }

  async function leave() {
    setBusy(true);
    try {
      await api(`/api/rooms/${code}/leave`, { method: "POST" });
      // We just freed our own slot. Count it locally: otherwise a room that was full a moment ago
      // would look full to us, switch off our socket, and never deliver the corrected count.
      apply({
        ...room,
        memberCount: Math.max(0, room.memberCount - 1),
        playerCount: me.joined ? Math.max(0, room.playerCount - 1) : room.playerCount,
      });
      setMe((m) => ({ ...m, joined: false, member: false }));
      setLeft(true);
      try {
        sessionStorage.setItem(leftKey, "1");
      } catch {}
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function enableSound() {
    getAudioContext();
    playChime("test");
    setSoundOn(true);
  }

  const status: { key: string; node: React.ReactNode } = (() => {
    if (room.phase === "closed")
      return {
        key: "closed",
        node: (
          <Status icon={<DoorOpen className="size-10 text-white/50" />} title={t("viewer.closedTitle")} body={t("viewer.closedBody")}>
            <Link href="/play" className="mt-4 inline-block font-semibold text-neon-300">
              {t("viewer.joinAnother")}
            </Link>
          </Status>
        ),
      };
    if (me.banned)
      return { key: "banned", node: <Status icon={<Ban className="size-10 text-rose-400" />} title={t("viewer.bannedTitle")} body={t("viewer.bannedBody")} /> };
    if (isPicked && room.phase === "recording")
      return {
        key: `rec-${room.round}`,
        node: (
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
        ),
      };
    if (isPicked)
      return {
        key: "on-stream",
        node: (
          <Status
            icon={<PartyPopper className="size-10 text-neon-400" />}
            title={t("viewer.onStreamTitle")}
            body={room.phase === "reveal" ? t("viewer.onStreamReveal") : t("phase.guessing", { host: room.host.name })}
          />
        ),
      };
    if (inQueue)
      return {
        key: "queue",
        node: (
          <Status icon={<QueuePulse />} title={t("viewer.inLobbyTitle")} body={t("viewer.inLobbyBody")}>
            <SoundToggle on={soundOn} onEnable={enableSound} />
            <Button variant="ghost" size="sm" className="mt-3" onClick={leave} loading={busy}>
              {t("viewer.leave")}
            </Button>
          </Status>
        ),
      };
    if (mic === "denied" || mic === "unavailable")
      return {
        key: `mic-${mic}`,
        node: (
          <Status
            icon={<MicOff className="size-10 text-rose-400" />}
            title={mic === "denied" ? t("viewer.micDeniedTitle") : t("viewer.micUnavailableTitle")}
            body={mic === "denied" ? t("viewer.micDeniedBody") : t("viewer.micUnavailableBody")}
          >
            <Button size="lg" className="mt-6 w-full" onClick={manualJoin}>
              <Mic className="size-5" /> {t("viewer.micRetry")}
            </Button>
          </Status>
        ),
      };
    if (full)
      return {
        key: "full",
        node: (
          <Status
            icon={<UsersRound className="size-10 text-amber-300" />}
            title={t("viewer.fullTitle")}
            body={t("viewer.fullBody", { max: maxPlayers })}
          >
            {/* One CDN-cached request per tap; no socket, no polling while the room is full. */}
            <Button
              variant="ghost"
              size="md"
              className="mt-6"
              loading={checking}
              onClick={async () => {
                setChecking(true);
                await refresh();
                setChecking(false);
              }}
            >
              <RefreshCw className="size-4" /> {t("viewer.fullRetry")}
            </Button>
          </Status>
        ),
      };
    if (room.locked && !busy && mic !== "checking")
      return { key: "locked", node: <Status icon={<Lock className="size-10 text-amber-300" />} title={t("viewer.lockedTitle")} body={t("viewer.lockedBody")} /> };
    if (hadTurn || left)
      return {
        key: "rejoin",
        node: (
          <Status icon={<Mic className="size-10 text-neon-400" />} title={t("viewer.readyTitle")} body={t("viewer.readyBody")}>
            <Button size="lg" className="mt-6 w-full" onClick={manualJoin} loading={busy || mic === "checking"}>
              {hadTurn ? t("viewer.rejoin") : t("viewer.join")}
            </Button>
          </Status>
        ),
      };
    // Automatic join in progress (microphone check or request).
    return {
      key: "checking",
      node: (
        <Status icon={<Loader2 className="size-10 animate-spin text-neon-400" />} title={t("viewer.micChecking")} body={t("viewer.micCheckingBody")} />
      ),
    };
  })();

  return (
    <main className="app-bg min-h-dvh pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-6 pt-4">
        <header className="flex items-center justify-between gap-2">
          <Logo />
          {me.user && <UserBadge user={me.user} />}
        </header>

        <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/3 px-4 py-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/40">{t("viewer.room")}</p>
            <p className="font-mono text-xl font-bold tracking-[0.2em]">{code}</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-white/60">
            <Radio className="size-4 text-rose-400" />
            <span className="truncate">{room.host.name}</span>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-sm tabular-nums text-white/70">
            <Users className="size-4 text-neon-400" /> {fmt(room.memberCount)}/{fmt(maxPlayers)}
          </div>
        </div>

        {/* Who's up right now, for everyone who isn't. */}
        {room.picked && !isPicked && room.phase !== "lobby" && room.phase !== "closed" && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/3 px-4 py-3">
            <Avatar player={room.picked} size="sm" />
            <p className="min-w-0 text-sm">
              <span className="font-semibold">{room.picked.name}</span>{" "}
              <span className="text-white/60">
                {room.phase === "recording"
                  ? t("host.recordingClip")
                  : room.phase === "guessing"
                    ? t("phase.guessing", { host: room.host.name })
                    : t("phase.reveal")}
              </span>
            </p>
          </div>
        )}

        <section className="glass mt-4 flex flex-1 flex-col justify-center rounded-3xl p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={status.key}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
            >
              {status.node}
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
          <div className="flex flex-wrap items-center justify-center gap-2">
            <VolumeControl />
            <LanguageSwitch />
          </div>
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
