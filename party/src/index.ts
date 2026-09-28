import { routePartykitRequest, Server, type Connection } from "partyserver";

declare global {
  namespace Cloudflare {
    interface Env {
      Room: DurableObjectNamespace<Room>;
      /** Shared with the Next.js app: signs viewer tokens and authorizes state pushes. */
      PARTY_SECRET: string;
    }
  }
}
type Env = Cloudflare.Env;

const ROOM_NAME = /^[A-Z2-9]{5}$/;
/** Forget a room's state after this long without updates. */
const IDLE_TTL_MS = 13 * 60 * 60 * 1000;

/**
 * Pure fan-out relay. The Next.js API (the source of truth, backed by Redis) POSTs every new room
 * state here; this object stores the latest one and pushes it to every connected viewer.
 *
 * Hibernation means idle sockets cost nothing: the object only wakes up to broadcast or accept a
 * connection. Viewers never send messages, so there is no per-viewer inbound traffic either.
 */
export class Room extends Server<Env> {
  static options = { hibernate: true };

  async onConnect(connection: Connection) {
    // Late joiners and reconnects get the current state straight away, without hitting Vercel.
    const state = await this.ctx.storage.get<string>("state");
    if (state) connection.send(state);
  }

  onMessage() {
    // Viewers are read-only. Everything they do goes through the authenticated Next.js API.
  }

  async onRequest(request: Request) {
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
    const body = await request.text();
    let next: { version?: unknown; phase?: unknown };
    try {
      next = JSON.parse(body);
    } catch {
      return new Response("Bad JSON", { status: 400 });
    }
    if (typeof next.version !== "number") return new Response("Missing version", { status: 400 });

    // Requests can arrive out of order; never replace newer state with older.
    // Equal versions are accepted: those carry fresh lobby counts.
    const current = await this.ctx.storage.get<number>("version");
    if (current !== undefined && next.version < current) return new Response(null, { status: 204 });

    await this.ctx.storage.put({ state: body, version: next.version });
    this.broadcast(body);

    if (next.phase === "closed") {
      // Clients disconnect themselves on "closed". Closing from here would make every
      // auto-reconnecting client dial straight back in.
      await this.ctx.storage.deleteAll();
    } else {
      await this.ctx.storage.setAlarm(Date.now() + IDLE_TTL_MS);
    }
    return new Response(null, { status: 204 });
  }

  async onAlarm() {
    // Leftover sockets are hibernated and cost nothing; just drop the stored state.
    await this.ctx.storage.deleteAll();
  }
}

const encoder = new TextEncoder();

async function hmacKey(secret: string) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
}

function fromBase64Url(s: string) {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** Token format `<expiresAtMs>.<base64url HMAC-SHA256("<room>:<expiresAtMs>")>`, issued by the Next.js app. */
async function verifyToken(secret: string, room: string, token: string | null) {
  const [exp, sig] = token?.split(".") ?? [];
  if (!exp || !sig || !(Number(exp) > Date.now())) return false;
  try {
    return await crypto.subtle.verify("HMAC", await hmacKey(secret), fromBase64Url(sig), encoder.encode(`${room}:${exp}`));
  } catch {
    return false;
  }
}

function sameSecret(a: string, b: string) {
  const x = encoder.encode(a);
  const y = encoder.encode(b);
  return x.byteLength === y.byteLength && crypto.subtle.timingSafeEqual(x, y);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!env.PARTY_SECRET) return new Response("PARTY_SECRET is not configured", { status: 500 });
    const response = await routePartykitRequest(request, env, {
      onBeforeConnect: async (req, lobby) => {
        const token = new URL(req.url).searchParams.get("token");
        if (!ROOM_NAME.test(lobby.name) || !(await verifyToken(env.PARTY_SECRET, lobby.name, token))) {
          return new Response("Unauthorized", { status: 401 });
        }
      },
      onBeforeRequest: (req, lobby) => {
        const auth = req.headers.get("authorization") ?? "";
        if (!ROOM_NAME.test(lobby.name) || !sameSecret(auth, `Bearer ${env.PARTY_SECRET}`)) {
          return new Response("Unauthorized", { status: 401 });
        }
      },
    });
    return response ?? new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
