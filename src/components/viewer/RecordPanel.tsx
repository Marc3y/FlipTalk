"use client";
import { Headphones, RotateCcw, Send, Square, Undo2 } from "lucide-react";
import { useState } from "react";
import { RecordButton } from "@/components/RecordButton";
import { Button } from "@/components/ui/Button";
import { Visualizer } from "@/components/Visualizer";
import { useAudioPlayback } from "@/hooks/useAudioPlayback";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useReverseAudio } from "@/hooks/useReverseAudio";
import { bufferToWav } from "@/lib/audio";
import { useI18n } from "@/lib/i18n/client";
import type { RoomState } from "@/lib/types";

/** The picked viewer's turn: record, preview (normal + reversed), send. */
export function RecordPanel({ code, onSent }: { code: string; onSent: (state: RoomState) => void }) {
  const { t } = useI18n();
  const recorder = useAudioRecorder();
  const { reversed } = useReverseAudio(recorder.clip);
  const playback = useAudioPlayback();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!recorder.clip) return;
    playback.stop();
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/rooms/${code}/clip`, {
        method: "POST",
        headers: { "Content-Type": "audio/wav" },
        body: bufferToWav(recorder.clip),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("rec.uploadFailed"));
      onSent(data as RoomState);
    } catch (e) {
      setError((e as Error).message);
      setSending(false);
    }
  }

  const analyser = recorder.status === "recording" ? recorder.analyser : playback.playing ? playback.analyser : null;
  const hasClip = recorder.status === "done" && recorder.clip;

  return (
    <div className="flex flex-col items-center">
      <Visualizer analyser={analyser} bars={32} className="h-20" hue={recorder.status === "recording" ? 340 : 275} />

      {!hasClip ? (
        <>
          <div className="mt-6">
            <RecordButton
              status={recorder.status}
              elapsed={recorder.elapsed}
              maxSeconds={recorder.maxSeconds}
              onStart={recorder.start}
              onStop={recorder.stop}
            />
          </div>
          <p className="mt-5 text-center text-sm text-white/60">
            {recorder.status === "recording" ? t("rec.recordingHint") : t("rec.idleHint", { s: recorder.maxSeconds })}
          </p>
        </>
      ) : (
        <div className="mt-6 w-full space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant={playback.playing === "original" ? "primary" : "ghost"}
              onClick={() => (playback.playing === "original" ? playback.stop() : playback.play(recorder.clip!, "original"))}
            >
              {playback.playing === "original" ? <Square className="size-4" /> : <Headphones className="size-4" />}
              {t("rec.normal")}
            </Button>
            <Button
              variant={playback.playing === "reversed" ? "primary" : "ghost"}
              onClick={() => (playback.playing === "reversed" ? playback.stop() : reversed && playback.play(reversed, "reversed"))}
            >
              {playback.playing === "reversed" ? <Square className="size-4" /> : <Undo2 className="size-4" />}
              {t("rec.reversed")}
            </Button>
          </div>
          <p className="text-center text-xs text-white/40">{t("rec.meta", { s: recorder.clip!.duration.toFixed(1) })}</p>
          <Button size="lg" className="w-full" onClick={send} loading={sending}>
            <Send className="size-5" /> {t("rec.send")}
          </Button>
          <Button variant="ghost" className="w-full" onClick={recorder.reset} disabled={sending}>
            <RotateCcw className="size-4" /> {t("rec.again")}
          </Button>
        </div>
      )}

      {(recorder.error || error) && (
        <p className="mt-4 text-center text-sm text-rose-400">{recorder.error ? t(recorder.error) : error}</p>
      )}
    </div>
  );
}
