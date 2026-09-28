import { NextResponse } from "next/server";
import { handler, roomCode, type CodeParams } from "@/lib/server/api";
import { getRoomState, RoomError } from "@/lib/server/rooms";

// Public, identical for every viewer: a 1 s CDN cache means a reconnect wave from
// 2,000 viewers collapses into roughly one function call per second.
export const GET = handler(async (_req, ctx: CodeParams) => {
  const state = await getRoomState(await roomCode(ctx));
  if (!state) throw new RoomError(404, "err.notFound");
  return NextResponse.json(state, {
    headers: { "Cache-Control": "public, max-age=0, s-maxage=1, stale-while-revalidate=2" },
  });
});
