# FlipTalk

A little stream game: someone from chat records a few seconds of audio, the streamer hears it played backwards and has to copy it. Then the streamer's attempt gets reversed again and you play both side by side. Usually sounds terrible, which is the point.

Live at https://flip-talk.vercel.app

## How a round goes

1. The streamer creates a room and shares the link with chat (the link is hidden on screen so it doesn't leak on stream).
2. Viewers log in with Twitch, allow their mic and end up in the lobby.
3. The streamer picks someone at random. That person records up to 5 seconds and sends it.
4. Streamer listens to it reversed, records an imitation, flips it back and compares it with the original.
5. Nailed it or failed, back to the lobby, next one.

The UI is German by default, there's a DE/EN switch in the corner.

## Running it locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

You can leave everything in `.env.local` empty. Without keys the app uses a fake login (type any name), an in-memory store instead of Redis and server-sent events instead of the realtime worker. Good enough to play a full round on one machine:

- open http://localhost:3000, host a room as `streamer`
- copy the room link, open it in a private window, log in as `viewer1`
- pick the viewer and play through it

In dev there's also a small panel on the host page that adds 25 bot viewers, handy for testing the lobby count. Bots can't record, so just skip them.

For testing on a phone you need HTTPS because of the mic, so use `npm run dev:https` and open `https://<your-ip>:3000`.

If you want to run the actual realtime worker locally:

```bash
npm run party:install
cp party/.dev.vars.example party/.dev.vars
npm run party:dev
```

and put `NEXT_PUBLIC_PARTY_HOST=localhost:1999` and `PARTY_SECRET=local-party-secret` into `.env.local`.

## Stack

Next.js 16, TypeScript, Tailwind 4, Framer Motion, Auth.js (Twitch), Upstash Redis, and a small Cloudflare Worker with Durable Objects (PartyServer) for the realtime part. Audio is all Web Audio API in the browser.

## Deploying

The realtime worker goes to Cloudflare (free plan is fine):

```bash
npm run party:install
cd party
npx wrangler login
npx wrangler deploy
npx wrangler secret put PARTY_SECRET
```

The app itself goes to Vercel. Set these env vars (see `.env.example`):

- `AUTH_SECRET` (`npx auth secret`)
- `AUTH_TWITCH_ID`, `AUTH_TWITCH_SECRET` from the Twitch dev console, with `https://<domain>/api/auth/callback/twitch` as redirect URL
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (the `KV_REST_API_*` vars from the Vercel integration work too)
- `NEXT_PUBLIC_PARTY_HOST` (worker host without `https://`) and `PARTY_SECRET` (same as on Cloudflare)

`NEXT_PUBLIC_*` gets baked in at build time, so redeploy after changing it. In production the fake login is disabled, Twitch is the only way in.

Without the worker it still runs, but falls back to polling every 2.5s, which is only okay for small streams.

## How it handles big chats

The idea was to support a couple thousand viewers per room without paying for a realtime service.

Viewers only listen on a WebSocket to a Durable Object (one per room). Everything they actually do (join, leave, upload) goes through normal API routes on Vercel. When the state changes, Vercel writes it to Redis and sends one request to the Durable Object, which pushes it to all sockets. The sockets hibernate while nothing happens, and reconnects get the last state straight from the worker without hitting Vercel or Redis.

Some other details:

- room pages get a signed token, so nobody can open sockets for random room names
- every state message has a version number, older ones get ignored
- picks use `SPOP` and room updates are compare-and-set, so double clicks or a skip during an upload don't break anything
- only viewers who currently have the page open can get picked
- the audio clip (max ~220 KB WAV) is stored in Redis for 15 minutes and never goes over the socket
- player limit per room (1 to 50), checked in a single Redis script so it can't overshoot even with lots of joins at once

I tested 2,000 WebSocket clients against the worker locally with `wrangler dev`. State updates reached all of them in roughly 40 to 90 ms. That says something about the code, not about Cloudflare's network, but it was good enough for me.

For a 3 hour stream with 2,000 viewers the numbers end up well inside the free tiers of Cloudflare, Vercel and Upstash. Worth double checking their current limits though, and Vercel Hobby is officially non-commercial.

## Abuse stuff

- Twitch login only in production, users are identified by Twitch id
- rate limits per user and per IP
- the 5 second limit is checked in the browser and again on the server by reading the actual WAV data
- only the picked viewer can upload, and only during their turn
- the host has a panic button that stops playback, deletes the clip and bans the viewer from the room

## Project structure

```
src/app/            pages and API routes
src/components/     host view, viewer view, recorder, visualizer
src/hooks/          recording, playback, room state
src/lib/            audio helpers, WAV encoding, i18n, realtime client
src/lib/server/     Redis/in-memory store, rate limits, room state machine
party/              Cloudflare worker
```

Texts for both languages are in `src/lib/i18n/messages.ts`.

## Scripts

```
npm run dev            dev server
npm run dev:https      dev server with self-signed cert
npm run build          production build
npm run typecheck      tsc
npm run party:dev      realtime worker locally on port 1999
npm run party:deploy   deploy the worker
```
