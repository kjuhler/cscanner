import { NextResponse } from "next/server";
import { getLeetifyProfile } from "@/lib/leetify";
import {
  getCs2LifetimeStats,
  getCs2PlaytimeHours,
  getPlayerSummary,
} from "@/lib/steam";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const STEAM_ID64_RE = /^7656119\d{10}$/;

type PlayerContext = {
  steamId: string;
  steam: {
    personaName: string | null;
    profileUrl: string | null;
    accountAgeDays: number | null;
    profilePrivate: boolean | null;
    cs2PlaytimeHours: number | null;
    kd: number | null;
    hsPercent: number | null;
    winRate: number | null;
  };
  leetify: {
    profileUrl: string | null;
    premier: number | null;
    aim: number | null;
    preaim: number | null;
    timeToDamageMs: number | null;
    winrate: number | null;
  };
};

function sanitizeSteamIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const ids = raw
    .map((v) => String(v ?? "").trim())
    .filter((v) => STEAM_ID64_RE.test(v));
  // unique + hard cap for safety
  return [...new Set(ids)].slice(0, 12);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { steamIds?: unknown };
    const steamIds = sanitizeSteamIds(body.steamIds);
    if (steamIds.length === 0) {
      return NextResponse.json({ contexts: [] as PlayerContext[] });
    }

    const contexts = await Promise.all(
      steamIds.map(async (steamId): Promise<PlayerContext> => {
        const [steamSummary, cs2Stats, cs2Hours, leetify] =
          await Promise.all([
            getPlayerSummary(steamId).catch(() => null),
            getCs2LifetimeStats(steamId).catch(() => null),
            getCs2PlaytimeHours(steamId).catch(() => null),
            getLeetifyProfile(steamId).catch(() => null),
          ]);

        return {
          steamId,
          steam: {
            personaName: steamSummary?.personaName ?? null,
            profileUrl: steamSummary?.profileUrl ?? null,
            accountAgeDays: steamSummary?.accountAgeDays ?? null,
            profilePrivate: steamSummary?.profilePrivate ?? null,
            cs2PlaytimeHours: cs2Hours,
            kd: cs2Stats?.kd ?? null,
            hsPercent: cs2Stats?.hsPercent ?? null,
            winRate: cs2Stats?.winRate ?? null,
          },
          leetify: {
            profileUrl: leetify?.profileUrl ?? null,
            premier: leetify?.premier ?? leetify?.premierRecent ?? null,
            aim: leetify?.aim ?? null,
            preaim: leetify?.preaim ?? null,
            timeToDamageMs: leetify?.timeToDamageMs ?? null,
            winrate: leetify?.winrate ?? null,
          },
        };
      }),
    );

    return NextResponse.json({ contexts });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to build player context.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

