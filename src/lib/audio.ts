"use client";
import { CLIP_SAMPLE_RATE, MAX_CLIP_SECONDS } from "./constants";
import { encodeWav } from "./wav";

let ctx: AudioContext | null = null;

/**
 * One shared AudioContext. Call this from a click handler at least once so browsers
 * that block autoplay (Safari, Chrome) let later playback start without a gesture.
 */
export function getAudioContext() {
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** False until a user gesture has resumed the context (browsers block sound before that). */
export function isAudioUnlocked() {
  return ctx?.state === "running";
}

export async function decodeAudio(data: Blob | ArrayBuffer) {
  const bytes = data instanceof Blob ? await data.arrayBuffer() : data;
  return getAudioContext().decodeAudioData(bytes);
}

export function reverseBuffer(buffer: AudioBuffer): AudioBuffer {
  const out = new AudioBuffer({
    length: buffer.length,
    numberOfChannels: buffer.numberOfChannels,
    sampleRate: buffer.sampleRate,
  });
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const src = buffer.getChannelData(c);
    const dst = out.getChannelData(c);
    for (let i = 0, j = src.length - 1; j >= 0; i++, j--) dst[i] = src[j];
  }
  return out;
}

/**
 * Downmixes to mono, resamples, hard-trims to the duration cap and normalizes loudness.
 * The result is what gets uploaded, so it always passes the server's WAV check.
 */
export async function toClip(buffer: AudioBuffer, maxSeconds = MAX_CLIP_SECONDS, sampleRate = CLIP_SAMPLE_RATE) {
  const frames = Math.max(1, Math.floor(Math.min(buffer.duration, maxSeconds) * sampleRate));
  const offline = new OfflineAudioContext(1, frames, sampleRate);
  const source = offline.createBufferSource();
  source.buffer = buffer;
  source.connect(offline.destination);
  source.start(0);
  const clip = await offline.startRendering();

  const data = clip.getChannelData(0);
  let peak = 0;
  for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  if (peak > 0.01) {
    const gain = Math.min(0.95 / peak, 4); // don't blow up pure noise
    for (let i = 0; i < data.length; i++) data[i] *= gain;
  }
  return clip;
}

export function bufferToWav(buffer: AudioBuffer): Blob {
  return new Blob([encodeWav(buffer.getChannelData(0), buffer.sampleRate)], { type: "audio/wav" });
}

export function pickRecorderMimeType() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return candidates.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t));
}
