import { NextResponse } from "next/server";
import { enforceLimit, handler, requireUser, roomCode, type CodeParams } from "@/lib/server/api";
import { joinRoom } from "@/lib/server/rooms";

export const POST = handler(async (req, ctx: CodeParams) => {
  const code = await roomCode(ctx);
  const user = await requireUser();
  await enforceLimit("join", req, user.id);
  await joinRoom(code, user);
  return NextResponse.json({ ok: true });
});
