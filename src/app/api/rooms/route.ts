import { NextResponse } from "next/server";
import { enforceLimit, handler, requireUser } from "@/lib/server/api";
import { clampMaxPlayers } from "@/lib/constants";
import { createRoom } from "@/lib/server/rooms";

export const POST = handler(async (req) => {
  const user = await requireUser();
  await enforceLimit("createRoom", req, user.id);
  const body = (await req.json().catch(() => null)) as { maxPlayers?: unknown } | null;
  return NextResponse.json(await createRoom(user, clampMaxPlayers(body?.maxPlayers)), { status: 201 });
});
