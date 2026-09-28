"use client";
import PartySocket from "partysocket";
import { roomChannel, STATE_EVENT } from "./constants";
import type { RoomState } from "./types";

const PARTY_HOST = process.env.NEXT_PUBLIC_PARTY_HOST;
const POLL_VISIBLE_MS = 2500;
const POLL_HIDDEN_MS = 6000;

/**
 * Keeps a room's state live, choosing the cheapest transport available:
 *
 * - **party**: WebSocket to the room's Cloudflare Durable Object. Free tier, thousands of sockets,
 *   and reconnects are answered by Cloudflare, not Vercel.
 * - **sse**: local dev only; the Next dev server streams from an in-process event bus.
 * - **poll**: production without the worker. Hits the CDN-cached state endpoint, so most
 *   requests never reach a function. Good for small streams.
 */
export function subscribeRoom(
  code: string,
  token: string | null,
  onState: (state: RoomState) => void,
  refresh: () => Promise<void>,
): () => void {
  if (PARTY_HOST && token) {
    const socket = new PartySocket({ host: PARTY_HOST, party: "room", room: code, query: { token } });
    const onMessage = (e: MessageEvent) => {
      try {
        onState(JSON.parse(e.data) as RoomState);
      } catch {}
    };
    socket.addEventListener("message", onMessage);
    return () => {
      socket.removeEventListener("message", onMessage);
      socket.close();
    };
  }

  if (process.env.NODE_ENV === "development") {
    const es = new EventSource(`/api/realtime/${roomChannel(code)}`);
    es.addEventListener(STATE_EVENT, (e) => onState(JSON.parse((e as MessageEvent).data) as RoomState));
    let opened = false;
    es.onopen = () => {
      if (opened) void refresh(); // EventSource reconnects on its own; resync after drops
      opened = true;
    };
    return () => es.close();
  }

  let timer: ReturnType<typeof setTimeout>;
  let stopped = false;
  const tick = async () => {
    await refresh();
    if (!stopped) timer = setTimeout(tick, document.hidden ? POLL_HIDDEN_MS : POLL_VISIBLE_MS);
  };
  const onVisible = () => {
    if (document.hidden) return;
    clearTimeout(timer);
    void tick();
  };
  timer = setTimeout(tick, POLL_VISIBLE_MS);
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    stopped = true;
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
