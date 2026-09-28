import { NextResponse } from "next/server";
import { MAX_UPLOAD_BYTES } from "@/lib/constants";
import { enforceLimit, handler, requireUser, roomCode, type CodeParams } from "@/lib/server/api";
import { RoomError, uploadClip } from "@/lib/server/rooms";

export const POST = handler(async (req, ctx: CodeParams) => {
  const code = await roomCode(ctx);
  const user = await requireUser();
  await enforceLimit("clip", req, user.id);

  // Reject oversized bodies before buffering them.
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_UPLOAD_BYTES) throw new RoomError(413, "err.tooLarge");

  const bytes = new Uint8Array(await req.arrayBuffer());
  const state = await uploadClip(code, user.id, bytes);
  return NextResponse.json(state, { status: 201 });
});
