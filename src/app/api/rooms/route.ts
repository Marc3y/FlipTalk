import { NextResponse } from "next/server";
import { enforceLimit, handler, requireUser } from "@/lib/server/api";
import { createRoom } from "@/lib/server/rooms";

export const POST = handler(async (req) => {
  const user = await requireUser();
  await enforceLimit("createRoom", req, user.id);
  return NextResponse.json(await createRoom(user), { status: 201 });
});
