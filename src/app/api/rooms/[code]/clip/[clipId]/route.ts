import { handler, requireUser, roomCode } from "@/lib/server/api";
import { getClip, RoomError } from "@/lib/server/rooms";

export const GET = handler(async (_req, ctx: { params: Promise<{ code: string; clipId: string }> }) => {
  const code = await roomCode(ctx);
  const { clipId } = await ctx.params;
  const user = await requireUser();
  const clip = await getClip(code, clipId, user.id);
  if (!clip) throw new RoomError(404, "err.clipNotFound");
  return new Response(clip as BodyInit, {
    headers: { "Content-Type": "audio/wav", "Cache-Control": "private, no-store" },
  });
});
