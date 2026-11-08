# FlipTalk

Kleines Spiel für Twitch-Streams. Ein zufälliger Zuschauer aus dem Chat nimmt bis zu 5 Sekunden Audio auf, der Streamer hört es rückwärts und muss es nachmachen. Danach wird sein Versuch wieder umgedreht und man vergleicht beides. Läuft auf https://flip-talk.vercel.app

Gebaut mit Next.js und TypeScript, Login über Twitch, gespeichert wird in Upstash Redis. Für die Live-Updates gibt's einen kleinen Cloudflare Worker im Ordner `party/`, damit auch ein paar tausend Zuschauer in einer Lobby sein können.

Für die `.env.local`:

```
AUTH_SECRET=
AUTH_TWITCH_ID=
AUTH_TWITCH_SECRET=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
NEXT_PUBLIC_PARTY_HOST=
PARTY_SECRET=
```

Lokal kann alles leer bleiben, dann gibt's einen Fake-Login und alles läuft im Speicher. Starten mit `npm install` und `npm run dev`.
