// Shared between client and server. Changing a limit here changes it everywhere.

/** Hard cap for any clip, enforced on the client (auto-stop + trim) and the server (WAV header check). */
export const MAX_CLIP_SECONDS = 5;
export const MIN_CLIP_SECONDS = 0.3;
/** Clips are resampled to mono 16-bit PCM at this rate: 5 s ≈ 220 KB. */
export const CLIP_SAMPLE_RATE = 22050;
export const MAX_UPLOAD_BYTES = 500 * 1024;

export const ROOM_CODE_LENGTH = 5;
/** No 0/O, 1/I/L so codes are readable on stream. */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_PATTERN = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);

export const roomChannel = (code: string) => `room-${code}`;
export const STATE_EVENT = "state";

export function normalizeRoomCode(input: string): string | null {
  const code = input.trim().toUpperCase();
  return ROOM_CODE_PATTERN.test(code) ? code : null;
}
