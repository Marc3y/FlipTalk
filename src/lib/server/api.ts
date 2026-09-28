import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { normalizeRoomCode } from "@/lib/constants";
import { langFromCookieHeader, translate } from "@/lib/i18n/messages";
import type { PublicPlayer } from "@/lib/types";
import { rateLimit, type RateLimitKind } from "./ratelimit";
import { RoomError } from "./rooms";

export type CodeParams = { params: Promise<{ code: string }> };

export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

export async function currentUser(): Promise<PublicPlayer | null> {
  const session = await auth();
  const u = session?.user;
  return u?.id ? { id: u.id, name: u.name ?? "Viewer", image: u.image ?? null } : null;
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new RoomError(401, "err.signIn");
  return user;
}

export async function roomCode({ params }: CodeParams) {
  const code = normalizeRoomCode((await params).code);
  if (!code) throw new RoomError(404, "err.invalidCode");
  return code;
}

export async function enforceLimit(kind: RateLimitKind, req: Request, userId?: string) {
  const retryAfter = await rateLimit(kind, { ip: clientIp(req), user: userId });
  if (retryAfter) throw new RoomError(429, "err.slowDown", { s: retryAfter });
}

/**
 * Turns thrown RoomErrors into JSON responses so handlers read top-to-bottom.
 * `error` is translated for display; `code` is the stable key clients can branch on.
 */
export function handler<C>(fn: (req: Request, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      const lang = langFromCookieHeader(req.headers.get("cookie"));
      if (err instanceof RoomError) {
        return NextResponse.json({ error: translate(lang, err.key, err.params), code: err.key }, { status: err.status });
      }
      console.error(err);
      return NextResponse.json({ error: translate(lang, "err.generic"), code: "err.generic" }, { status: 500 });
    }
  };
}
