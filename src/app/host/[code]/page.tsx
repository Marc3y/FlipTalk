import { notFound, redirect } from "next/navigation";
import { HostView } from "@/components/host/HostView";
import { normalizeRoomCode } from "@/lib/constants";
import { currentUser } from "@/lib/server/api";
import { isProd } from "@/lib/server/env";
import { roomSocketToken } from "@/lib/server/realtime";
import { getRoomState } from "@/lib/server/rooms";

export const metadata = { title: "Host" };

export default async function HostRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const code = normalizeRoomCode((await params).code);
  if (!code) notFound();
  const user = await currentUser();
  if (!user) redirect("/host");
  const state = await getRoomState(code);
  if (!state) notFound();
  if (state.host.id !== user.id) redirect(`/play/${code}`);
  return <HostView initial={state} token={roomSocketToken(code)} devTools={!isProd} />;
}
