import { realtimeMode, subscribeLocal } from "@/lib/server/realtime";

// Local stand-in for the PartyServer worker: Server-Sent Events from the in-process event bus.
// Only meaningful on a single long-lived server (`npm run dev` / `next start`), never on Vercel.
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ channel: string }> }) {
  if (realtimeMode !== "local") return new Response("Realtime is served by PartyServer", { status: 404 });
  const { channel } = await params;
  if (!/^room-[A-Z0-9]{3,10}$/.test(channel)) return new Response("Bad channel", { status: 400 });

  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };
      send(": connected\n\n");
      const unsubscribe = subscribeLocal(channel, (event, data) => send(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      const ping = setInterval(() => send(": ping\n\n"), 15000);
      cleanup = () => {
        clearInterval(ping);
        unsubscribe();
      };
      req.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {}
      });
    },
    cancel: () => cleanup(),
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
