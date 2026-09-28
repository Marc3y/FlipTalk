"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { decodeAudio, getAudioContext, pickRecorderMimeType, toClip } from "@/lib/audio";
import { MAX_CLIP_SECONDS } from "@/lib/constants";
import type { MessageKey } from "@/lib/i18n/messages";

export type RecorderStatus = "idle" | "requesting" | "recording" | "processing" | "done" | "error";

/**
 * Records from the microphone, auto-stops at `maxSeconds`, and returns the result as a
 * trimmed, mono AudioBuffer (`clip`). `analyser` is live while recording, for visualizers.
 */
export function useAudioRecorder({ maxSeconds = MAX_CLIP_SECONDS } = {}) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [clip, setClip] = useState<AudioBuffer | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  /** Translation key, so each view renders it in the current language. */
  const [error, setError] = useState<MessageKey | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timersRef = useRef<{ stop?: ReturnType<typeof setTimeout>; tick?: ReturnType<typeof setInterval> }>({});

  const releaseMic = useCallback(() => {
    clearTimeout(timersRef.current.stop);
    clearInterval(timersRef.current.tick);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setAnalyser(null);
  }, []);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }, []);

  const start = useCallback(async () => {
    if (recorderRef.current?.state === "recording") return;
    setError(null);
    setClip(null);
    setElapsed(0);
    setStatus("requesting");
    try {
      const ctx = getAudioContext();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;

      const node = ctx.createAnalyser();
      node.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(node);
      setAnalyser(node);

      const mimeType = pickRecorderMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      recorder.onstop = async () => {
        releaseMic();
        setStatus("processing");
        try {
          const decoded = await decodeAudio(new Blob(chunks, { type: recorder.mimeType }));
          setClip(await toClip(decoded, maxSeconds));
          setStatus("done");
        } catch {
          setError("mic.process");
          setStatus("error");
        }
      };

      const startedAt = performance.now();
      recorder.start();
      setStatus("recording");
      timersRef.current.tick = setInterval(() => setElapsed(Math.min(maxSeconds, (performance.now() - startedAt) / 1000)), 50);
      timersRef.current.stop = setTimeout(() => recorder.state === "recording" && recorder.stop(), maxSeconds * 1000);
    } catch (err) {
      releaseMic();
      const denied = err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "SecurityError");
      setError(denied ? "mic.blocked" : "mic.none");
      setStatus("error");
    }
  }, [maxSeconds, releaseMic]);

  const reset = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.onstop = null;
      recorderRef.current.stop();
    }
    releaseMic();
    setClip(null);
    setElapsed(0);
    setError(null);
    setStatus("idle");
  }, [releaseMic]);

  useEffect(() => reset, [reset]);

  return { status, elapsed, maxSeconds, clip, analyser, error, start, stop, reset };
}
