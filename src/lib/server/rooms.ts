import "server-only";
import {
  CLIP_SAMPLE_RATE,
  MAX_CLIP_SECONDS,
  MAX_UPLOAD_BYTES,
  MIN_CLIP_SECONDS,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
} from "@/lib/constants";
import type { MeState, PublicPlayer, RoomState, Verdict } from "@/lib/types";
import type { MessageKey, MessageParams } from "@/lib/i18n/messages";
import { parseWav } from "@/lib/wav";
import { kv } from "./kv";
import { publishRoomState } from "./realtime";

const ROOM_TTL = 60 * 60 * 12;
const CLIP_TTL = 60 * 15;
/** At most one lobby-count broadcast per window, however fast people join. */
const COUNT_BROADCAST_MS = 2000;

type StoredRoom = Omit<RoomState, "playerCount">;

const keys = {
  room: (c: string) => `room:${c}`,
  pool: (c: string) => `room:${c}:pool`,
  profiles: (c: string) => `room:${c}:profiles`,
  banned: (c: string) => `room:${c}:banned`,
  countLock: (c: string) => `room:${c}:countlock`,
  clip: (c: string, id: string) => `clip:${c}:${id}`,
};

/** API error carrying a translation key; the route handler renders it in the caller's language. */
export class RoomError extends Error {
  constructor(
    public status: number,
    public key: MessageKey,
    public params?: MessageParams,
  ) {
    super(key);
  }
}

function randomId(length: number, alphabet: string) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

async function readRoom(code: string): Promise<{ raw: string; room: StoredRoom } | null> {
  const raw = await kv.get(keys.room(code));
  return raw ? { raw, room: JSON.parse(raw) as StoredRoom } : null;
}

async function withCount(room: StoredRoom): Promise<RoomState> {
  return { ...room, playerCount: await kv.scard(keys.pool(room.code)) };
}

async function broadcast(room: StoredRoom) {
  const state = await withCount(room);
  await publishRoomState(state);
  return state;
}

/**
 * Optimistic read-modify-write: `fn` returns the next room (or throws); if someone else wrote
 * in between, we re-read and try again. Keeps host clicks and clip uploads from clobbering each other.
 */
async function mutateRoom(code: string, fn: (room: StoredRoom) => StoredRoom): Promise<RoomState> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const current = await readRoom(code);
    if (!current || current.room.phase === "closed") throw new RoomError(404, "err.notFound");
    const next = { ...fn(structuredClone(current.room)), version: current.room.version + 1, updatedAt: Date.now() };
    if (await kv.cas(keys.room(code), current.raw, JSON.stringify(next), ROOM_TTL)) return broadcast(next);
  }
  throw new RoomError(409, "err.busy");
}

async function requireHost(code: string, userId: string) {
  const current = await readRoom(code);
  if (!current || current.room.phase === "closed") throw new RoomError(404, "err.notFound");
  if (current.room.host.id !== userId) throw new RoomError(403, "err.hostOnly");
  return current.room;
}

export async function createRoom(host: PublicPlayer): Promise<RoomState> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomId(ROOM_CODE_LENGTH, ROOM_CODE_ALPHABET);
    const room: StoredRoom = {
      code,
      host,
      phase: "lobby",
      version: 1,
      round: 0,
      picked: null,
      pickedAt: null,
      clipId: null,
      lastResult: null,
      updatedAt: Date.now(),
    };
    if (await kv.set(keys.room(code), JSON.stringify(room), { ex: ROOM_TTL, nx: true })) {
      return { ...room, playerCount: 0 };
    }
  }
  throw new RoomError(503, "err.codeAlloc");
}

export async function getRoomState(code: string): Promise<RoomState | null> {
  const current = await readRoom(code);
  return current ? withCount(current.room) : null;
}

export async function getMe(code: string, user: PublicPlayer | null): Promise<MeState> {
  const current = await readRoom(code);
  if (!user || !current) return { user, isHost: false, joined: false, banned: false };
  const [joined, banned] = await Promise.all([
    kv.sismember(keys.pool(code), user.id),
    kv.sismember(keys.banned(code), user.id),
  ]);
  return { user, isHost: current.room.host.id === user.id, joined, banned };
}

/** Joins/leaves change only the count, so they never rewrite the room, and broadcasts are throttled. */
async function broadcastCountThrottled(code: string) {
  if (!(await kv.set(keys.countLock(code), "1", { px: COUNT_BROADCAST_MS, nx: true }))) return;
  const current = await readRoom(code);
  if (current) await broadcast(current.room);
}

export async function joinRoom(code: string, user: PublicPlayer) {
  const current = await readRoom(code);
  if (!current || current.room.phase === "closed") throw new RoomError(404, "err.notFound");
  if (current.room.host.id === user.id) throw new RoomError(400, "err.youHost");
  if (await kv.sismember(keys.banned(code), user.id)) throw new RoomError(403, "err.banned");

  await kv.hset(keys.profiles(code), user.id, JSON.stringify(user));
  const added = await kv.sadd(keys.pool(code), user.id);
  await Promise.all([kv.expire(keys.pool(code), ROOM_TTL), kv.expire(keys.profiles(code), ROOM_TTL)]);
  if (added) await broadcastCountThrottled(code);
}

export async function leaveRoom(code: string, userId: string) {
  if (await kv.srem(keys.pool(code), userId)) await broadcastCountThrottled(code);
}

