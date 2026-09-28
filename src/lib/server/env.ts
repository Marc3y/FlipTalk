import "server-only";

export const isProd = process.env.NODE_ENV === "production";

export const redisConfig = (() => {
  // Accept both the Upstash names and the ones the Vercel Marketplace integration injects.
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
})();

/**
 * Realtime fan-out via the Cloudflare worker in /party. Without it: SSE in development,
 * CDN-cached polling in production (fine for small streams).
 */
export const partyConfig = (() => {
  const host = process.env.NEXT_PUBLIC_PARTY_HOST;
  const secret = process.env.PARTY_SECRET;
  return host && secret ? { host, secret } : null;
})();

export const hasTwitch = Boolean(process.env.AUTH_TWITCH_ID && process.env.AUTH_TWITCH_SECRET);

/**
 * Mock login (pick any username) is never available in production builds.
 * Locally it turns on automatically when Twitch credentials are missing, or explicitly via AUTH_MOCK=true.
 */
export const isMockAuth = !isProd && (process.env.AUTH_MOCK === "true" || !hasTwitch);

const g = globalThis as typeof globalThis & { __fliptalkWarned?: boolean };
if (isProd && process.env.NEXT_PHASE !== "phase-production-build" && !g.__fliptalkWarned) {
  g.__fliptalkWarned = true;
  const missing = [
    !redisConfig && "Upstash Redis (state is per-instance only)",
    !partyConfig && "PartyServer (realtime falls back to polling)",
    !hasTwitch && "Twitch OAuth (nobody can sign in)",
  ].filter(Boolean);
  if (missing.length) console.warn(`[fliptalk] Production is missing: ${missing.join(", ")}`);
}
