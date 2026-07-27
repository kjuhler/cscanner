# Profile Check

CS2 player stats tracker with cheating-signal heuristics — similar in spirit to multi-source trackers like CS2Tracker.

Look up a Steam ID or profile URL to review K/D, win rate, HS%, Premier, FACEIT ELO, Leetify aim/time-to-damage metrics, and recent matches. Scope.gg and CSStats are deep-linked (they have no public APIs).

**Steam URL trick:** change `steamcommunity.com` → `steamcommunity.name` on any profile link, e.g. [steamcommunity.com/profiles/76561197991294686](https://steamcommunity.com/profiles/76561197991294686) → `https://steamcommunity.name/profiles/76561197991294686` (same path: `/profiles/{id}` or `/id/{vanity}`).

## Features

- Steam ID / profile URL / vanity / `steamcommunity.ai`-style URLs
- Steam lifetime stats, last match, map wins
- FACEIT ELO, HS%, map breakdown, recent matches (API key)
- Leetify Premier, competitive map ranks, time to DMG, aim ratings
- Heuristic cheating risk % with signal breakdown
- Match share code → direct analyze (radar / timeline / cheat signals)
- Tracker sources hub: live vs link-only (CSStats, Scope.gg)
- Outbound profiles: Leetify, CSStats, Scope.gg, FACEIT, Steam

## Setup (local)

1. Install dependencies:

```bash
pnpm install
```

2. Copy env template and add API keys:

```bash
cp .env.example .env.local
```

| Variable | Where to get it |
|----------|-----------------|
| `STEAM_API_KEY` | [steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey) |
| `FACEIT_API_KEY` | [developers.faceit.com](https://developers.faceit.com/) |
| `LEETIFY_API_KEY` | [leetify.com/app/developer](https://leetify.com/app/developer) (optional, higher rate limits) |
| `REDIS_URL` | Optional (only for legacy upload queue flow) |
| `STEAM_GC_ENABLED` | Optional — set `true` to show share-code fetch on `/demo` |
| `STEAM_REFRESH_TOKEN` | Required for share-code analyze (Steam GC login token) |

Steam Web API key is required for profiles. FACEIT is optional. Leetify works without a key for registered players, but a key raises rate limits. Scope/CSStats are link-only.

**Match share codes:** Valve MM codes (`CSGO-…`) need a Steam Game Coordinator session — not the Web API key. Prefer a dedicated bot account. Generate a refresh token once:

```bash
pnpm exec node scripts/steam-refresh-token.mjs
```

Set `STEAM_REFRESH_TOKEN` and `STEAM_GC_ENABLED=true` (for local `.env.local` or web service env). Demos expire from Valve after ~30 days; FACEIT codes are not supported.

3. Start app:

```bash
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Profile lookup and share-code analyze work without Redis.  
On `/demo`, paste a share code to start a new review. Shared rundowns live at `/demo/r/{runId}` (24h). The bundled example is at `/demo/example`.

Accepted share-code input formats:
- plain `CSGO-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX`
- full Steam copy URI (auto-extracted), e.g.  
  `steam://rungame/730/76561202255233023/+csgo_download_match%20CSGO-2yW29-RRKYm-j7wje-Yn9oc-4YKsE`

## Deploy (Portainer / GitHub)

Repo includes `Dockerfile` + `docker-compose.yml` for a **Git repository** Portainer stack. The app image is **built on the host** from the repo — it is **not** on Docker Hub.

Stack services:

| Service | Role |
|---------|------|
| `web` | Next.js — profiles + share-code analyze |
| `worker` | Optional legacy upload queue consumer |
| `redis` | Optional legacy upload queue/status store |

**Host port:** `3003` → web container `3000` (chosen because 3000–3002 are already used on the host).

### Requirements

- Portainer on **Docker Standalone** (not Swarm — Swarm cannot `build:` from compose)
- Enable **relative path** / Git build support if Portainer asks (needed so `build.context: .` can see the Dockerfile)
- Give the **worker** enough RAM (4 GB+ recommended)

### Create the stack

1. Push this repo to GitHub (`kjuhler/cscanner`).
2. Portainer → **Stacks** → **Add stack** → **Repository**.
3. Repository URL: `https://github.com/kjuhler/cscanner.git`
4. Compose path: `docker-compose.yml`
5. Under **Environment variables**, add:

| Name | Value |
|------|--------|
| `STEAM_API_KEY` | your Steam Web API key |
| `FACEIT_API_KEY` | optional |
| `LEETIFY_API_KEY` | optional |
| `ANALYZE_CONCURRENCY` | optional, default `1` |
| `STEAM_GC_ENABLED` | optional — `true` to enable share-code UI on web |
| `STEAM_REFRESH_TOKEN` | required for share-code analyze (set on **web** service) |

6. Deploy the stack. Open `http://<host>:3003`.

### Demo uploads behind a reverse proxy

Uploads use **512 KB chunks** by default (6 in parallel) so they work even when
nginx keeps `client_max_body_size 1m`.

The UI shows upload **MB/s + ETA**, then **live stages** while the **worker**
assembles, decompresses, parses, and analyzes. Job state lives in Redis; demo
blobs live on the shared `demo-data` volume (`DATA_DIR=/data`).

After changing analyze/parse code, regenerate the worker before commit/deploy:

```bash
pnpm build:analyze-worker
```

**Faster uploads** once you control the proxy — raise the body limit and bump
chunk size:

```nginx
client_max_body_size 500m;
proxy_read_timeout 600s;
proxy_send_timeout 600s;
proxy_request_buffering off;
```

```env
# e.g. in Portainer / compose environment
NEXT_PUBLIC_UPLOAD_CHUNK_KB=4096
```

Quick health check (Redis + queue — demoparser runs on the worker):

```bash
curl -s http://<host>:3003/api/upload-demo
# expect: {"ok":true,"redis":true,"queue":{...}}
```

**Note:** Chrome “Content Security Policy … blocks eval” is usually from the
host/CDN/browser extension — this app does not set a CSP that blocks uploads.

### Update after code pushes

1. Open the stack → **Pull and redeploy** (or Editor → **Update the stack**).
2. **Uncheck** “Re-pull image” / “Pull latest image”.  
   That option tries `docker pull cscanner` from Docker Hub and fails with *pull access denied*.
3. Redeploy so Portainer rebuilds from Git (`pull_policy: build` in compose).

If the UI still tries to pull: delete the stack’s old image under **Images**, then redeploy without “Re-pull image”.

### Local Docker smoke test

```bash
docker compose up --build -d
```

App: [http://localhost:3003](http://localhost:3003).

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- Redis + BullMQ analyze queue
- Dedicated analyze worker (`analyze-worker.cjs`)
- Server-side fetches only (API keys never exposed to the browser)

## Notes

- Private Steam profiles limit available stats.
- Premier / time-to-damage / detailed aim metrics come from Leetify when available.
- Scope.gg and CSStats block or do not expose public APIs — we cannot embed their full dashboards without scraping (fragile / often blocked).
- Risk scoring uses public patterns only and is not VAC or proof of cheating.
