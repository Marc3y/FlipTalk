import { NextResponse } from "next/server";
import { currentUser, handler, roomCode, type CodeParams } from "@/lib/server/api";
import { getMe } from "@/lib/server/rooms";

export const GET = handler(async (_req, ctx: CodeParams) => {
  const me = await getMe(await roomCode(ctx), await currentUser());
  return NextResponse.json(me, { headers: { "Cache-Control": "private, no-store" } });
});
