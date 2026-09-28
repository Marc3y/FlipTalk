"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import { subscribeRoom } from "@/lib/realtime-client";
import type { MeState, RoomState } from "@/lib/types";

/**
 * Live room state: initial server snapshot + realtime pushes. Pushes can arrive out of order
 * (or a CDN-cached refetch can be stale), so anything with an older `version` is dropped.
 * `token` authorizes the realtime socket; `pollMs` is for the host only, to keep the lobby count
 * exact between throttled broadcasts.
 */
export function useRoomState(
  code: string,
  initial: RoomState | null,
  { token = null, pollMs }: { token?: string | null; pollMs?: number } = {},
) {
  const [state, setState] = useState<RoomState | null>(initial);
  const [notFound, setNotFound] = useState(!initial);

  const apply = useCallback((next: RoomState) => {
    setState((prev) => (!prev || next.version >= prev.version ? next : prev));
    setNotFound(false);
  }, []);

  const refresh = useCallback(async () => {
    try {
      apply(await api<RoomState>(`/api/rooms/${code}`));
    } catch {
      setNotFound(true);
    }
  }, [code, apply]);

  // A closed room never changes again, so drop the socket/polling instead of idling on it.
  const closed = state?.phase === "closed";
  useEffect(() => (closed ? undefined : subscribeRoom(code, token, apply, refresh)), [code, token, apply, refresh, closed]);

  useEffect(() => {
    if (!pollMs || closed) return;
    const id = setInterval(refresh, pollMs);
    return () => clearInterval(id);
  }, [pollMs, refresh, closed]);

  return { state, apply, refresh, notFound };
}

export function useMe(code: string, initial: MeState) {
  const [me, setMe] = useState(initial);
  const inflight = useRef<Promise<void> | null>(null);
  const refresh = useCallback(() => {
    inflight.current ??= api<MeState>(`/api/rooms/${code}/me`)
      .then(setMe)
      .catch(() => {})
      .finally(() => (inflight.current = null));
    return inflight.current;
  }, [code]);
  return { me, setMe, refresh };
}
