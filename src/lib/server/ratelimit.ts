import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "./kv";

const RULES = {
  createRoom: { user: [5, 600], ip: [20, 600] },
  // IP limits stay loose: whole campuses and mobile carriers share addresses.
  join: { user: [10, 60], ip: [120, 60] },
  leave: { user: [20, 60], ip: [120, 60] },
  clip: { user: [6, 60], ip: [30, 60] },
  host: { user: [120, 60], ip: [240, 60] },
} as const satisfies Record<string, Record<"user" | "ip", readonly [limit: number, windowSec: number]>>;

export type RateLimitKind = keyof typeof RULES;

const upstash = new Map<string, Ratelimit>();
function upstashLimiter(name: string, limit: number, windowSec: number) {
  let rl = upstash.get(name);
  if (!rl) {
    rl = new Ratelimit({
      redis: redis!,
      limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
      prefix: `rl:${name}`,
      // Blocked identifiers are remembered in-process, so a hammering bot stops costing Redis calls.
      ephemeralCache: new Map(),
    });
    upstash.set(name, rl);
  }
  return rl;
}

const g = globalThis as typeof globalThis & { __fliptalkRl?: Map<string, { count: number; resetAt: number }> };
const memory = (g.__fliptalkRl ??= new Map());

function memoryLimit(key: string, limit: number, windowSec: number) {
  const now = Date.now();
  const e = memory.get(key);
  if (!e || e.resetAt <= now) {
    memory.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return { success: true, reset: now + windowSec * 1000 };
  }
  e.count++;
  return { success: e.count <= limit, reset: e.resetAt };
}

/** Checks the per-user and per-IP buckets. Returns seconds to wait, or 0 if allowed. */
export async function rateLimit(kind: RateLimitKind, ids: { user?: string; ip: string }): Promise<number> {
  const rule = RULES[kind];
  const checks: Array<[string, string, readonly [number, number]]> = [[`${kind}:ip`, ids.ip, rule.ip]];
  if (ids.user) checks.push([`${kind}:user`, ids.user, rule.user]);

  const results = await Promise.all(
    checks.map(([name, id, [limit, windowSec]]) =>
      redis ? upstashLimiter(name, limit, windowSec).limit(id) : memoryLimit(`${name}:${id}`, limit, windowSec),
    ),
  );
  const blocked = results.filter((r) => !r.success);
  if (!blocked.length) return 0;
  return Math.max(1, Math.ceil((Math.max(...blocked.map((r) => r.reset)) - Date.now()) / 1000));
}
