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

Steam is required. FACEIT is optional. Leetify works without a key for registered players, but a key raises rate limits. Scope/CSStats are link-only.

3. Run the dev server:

```bash
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy (Portainer / GitHub)

Repo includes `Dockerfile` + `docker-compose.yml` for a **Git repository** Portainer stack. The app image is **built on the host** from the repo — it is **not** on Docker Hub.

**Host port:** `3003` → container `3000` (chosen because 3000–3002 are already used on the host).

### Requirements

- Portainer on **Docker Standalone** (not Swarm — Swarm cannot `build:` from compose)
- Enable **relative path** / Git build support if Portainer asks (needed so `build.context: .` can see the Dockerfile)

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

6. Deploy the stack. Open `http://<host>:3003`.

### Demo uploads behind a reverse proxy

Uploads are **chunked (~512 KB each)** so they work even when nginx keeps the
default `client_max_body_size 1m` (a single large POST often stalls around ~1%).

Still recommended for fewer round-trips and long parses:

```nginx
client_max_body_size 500m;
proxy_read_timeout 600s;
proxy_send_timeout 600s;
proxy_request_buffering off;
```

Quick check that the parser loaded in the container:

```bash
curl -s http://<host>:3003/api/upload-demo
# expect: {"ok":true,"demoparser":true}
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

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Server-side fetches only (API keys never exposed to the browser)

## Notes

- Private Steam profiles limit available stats.
- Premier / time-to-damage / detailed aim metrics come from Leetify when available.
- Scope.gg and CSStats block or do not expose public APIs — we cannot embed their full dashboards without scraping (fragile / often blocked).
- Risk scoring uses public patterns only and is not VAC or proof of cheating.
