import { NextResponse } from "next/server";
import { normalizeRoomCode } from "@/lib/constants";
import { handler, requireUser } from "@/lib/server/api";
import { isProd } from "@/lib/server/env";
import { getRoomState, RoomError, seedPlayers } from "@/lib/server/rooms";

// Development only: adds fake viewers so picking can be tested with a single browser.
export const POST = handler(async (req) => {
  if (isProd) return new NextResponse(null, { status: 404 });
  const user = await requireUser();
  const { code: raw, count = 10 } = ((await req.json().catch(() => ({}))) ?? {}) as { code?: string; count?: number };
  const code = normalizeRoomCode(raw ?? "");
  const room = code ? await getRoomState(code) : null;
  if (!code || !room || room.host.id !== user.id) throw new RoomError(403, "err.notYourRoom");
  await seedPlayers(code, Math.min(Math.max(1, count), 500));
  return NextResponse.json({ ok: true });
});
