import { NextResponse } from "next/server";
import { enforceLimit, handler, requireUser, roomCode, type CodeParams } from "@/lib/server/api";
import { closeRoom, finishRound, pickPlayer, revealRound, RoomError, skipPlayer } from "@/lib/server/rooms";

type Body =
  | { action: "pick" | "skip" | "ban" | "reveal" | "close" }
  | { action: "finish"; verdict: "nailed" | "failed" };

export const POST = handler(async (req, ctx: CodeParams) => {
  const code = await roomCode(ctx);
  const user = await requireUser();
  await enforceLimit("host", req, user.id);
  const body = (await req.json().catch(() => null)) as Body | null;

  switch (body?.action) {
    case "pick":
      return NextResponse.json(await pickPlayer(code, user.id));
    case "skip":
    case "ban":
      return NextResponse.json(await skipPlayer(code, user.id, body.action === "ban"));
    case "reveal":
      return NextResponse.json(await revealRound(code, user.id));
    case "finish":
      if (body.verdict !== "nailed" && body.verdict !== "failed") throw new RoomError(400, "err.invalidVerdict");
      return NextResponse.json(await finishRound(code, user.id, body.verdict));
    case "close":
      return NextResponse.json(await closeRoom(code, user.id));
    default:
      throw new RoomError(400, "err.unknownAction");
  }
});
