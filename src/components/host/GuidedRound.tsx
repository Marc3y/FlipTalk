"use client";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Ear, Headphones, Loader2, Repeat2, Square, ThumbsDown, ThumbsUp } from "lucide-react";
import { useEffect, useState } from "react";
import { RecordButton } from "@/components/RecordButton";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Visualizer } from "@/components/Visualizer";
import type { useAudioPlayback } from "@/hooks/useAudioPlayback";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useReverseAudio } from "@/hooks/useReverseAudio";
import { useI18n } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";
import type { PublicPlayer, Verdict } from "@/lib/types";

const STEPS: Array<{ label: MessageKey; need: MessageKey | null }> = [
  { label: "round.stepListen", need: "round.needListen" },
  { label: "round.stepImitate", need: "round.needRecord" },
  { label: "round.stepFlip", need: "round.needFlip" },
  { label: "round.stepCompare", need: null },
];
const VERDICT = STEPS.length;

/**
 * One round from the streamer's side. Each step has one big action that can be repeated as often as
 * the streamer likes; nothing advances on its own. Once the step's action has been done at least
 * once, the glow moves to "Next". Mounted with `key={clipId}`, so progress resets with each new clip.
 */
export function GuidedRound({
  player,
  original,
  playback,
  onReveal,
  onVerdict,
  finishing,
}: {
  player: PublicPlayer;
  original: AudioBuffer | null;
  playback: ReturnType<typeof useAudioPlayback>;
  /** Called once when the streamer first plays their flipped attempt; tells viewers it's reveal time. */
  onReveal: () => void;
  onVerdict: (verdict: Verdict) => void;
  finishing: boolean;
}) {
  const { t } = useI18n();
  const recorder = useAudioRecorder();
  const { reversed } = useReverseAudio(original);
  // The streamer imitates the reversed clip; flipping their attempt should sound like the original.
  const { reversed: attemptFlipped } = useReverseAudio(recorder.clip);

  const [step, setStep] = useState(0);
  const [heardReversed, setHeardReversed] = useState(false);
  const [heardAttempt, setHeardAttempt] = useState(false);
  const [revealed, setRevealed] = useState(false);

  // A new take has to be listened to again before moving on.
  useEffect(() => setHeardAttempt(false), [recorder.clip]);

  const recorderBusy = recorder.status === "recording" || recorder.status === "requesting" || recorder.status === "processing";
  const done = [heardReversed, !!attemptFlipped && !recorderBusy, heardAttempt, true];
  /** Furthest step reachable: every step before it has been done. */
  const reachable = done.findIndex((d) => !d) === -1 ? VERDICT : done.findIndex((d) => !d);
  const canNext = step < VERDICT && done[step];

  const { play, stop, playing } = playback;

  function goTo(target: number) {
    if (target < 0 || target > reachable || recorderBusy) return;
    stop();
    setStep(target);
  }

  function listen() {
    if (reversed) void play(reversed, "reversed").then(() => setHeardReversed(true));
  }
  function flip() {
    if (!attemptFlipped) return;
    if (!revealed) {
      setRevealed(true);
      onReveal();
    }
    void play(attemptFlipped, "attempt").then(() => setHeardAttempt(true));
  }
  function compare() {
    if (original) void play(original, "original");
  }

  const analyser = recorder.status === "recording" ? recorder.analyser : playing ? playback.analyser : null;

  return (
    <div className="flex w-full flex-col items-center">
      <div className="flex items-center gap-3">
        <Avatar player={player} size="md" />
        <p className="font-display text-2xl font-bold sm:text-3xl">
          {t("round.clipOf", { name: player.name })} <span className="font-normal text-white/50">{t("round.vsYou")}</span>
        </p>
      </div>

      <Stepper step={step} reachable={reachable} done={done} onSelect={goTo} disabled={recorderBusy} />

      <Visualizer analyser={analyser} bars={56} className="mt-6 h-24" hue={recorder.status === "recording" ? 340 : 275} />

      <div className="mt-6 flex min-h-56 w-full flex-col items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.2 }}
            className="flex w-full flex-col items-center"
          >
            {step === 0 && (
              <HeroButton
                glow={!done[0]}
                onClick={playing === "reversed" ? stop : listen}
                loading={!reversed}
                active={playing === "reversed"}
                icon={playing === "reversed" ? <Square className="size-8 fill-current" /> : <Ear className="size-9" />}
                label={
                  playing === "reversed"
                    ? t("round.playingStop")
                    : heardReversed
                      ? t("round.listenAgain")
                      : t("round.listen", { name: player.name })
                }
                hint={reversed ? t("round.listenHint") : t("round.loadingClip")}
              />
            )}

            {step === 1 && (
              <div className="flex flex-col items-center">
                <Glow on={!done[1]}>
                  <RecordButton
                    size={200}
                    status={recorder.status}
                    elapsed={recorder.elapsed}
                    maxSeconds={recorder.maxSeconds}
                    onStart={() => {
                      stop();
                      void recorder.start();
                    }}
                    onStop={recorder.stop}
                  />
                </Glow>
                <p className="mt-5 font-display text-2xl font-bold">
                  {recorder.status === "recording"
                    ? t("round.recording")
                    : recorder.clip
                      ? t("round.recordAgainTitle")
                      : t("round.recordTitle")}
                </p>
                <p className={`mt-1 text-sm ${recorder.error ? "text-rose-400" : "text-white/50"}`}>
                  {recorder.error
                    ? t(recorder.error)
                    : recorder.clip
                      ? t("round.recordAgainHint")
                      : t("round.recordHint", { s: recorder.maxSeconds })}
                </p>
              </div>
            )}

            {step === 2 && (
              <HeroButton
                glow={!done[2]}
                onClick={playing === "attempt" ? stop : flip}
                active={playing === "attempt"}
                icon={playing === "attempt" ? <Square className="size-8 fill-current" /> : <Repeat2 className="size-9" />}
                label={playing === "attempt" ? t("round.playingStop") : heardAttempt ? t("round.flipAgain") : t("round.flip")}
                hint={t("round.flipHint")}
              />
            )}

            {step === 3 && (
              <HeroButton
                glow={false}
                onClick={playing === "original" ? stop : compare}
                active={playing === "original"}
                loading={!original}
                icon={playing === "original" ? <Square className="size-8 fill-current" /> : <Headphones className="size-9" />}
                label={playing === "original" ? t("round.playingStop") : t("round.compare", { name: player.name })}
                hint={t("round.compareHint")}
              />
            )}

            {step === VERDICT && (
              <div className="flex flex-col items-center">
                <p className="font-display text-2xl font-bold">{t("round.verdictTitle")}</p>
                <div className="mt-5 flex gap-4">
                  <Glow on color="emerald">
                    <Button variant="success" size="xl" onClick={() => onVerdict("nailed")} loading={finishing}>
                      <ThumbsUp className="size-7" /> {t("round.nailed")}
                    </Button>
                  </Glow>
                  <Button variant="danger" size="xl" onClick={() => onVerdict("failed")} loading={finishing}>
                    <ThumbsDown className="size-7" /> {t("round.failed")}
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-8 flex w-full max-w-2xl items-center justify-between gap-4">
        <Button variant="ghost" size="lg" onClick={() => goTo(step - 1)} disabled={step === 0 || recorderBusy} className={step === 0 ? "invisible" : ""}>
          <ArrowLeft className="size-5" /> {t("round.back")}
        </Button>

        {step < VERDICT && (
          <div className="flex flex-col items-end gap-1.5">
            <Glow on={canNext && !playing}>
              <Button size="lg" onClick={() => goTo(step + 1)} disabled={!canNext} className="min-w-44">
                {step === VERDICT - 1 ? t("round.toVerdict") : t("round.next")} <ArrowRight className="size-5" />
              </Button>
            </Glow>
            {!canNext && STEPS[step].need && <p className="text-xs text-white/40">{t(STEPS[step].need!)}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function Stepper({
  step,
  reachable,
  done,
  onSelect,
  disabled,
}: {
  step: number;
  reachable: number;
  done: boolean[];
  onSelect: (i: number) => void;
  disabled: boolean;
}) {
  const { t } = useI18n();
  return (
    <ol className="mt-6 flex items-center gap-2 sm:gap-3">
      {STEPS.map((s, i) => {
        const active = i === step;
        const complete = done[i] && i < reachable;
        const clickable = !disabled && i <= reachable && !active;
        return (
          <li key={s.label} className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => onSelect(i)}
              disabled={!clickable}
              aria-current={active ? "step" : undefined}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold transition-all enabled:hover:brightness-125 ${
                active
                  ? "bg-neon-500 text-white neon-glow"
                  : complete
                    ? "bg-emerald-400/15 text-emerald-300"
                    : "bg-white/5 text-white/35"
              } ${clickable ? "cursor-pointer" : "cursor-default"}`}
            >
              <span className="grid size-5 place-items-center rounded-full bg-black/20 text-xs">
                {complete && !active ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span className="hidden sm:inline">{t(s.label)}</span>
            </button>
            {i < STEPS.length - 1 && <span className={`h-px w-4 sm:w-8 ${complete ? "bg-emerald-400/40" : "bg-white/10"}`} />}
          </li>
        );
      })}
    </ol>
  );
}

/** Pulsing halo that marks the one thing to press next. */
function Glow({ children, on, color = "neon" }: { children: React.ReactNode; on: boolean; color?: "neon" | "emerald" }) {
  const ring = color === "emerald" ? "bg-emerald-400/40" : "bg-neon-500/50";
  return (
    <div className="relative">
      {on && (
        <motion.span
          aria-hidden
          className={`absolute -inset-3 rounded-[2.5rem] blur-xl ${ring}`}
          animate={{ opacity: [0.35, 0.9, 0.35], scale: [0.96, 1.04, 0.96] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      <div className="relative">{children}</div>
    </div>
  );
}

function HeroButton({
  onClick,
  icon,
  label,
  hint,
  loading,
  active,
  glow,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
  loading?: boolean;
  active?: boolean;
  /** Glows until the step's action has been done once; after that the glow moves to "Next". */
  glow: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      <Glow on={glow}>
        <motion.button
          type="button"
          whileTap={{ scale: 0.95 }}
          whileHover={{ scale: 1.02 }}
          onClick={onClick}
          disabled={loading}
          className={`flex h-28 items-center justify-center gap-4 rounded-4xl px-10 font-display text-2xl font-bold text-white transition disabled:cursor-wait sm:min-w-88 sm:text-3xl ${
            active
              ? "bg-gradient-to-b from-fuchsia-500 to-neon-600 ring-2 ring-white/20"
              : glow
                ? "bg-gradient-to-b from-neon-400 to-neon-600 shadow-[0_20px_60px_-15px_rgb(168_85_247/0.9)] ring-2 ring-white/20"
                : "bg-gradient-to-b from-neon-500/70 to-neon-700/70 ring-1 ring-white/15 hover:from-neon-500 hover:to-neon-600"
          }`}
        >
          {loading ? <Loader2 className="size-9 animate-spin" /> : icon}
          {label}
        </motion.button>
      </Glow>
      <p className="mt-5 text-sm text-white/55">{hint}</p>
    </div>
  );
}
