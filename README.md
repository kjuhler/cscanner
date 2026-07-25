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

## Deploy (Portainer / Docker)

Repo includes `Dockerfile` + `docker-compose.yml` for a Git-based Portainer stack.

**Host port:** `3003` → container `3000` (chosen because 3000–3002 are already used on the host).

### Portainer steps

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

Rebuild after code pushes: Portainer stack → **Pull and redeploy** (enable rebuild if offered), or recreate the stack so the image rebuilds from Git.

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
