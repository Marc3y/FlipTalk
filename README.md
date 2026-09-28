# FlipTalk: Reverse Voice Challenge

A live game for Twitch streamers and their chat. A random viewer records up to 5 seconds of audio, the streamer hears it **backwards**, imitates it, and the app flips the streamer's attempt back so everyone can compare it with the original.

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Framer Motion · Lucide · Auth.js v5 (Twitch) · Upstash Redis · PartyServer on Cloudflare Durable Objects · Web Audio API

No paid realtime provider: 2,000+ viewers per lobby run on the free tiers of Cloudflare Workers, Upstash and Vercel (see [Costs](#costs-for-a-2000-viewer-stream)).

---

## Run it locally (no accounts needed)

```bash
npm install
cp .env.example .env.local   # optional, every value may stay empty
npm run dev
```

Open http://localhost:3000. With no keys configured, the app switches to local fallbacks on its own:

| Concern | Production | Local fallback (automatic) |
|---|---|---|
| Login | Twitch OAuth | **Mock login**: type any username |
| Room state + rate limits | Upstash Redis | In-memory store (`globalThis`) |
| Realtime | WebSockets to a Cloudflare Durable Object ([`party/`](party/)) | Server-Sent Events from an in-process event bus |

**Playing a full round on one machine**

1. Normal window → **Host a room** → sign in as `streamer` → **Create room**.
2. Private/incognito window (separate cookies) → `/play` → enter the code → sign in as `viewer1` → **Join lobby**.
3. Host clicks **Pick player** → the viewer window records → **Send to stream**.
4. The viewer hears a chime (and the phone vibrates) when picked, records, and taps **Send to stream**.
5. The host goes through four steps (**Listen reversed** → **Imitate** → **Flip back** → **Compare**), then **Nailed it / Failed**. Nothing advances on its own: each step's big button can be used as often as you like (listen again, re-record, replay the flip-back), and **Next** moves on once the step has been done at least once. **Back** and the step tabs jump back without losing progress.

The host page has a **Dev tools** panel (development only) that adds 25 fake viewers to test lobby counts and picking. Bots can't record, so skip them when picked.

**Testing on a phone:** microphones need HTTPS on anything except `localhost`. Run `npm run dev:https` and open `https://<your-LAN-IP>:3000`.

**Testing the real realtime worker locally** (optional, runs Cloudflare's `workerd` on your machine, no account needed):

```bash
npm run party:install
cp party/.dev.vars.example party/.dev.vars
npm run party:dev                      # ws://localhost:1999
# in .env.local:
#   NEXT_PUBLIC_PARTY_HOST=localhost:1999
#   PARTY_SECRET=local-party-secret
npm run dev
```

You can mix and match: set only the Twitch keys to test real OAuth locally, or only the party keys to test realtime. `AUTH_MOCK=true` forces mock login even when Twitch keys are present.

---

## Deploy

### 1. Realtime worker → Cloudflare (free, once)

```bash
npm run party:install
cd party
npx wrangler login
npx wrangler deploy                 # prints https://fliptalk-party.<you>.workers.dev
npx wrangler secret put PARTY_SECRET   # paste a long random string, e.g. from: openssl rand -base64 32
```

The Workers **Free** plan is enough; SQLite-backed Durable Objects are available on it. Redeploy with `npm run party:deploy` only when [`party/src/index.ts`](party/src/index.ts) changes.

### 2. App → Vercel

1. Push the repo and import it in Vercel. The framework preset is detected; no build settings needed.
2. Add the environment variables from [`.env.example`](.env.example) under **Settings → Environment Variables**:
   - `AUTH_SECRET`: generate with `npx auth secret`
   - `AUTH_TWITCH_ID`, `AUTH_TWITCH_SECRET`: from https://dev.twitch.tv/console/apps. Add `https://<your-domain>/api/auth/callback/twitch` as an OAuth redirect URL.
   - `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`. The Vercel Marketplace Upstash integration's `KV_REST_API_URL` / `KV_REST_API_TOKEN` also work.
   - `NEXT_PUBLIC_PARTY_HOST` (the worker host without `https://`, e.g. `fliptalk-party.you.workers.dev`) and `PARTY_SECRET` (the same value as on Cloudflare)
3. Deploy. `NEXT_PUBLIC_*` values are inlined at build time, so **redeploy** after changing them.

No code changes are needed. In production, the mock provider is never registered and the mock sign-in action refuses to run, so Twitch is the only way in. If Redis is missing in production, the server logs a warning: the in-memory store only works on a single long-lived server, not across serverless instances. Without the party keys, production falls back to polling a CDN-cached endpoint every 2.5 s. That works, but only makes sense for small streams, because every poll counts as a Vercel edge request.

**OBS setup:** capture the host page (window capture) and route the browser's audio to the stream. For a lighter layout, add **OBS overlay URL** (copy button on the host page, `/overlay/<CODE>`) as a Browser Source. Its background is transparent.

---

## How it scales to 2,000+ viewers per lobby

```
 viewers (2,000+ phones)          streamer / OBS
   │  ▲ WebSocket (read-only)        │ HTTPS: pick, skip, reveal…
   │  │                              ▼
   │  └──── Cloudflare Durable Object ◀── POST new state ── Vercel functions ── Upstash Redis
   │         one per room, hibernating       (1 request per change)   (source of truth)
   └── HTTPS: join / leave / upload clip ──────────────▶ Vercel functions
```

- **Vercel never holds a connection.** Functions change state in Redis and send **one** POST to the room's Durable Object. The object pushes it to every socket. A broadcast costs the same for 5 or 5,000 viewers.
- **Hibernating sockets.** Viewers never send messages; they only listen. While nothing happens, the Durable Object is evicted from memory and the sockets stay open for free. It wakes up only to accept a connection or broadcast.
- **Reconnects never touch Vercel.** The object stores the latest state and sends it to every new or reconnecting socket straight away. A Wi-Fi blip affecting 2,000 phones costs 2,000 cheap Cloudflare requests and zero Vercel functions or Redis reads.
- **Tokens instead of open sockets.** A room page embeds a signed token (HMAC with `PARTY_SECRET`, valid 48 h) that is only good for that room. Without it, nobody can open sockets or spin up objects for arbitrary room names. State pushes need the secret as a bearer token.
- **Small, full-state messages with a `version`.** Out-of-order or duplicate messages are harmless: the worker and every client keep the newest one. The player list is never broadcast, only the count.
- **Throttled lobby count.** Joins never rewrite the room record, and at most one count broadcast goes out per 2 s. The host page polls every 5 s so its count stays exact.
- **Atomic picks and races.** `SPOP` picks (no double picks on double-click); compare-and-set room updates (Lua) mean a Skip can't be overwritten by an in-flight upload.
- **Audio stays off the socket.** The clip (≤ 220 KB WAV) is uploaded once to Redis with a 15-minute TTL, and only the host and its author can download it. Viewers hear it on the stream.

**Measured locally** (Cloudflare's `workerd` via `wrangler dev`, one machine): 2,000 WebSocket clients connected, and each got the current state on connect. A state push reached all 2,000 in **42–86 ms**. Stale versions were not re-broadcast. This proves the fan-out logic, not Cloudflare's network; a Durable Object supports up to 32,768 hibernatable WebSockets.

### Costs for a 2,000-viewer stream

Rough numbers for one 3-hour stream with 2,000 viewers and about 30 rounds. **Check the providers' current free-tier limits**, since they change.

| | Usage | Free tier |
|---|---|---|
| Cloudflare Workers + Durable Objects | ≈ 2,000 connects + reconnects (say 3× → 6,000) + ~200 state pushes ≈ **6–10k requests**; duration only while awake | 100,000 requests/day; idle hibernated sockets aren't billed; outgoing WebSocket messages aren't billed |
| Vercel functions | ≈ 2–4 per viewer (page load, join, leave) ≈ **4–8k** | Hobby: 1M invocations/month |
| Upstash Redis | ≈ 10 commands per viewer ≈ **20–30k** | 500k commands/month |

Notes: Vercel's Hobby plan is for non-commercial use, so a monetized channel may need Pro under Vercel's terms. The polling fallback (no worker configured) would instead cost about 2,000 × 1 request / 2.5 s ≈ 2.9M edge requests per hour. That's why the worker is the recommended setup.

---

## Languages

German is the default, English is available. The small **DE | EN** toggle (landing page and host header, bottom of the viewer page) stores the choice in a `lang` cookie, so pages are rendered on the server in the right language without a flash. API error messages follow the same cookie and also return a stable `code` (e.g. `err.banned`) that the client branches on. The OBS overlay can't see the streamer's cookies, so the host's **OBS overlay URL** button appends `?lang=de|en`.

All texts live in [`src/lib/i18n/messages.ts`](src/lib/i18n/messages.ts). The English dictionary is typed against the German one, so a missing key fails the typecheck.

## Security and abuse protection

- **Twitch-only login** in production. Identity is the Twitch user id (`account.providerAccountId`), not the display name.
- **Rate limits** per Twitch user *and* per IP (Upstash sliding window, in-memory fixed window locally), in [`src/lib/server/ratelimit.ts`](src/lib/server/ratelimit.ts). IP limits are deliberately loose because campuses and mobile carriers share addresses. Blocked identifiers are cached in-process so a hammering bot stops costing Redis calls.
- **5-second cap enforced twice.** The client auto-stops at 5 s and hard-trims when encoding. The server parses the WAV header and computes the duration from the *actual* byte count, so a forged header can't hide extra audio. Bodies over 500 KB are rejected before buffering.
- **Only the picked viewer** can upload, only during their turn, and a skipped player's in-flight upload is discarded.
- **Realtime is read-only for viewers.** The worker ignores anything viewers send; every action goes through the authenticated, rate-limited Next.js API.
- **Panic: drop & ban** (host) silences playback instantly on the client, deletes the clip, removes the viewer from the lobby and bans them from rejoining the room. **Skip** does the same without the ban.

---

## Project layout

```
src/
├─ auth.ts                         Auth.js: Twitch provider + local mock provider
├─ app/
│  ├─ page.tsx                     Landing
│  ├─ host/ , host/[code]/         Create room · streamer view
│  ├─ play/ , play/[code]/         Enter code · viewer (mobile) view
│  ├─ overlay/[code]/              Transparent OBS browser source
│  ├─ actions.ts                   Sign-in / sign-out server actions
│  └─ api/
│     ├─ auth/[...nextauth]/
│     ├─ rooms/                    POST create
│     ├─ rooms/[code]/             GET state (CDN-cached) · me · join · leave · host · clip
│     ├─ realtime/[channel]/       Local SSE fallback for `npm run dev` (404 when the worker is set)
│     └─ dev/seed/                 Dev-only fake viewers
├─ hooks/
│  ├─ useAudioRecorder.ts          Mic → MediaRecorder → trimmed mono AudioBuffer (+ live analyser)
│  ├─ useReverseAudio.ts           Memoized buffer reversal
│  ├─ useAudioPlayback.ts          Single-voice playback, sequences, analyser
│  └─ useRoom.ts                   useRoomState (realtime + versioning) · useMe
├─ lib/
│  ├─ audio.ts                     Web Audio helpers: decode, reverse, resample/trim/normalize, WAV
│  ├─ wav.ts                       WAV encode (client) / parse (server validation)
│  ├─ realtime-client.ts           PartySocket · EventSource (dev) · CDN polling, same API
│  ├─ sounds.ts                    Synthesized chimes (picked viewer, clip arrived)
│  ├─ i18n/                        messages.ts (DE/EN texts) · server.ts (cookie) · client.tsx (provider, useI18n)
│  ├─ constants.ts · types.ts      Shared limits and state types
│  └─ server/
│     ├─ env.ts                    Feature detection from env vars
│     ├─ kv.ts                     Upstash Redis or in-memory store, same interface
│     ├─ realtime.ts               publishRoomState() to the worker or the local bus · socket tokens
│     ├─ ratelimit.ts
│     ├─ rooms.ts                  Game state machine
│     └─ api.ts                    Route helpers (auth, limits, errors)
└─ components/                     HostView, GuidedRound, ViewerView, RecordPanel, Visualizer, …
party/                              Cloudflare worker (own package.json + wrangler.jsonc)
└─ src/index.ts                     Room Durable Object: token check, store latest state, broadcast
```

### Round state machine

```
lobby ──pick──▶ recording ──viewer uploads──▶ guessing ──reveal──▶ reveal ──nailed/failed──▶ lobby
                    │                            │                   │
                    └──────── skip / panic ──────┴───────────────────┴──▶ lobby
```

## Scripts

| | |
|---|---|
| `npm run dev` | Dev server (local fallbacks when keys are missing) |
| `npm run dev:https` | Dev server with a self-signed certificate, for phone testing |
| `npm run build` / `npm start` | Production build / server |
| `npm run typecheck` | TypeScript check |
| `npm run party:install` / `party:dev` / `party:deploy` | Install, run locally (port 1999), deploy the realtime worker |

Note: `npm start` runs in production mode, so mock login is off and you need Twitch keys even locally.
