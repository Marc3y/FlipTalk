import { NextResponse } from "next/server";
import { enforceLimit, handler, requireUser, roomCode, type CodeParams } from "@/lib/server/api";
import { leaveRoom } from "@/lib/server/rooms";

export const POST = handler(async (req, ctx: CodeParams) => {
  const code = await roomCode(ctx);
  const user = await requireUser();
  await enforceLimit("leave", req, user.id);
  await leaveRoom(code, user.id);
  return NextResponse.json({ ok: true });
});
