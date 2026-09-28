import "server-only";
import { createHmac } from "node:crypto";
import { roomChannel, STATE_EVENT } from "@/lib/constants";
import type { RoomState } from "@/lib/types";
import { partyConfig } from "./env";

type Listener = (event: string, data: unknown) => void;

const g = globalThis as typeof globalThis & { __fliptalkBus?: Map<string, Set<Listener>> };
const bus = (g.__fliptalkBus ??= new Map<string, Set<Listener>>());

export const realtimeMode = partyConfig ? "party" : "local";

const TOKEN_TTL_MS = 48 * 60 * 60 * 1000;

function partyUrl(code: string) {
  const { host } = partyConfig!;
  const local = host.startsWith("localhost:") || host.startsWith("127.0.0.1:");
  return `${local ? "http" : "https"}://${host}/parties/room/${code}`;
}

/**
 * Serverless functions only *trigger* a broadcast: one POST to the room's Durable Object,
 * which pushes it to every connected viewer. The cost is the same for 5 viewers or 5,000.
 */
export async function publishRoomState(state: RoomState) {
  if (!partyConfig) {
    bus.get(roomChannel(state.code))?.forEach((fn) => fn(STATE_EVENT, state));
    return;
  }
  const body = JSON.stringify(state);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(partyUrl(state.code), {
        method: "POST",
        headers: { Authorization: `Bearer ${partyConfig.secret}`, "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) return;
      console.error(`[fliptalk] party publish failed: ${res.status}`);
    } catch (err) {
      console.error("[fliptalk] party publish failed", err);
    }
  }
  // State is already saved in Redis; clients resync on their next reconnect or page load.
}

/** Short-lived signed ticket that lets a browser open a socket to one room. Null when not using PartyServer. */
export function roomSocketToken(code: string): string | null {
  if (!partyConfig) return null;
  const exp = Date.now() + TOKEN_TTL_MS;
  const sig = createHmac("sha256", partyConfig.secret).update(`${code}:${exp}`).digest("base64url");
  return `${exp}.${sig}`;
}

/** Local-mode only: used by the SSE route during `npm run dev`. */
export function subscribeLocal(channel: string, fn: Listener) {
  let set = bus.get(channel);
  if (!set) bus.set(channel, (set = new Set()));
  set.add(fn);
  return () => {
    set.delete(fn);
    if (!set.size) bus.delete(channel);
  };
}
