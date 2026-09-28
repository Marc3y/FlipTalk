"use client";

export type MicStatus = "granted" | "denied" | "unavailable";

/**
 * Makes sure this browser will let us record before a viewer enters the lobby.
 * If permission was already granted we don't touch the microphone at all; otherwise we open it
 * once (which shows the browser's prompt) and release it immediately.
 */
export async function checkMic(): Promise<MicStatus> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return "unavailable";
  try {
    // Not supported everywhere (Firefox throws for "microphone"); then we just ask directly.
    const permission = await navigator.permissions?.query({ name: "microphone" as PermissionName });
    if (permission?.state === "granted") return "granted";
    if (permission?.state === "denied") return "denied";
  } catch {}
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return "granted";
  } catch (err) {
    const name = err instanceof DOMException ? err.name : "";
    return name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unavailable";
  }
}
