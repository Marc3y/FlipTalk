import "server-only";
import { Redis } from "@upstash/redis";
import { redisConfig } from "./env";

/**
 * The handful of Redis commands the app needs. Backed by Upstash in production and by an
 * in-process Map locally, so `npm run dev` works without any account.
 */
export interface KV {
  get(key: string): Promise<string | null>;
  /** Returns false when `nx` is set and the key already exists. */
  set(key: string, value: string, opts?: { ex?: number; px?: number; nx?: boolean }): Promise<boolean>;
  del(...keys: string[]): Promise<void>;
  expire(key: string, seconds: number): Promise<void>;
  sadd(key: string, member: string): Promise<number>;
  srem(key: string, member: string): Promise<number>;
  sismember(key: string, member: string): Promise<boolean>;
  scard(key: string): Promise<number>;
  spop(key: string): Promise<string | null>;
  hset(key: string, field: string, value: string): Promise<void>;
  hget(key: string, field: string): Promise<string | null>;
  hdel(key: string, field: string): Promise<void>;
  /** Atomically replaces `key` only if it still holds `expected`. */
  cas(key: string, expected: string, next: string, exSeconds: number): Promise<boolean>;
}

const CAS_SCRIPT = `if redis.call('GET', KEYS[1]) == ARGV[1] then
  redis.call('SET', KEYS[1], ARGV[2], 'EX', tonumber(ARGV[3]))
  return 1
end
return 0`;

class UpstashKV implements KV {
  constructor(private r: Redis) {}
  get(key: string) {
    return this.r.get<string>(key);
  }
  async set(key: string, value: string, opts: { ex?: number; px?: number; nx?: boolean } = {}) {
    const o: Record<string, unknown> = {};
    if (opts.ex) o.ex = opts.ex;
    if (opts.px) o.px = opts.px;
    if (opts.nx) o.nx = true;
    const res = await this.r.set(key, value, o as never);
    return res === "OK";
  }
  async del(...keys: string[]) {
    if (keys.length) await this.r.del(...keys);
  }
  async expire(key: string, seconds: number) {
    await this.r.expire(key, seconds);
  }
  sadd(key: string, member: string) {
    return this.r.sadd(key, member);
  }
  srem(key: string, member: string) {
    return this.r.srem(key, member);
  }
  async sismember(key: string, member: string) {
    return (await this.r.sismember(key, member)) === 1;
  }
  scard(key: string) {
    return this.r.scard(key);
  }
  async spop(key: string) {
    const res = await this.r.spop<string>(key);
    return (Array.isArray(res) ? res[0] : res) ?? null;
  }
  async hset(key: string, field: string, value: string) {
    await this.r.hset(key, { [field]: value });
  }
  hget(key: string, field: string) {
    return this.r.hget<string>(key, field);
  }
  async hdel(key: string, field: string) {
    await this.r.hdel(key, field);
  }
  async cas(key: string, expected: string, next: string, exSeconds: number) {
    return (await this.r.eval(CAS_SCRIPT, [key], [expected, next, String(exSeconds)])) === 1;
  }
}

type Entry = { value: string | Set<string> | Map<string, string>; expiresAt: number | null };

class MemoryKV implements KV {
  private data = new Map<string, Entry>();

  private entry(key: string) {
    const e = this.data.get(key);
    if (e?.expiresAt && e.expiresAt <= Date.now()) {
      this.data.delete(key);
      return undefined;
    }
    return e;
  }
  private setOf(key: string, create: true): Set<string>;
  private setOf(key: string, create?: false): Set<string> | undefined;
  private setOf(key: string, create = false) {
    const e = this.entry(key);
    if (e?.value instanceof Set) return e.value;
    if (!create) return undefined;
    const s = new Set<string>();
    this.data.set(key, { value: s, expiresAt: e?.expiresAt ?? null });
    return s;
  }
  private hashOf(key: string, create = false) {
    const e = this.entry(key);
    if (e?.value instanceof Map) return e.value;
    if (!create) return undefined;
    const m = new Map<string, string>();
    this.data.set(key, { value: m, expiresAt: e?.expiresAt ?? null });
    return m;
  }

  async get(key: string) {
    const v = this.entry(key)?.value;
    return typeof v === "string" ? v : null;
  }
  async set(key: string, value: string, opts: { ex?: number; px?: number; nx?: boolean } = {}) {
    if (opts.nx && this.entry(key)) return false;
    const ttl = opts.px ?? (opts.ex ? opts.ex * 1000 : null);
    this.data.set(key, { value, expiresAt: ttl ? Date.now() + ttl : null });
    return true;
  }
  async del(...keys: string[]) {
    keys.forEach((k) => this.data.delete(k));
  }
  async expire(key: string, seconds: number) {
    const e = this.entry(key);
    if (e) e.expiresAt = Date.now() + seconds * 1000;
  }
  async sadd(key: string, member: string) {
    const s = this.setOf(key, true);
    const had = s.has(member);
    s.add(member);
    return had ? 0 : 1;
  }
  async srem(key: string, member: string) {
    return this.setOf(key)?.delete(member) ? 1 : 0;
  }
  async sismember(key: string, member: string) {
    return this.setOf(key)?.has(member) ?? false;
  }
  async scard(key: string) {
    return this.setOf(key)?.size ?? 0;
  }
  async spop(key: string) {
    const s = this.setOf(key);
    if (!s?.size) return null;
    const members = [...s];
    const pick = members[Math.floor(Math.random() * members.length)];
    s.delete(pick);
    return pick;
  }
  async hset(key: string, field: string, value: string) {
    this.hashOf(key, true)!.set(field, value);
  }
  async hget(key: string, field: string) {
    return this.hashOf(key)?.get(field) ?? null;
  }
  async hdel(key: string, field: string) {
    this.hashOf(key)?.delete(field);
  }
  async cas(key: string, expected: string, next: string, exSeconds: number) {
    if ((await this.get(key)) !== expected) return false;
    return this.set(key, next, { ex: exSeconds });
  }
}

// Next dev compiles route handlers into separate module graphs, so the in-memory store
// has to live on globalThis for every route to see the same data.
const g = globalThis as typeof globalThis & { __fliptalkKV?: KV; __fliptalkRedis?: Redis };

export const redis: Redis | null = redisConfig
  ? (g.__fliptalkRedis ??= new Redis({ ...redisConfig, automaticDeserialization: false }))
  : null;

export const kv: KV = (g.__fliptalkKV ??= redis ? new UpstashKV(redis) : new MemoryKV());