export async function pickPlayer(code: string, hostId: string) {
  const room = await requireHost(code, hostId);
  if (room.phase !== "lobby") throw new RoomError(409, "err.finishRound");

  // SPOP is atomic, so double clicks can never pick the same viewer twice.
  const id = await kv.spop(keys.pool(code));
  if (!id) throw new RoomError(409, "err.emptyLobby");
  const profile = await kv.hget(keys.profiles(code), id);
  const player: PublicPlayer = profile ? JSON.parse(profile) : { id, name: "Viewer", image: null };

  try {
    return await mutateRoom(code, (r) => {
      if (r.phase !== "lobby") throw new RoomError(409, "err.finishRound");
      return { ...r, phase: "recording", round: r.round + 1, picked: player, pickedAt: Date.now(), clipId: null };
    });
  } catch (err) {
    await kv.sadd(keys.pool(code), id); // put them back, they never got their turn
    throw err;
  }
}

export async function skipPlayer(code: string, hostId: string, ban: boolean) {
  const room = await requireHost(code, hostId);
  if (ban && room.picked) {
    await Promise.all([kv.sadd(keys.banned(code), room.picked.id), kv.srem(keys.pool(code), room.picked.id)]);
    await kv.expire(keys.banned(code), ROOM_TTL);
  }
  if (room.clipId) await kv.del(keys.clip(code, room.clipId));
  return mutateRoom(code, (r) => ({ ...r, phase: "lobby", picked: null, pickedAt: null, clipId: null }));
}

export async function revealRound(code: string, hostId: string) {
  await requireHost(code, hostId);
  return mutateRoom(code, (r) => {
    if (r.phase !== "guessing") throw new RoomError(409, "err.nothingToReveal");
    return { ...r, phase: "reveal" };
  });
}

export async function finishRound(code: string, hostId: string, verdict: Verdict) {
  const room = await requireHost(code, hostId);
  if (room.clipId) await kv.del(keys.clip(code, room.clipId));
  return mutateRoom(code, (r) => {
    if (!r.picked || (r.phase !== "reveal" && r.phase !== "guessing")) throw new RoomError(409, "err.noRound");
    return {
      ...r,
      phase: "lobby",
      lastResult: { player: r.picked, verdict, round: r.round },
      picked: null,
      pickedAt: null,
      clipId: null,
    };
  });
}

export async function closeRoom(code: string, hostId: string) {
  await requireHost(code, hostId);
  const state = await mutateRoom(code, (r) => ({ ...r, phase: "closed", picked: null, clipId: null }));
  await kv.del(keys.pool(code), keys.profiles(code));
  return state;
}

export async function uploadClip(code: string, userId: string, bytes: Uint8Array) {
  if (bytes.byteLength > MAX_UPLOAD_BYTES) throw new RoomError(413, "err.tooLarge");
  const wav = parseWav(bytes);
  if (!wav || wav.bitsPerSample !== 16 || wav.channels !== 1 || wav.sampleRate > 48000 || wav.sampleRate < 8000) {
    throw new RoomError(415, "err.badWav", { rate: CLIP_SAMPLE_RATE });
  }
  // Small epsilon for float rounding; anything meaningfully over the cap is rejected.
  if (wav.duration > MAX_CLIP_SECONDS + 0.01) throw new RoomError(422, "err.tooLong", { s: MAX_CLIP_SECONDS });
  if (wav.duration < MIN_CLIP_SECONDS) throw new RoomError(422, "err.tooShort");

  const current = await readRoom(code);
  if (!current || current.room.phase !== "recording" || current.room.picked?.id !== userId) {
    throw new RoomError(409, "err.notYourTurn");
  }
  const round = current.room.round;
  const clipId = randomId(12, "abcdefghijklmnopqrstuvwxyz0123456789");
  await kv.set(keys.clip(code, clipId), Buffer.from(bytes).toString("base64"), { ex: CLIP_TTL });

  try {
    return await mutateRoom(code, (r) => {
      // Re-check: the host may have skipped this player while the upload was in flight.
      if (r.phase !== "recording" || r.picked?.id !== userId || r.round !== round) {
        throw new RoomError(409, "err.skipped");
      }
      return { ...r, phase: "guessing", clipId };
    });
  } catch (err) {
    await kv.del(keys.clip(code, clipId));
    throw err;
  }
}

/** Only the host and the viewer who recorded it may download a clip. */
export async function getClip(code: string, clipId: string, userId: string): Promise<Uint8Array | null> {
  const current = await readRoom(code);
  if (!current) return null;
  const { room } = current;
  if (room.clipId !== clipId || (room.host.id !== userId && room.picked?.id !== userId)) return null;
  const data = await kv.get(keys.clip(code, clipId));
  return data ? new Uint8Array(Buffer.from(data, "base64")) : null;
}

/** Dev helper: fills the lobby with fake viewers to test counts and picking. */
export async function seedPlayers(code: string, count: number) {
  for (let i = 0; i < count; i++) {
    const id = `bot:${randomId(6, "abcdefghijklmnopqrstuvwxyz0123456789")}`;
    await kv.hset(keys.profiles(code), id, JSON.stringify({ id, name: `bot_${id.slice(4)}`, image: null }));
    await kv.sadd(keys.pool(code), id);
  }
  const current = await readRoom(code);
  if (current) await broadcast(current.room);
}
