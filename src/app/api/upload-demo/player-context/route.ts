import { NextResponse } from "next/server";
import { getCsapiStats, isCsapiConfigured } from "@/lib/csapi";
import {
  getFaceitBans,
  getFaceitPlayerBySteamId,
  getFaceitStats,
  isFaceitConfigured,
} from "@/lib/faceit";
import { getLeetifyProfile } from "@/lib/leetify";
import { assessRisk } from "@/lib/risk/score";
import {
  getCs2LifetimeStats,
  getCs2PlaytimeHours,
  getPlayerBans,
  getPlayerSummary,
} from "@/lib/steam";
import type { MetricSeverity, TrustLevel } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const STEAM_ID64_RE = /^7656119\d{10}$/;
const CONCURRENCY = 4;

export type DemoPlayerContext = {
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
  faceit: {
    nickname: string | null;
    faceitUrl: string | null;
    elo: number | null;
    skillLevel: number | null;
    kd: number | null;
    hsPercent: number | null;
    winRate: number | null;
  };
  csapi: {
    kd: number | null;
    adr: number | null;
    timeToDamageMs: number | null;
    preaim: number | null;
    accuracyHead: number | null;
    wallbangKillPercent: number | null;
    kast: number | null;
    hltvRating2: number | null;
  } | null;
  leetify: {
    profileUrl: string | null;
    premier: number | null;
    aim: number | null;
    preaim: number | null;
    timeToDamageMs: number | null;
    winrate: number | null;
  };
  trust: {
    score: number | null;
    level: TrustLevel;
    insaneCount: number;
    topSeverity: MetricSeverity | null;
  };
};

function sanitizeSteamIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const ids = raw
    .map((v) => String(v ?? "").trim())
    .filter((v) => STEAM_ID64_RE.test(v));
  return [...new Set(ids)].slice(0, 12);
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]!);
    }
  }
  const n = Math.min(concurrency, Math.max(1, items.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}

async function buildContext(steamId: string): Promise<DemoPlayerContext> {
  const faceitOn = isFaceitConfigured();
  const csapiOn = isCsapiConfigured();

  const [steamSummary, cs2Stats, cs2Hours, steamBans, csapi, leetify, faceitPlayer] =
    await Promise.all([
      getPlayerSummary(steamId).catch(() => null),
      getCs2LifetimeStats(steamId).catch(() => null),
      getCs2PlaytimeHours(steamId).catch(() => null),
      getPlayerBans(steamId).catch(() => null),
      csapiOn ? getCsapiStats(steamId).catch(() => null) : Promise.resolve(null),
      getLeetifyProfile(steamId).catch(() => null),
      faceitOn
        ? getFaceitPlayerBySteamId(steamId).catch(() => null)
        : Promise.resolve(null),
    ]);

  let faceitStats = null;
  let faceitBans: Awaited<ReturnType<typeof getFaceitBans>> = [];
  if (faceitPlayer?.playerId) {
    const [stats, bans] = await Promise.all([
      getFaceitStats(faceitPlayer.playerId).catch(() => null),
      getFaceitBans(faceitPlayer.playerId).catch(() => []),
    ]);
    faceitStats = stats?.lifetime ?? null;
    faceitBans = bans ?? [];
  }

  const steamExtras = {
    cs2PlaytimeHours: cs2Hours,
    steamLevel: null,
    friendCount: null,
  };

  const trust = assessRisk({
    steam: steamSummary,
    steamExtras,
    cs2: cs2Stats,
    faceitPlayer,
    faceitStats,
    leetify,
    csapi,
    bans: {
      steam: steamBans,
      faceit: faceitBans,
      leetify: leetify?.platformBans ?? [],
      friends: {
        friendCount: null,
        steam: null,
        faceit: null,
      },
    },
  });

  const insaneCount = trust.metricFlags.filter((f) => f.severity === "insane").length;
  const topSeverity =
    trust.metricFlags.find((f) => f.severity === "insane")?.severity ??
    trust.metricFlags.find((f) => f.severity === "suspicious")?.severity ??
    trust.metricFlags.find((f) => f.severity === "elevated")?.severity ??
    null;

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
    faceit: {
      nickname: faceitPlayer?.nickname ?? null,
      faceitUrl: faceitPlayer?.faceitUrl ?? null,
      elo: faceitPlayer?.elo ?? null,
      skillLevel: faceitPlayer?.skillLevel ?? null,
      kd: faceitStats?.kd ?? null,
      hsPercent: faceitStats?.hsPercent ?? null,
      winRate: faceitStats?.winRate ?? null,
    },
    csapi: csapi
      ? {
          kd: csapi.kd,
          adr: csapi.adr,
          timeToDamageMs: csapi.timeToDamageMs,
          preaim: csapi.preaim,
          accuracyHead: csapi.accuracyHead,
          wallbangKillPercent: csapi.wallbangKillPercent,
          kast: csapi.kast,
          hltvRating2: csapi.hltvRating2,
        }
      : null,
    leetify: {
      profileUrl: leetify?.profileUrl ?? null,
      premier: leetify?.premier ?? leetify?.premierRecent ?? null,
      aim: leetify?.aim ?? null,
      preaim: leetify?.preaim ?? null,
      timeToDamageMs: leetify?.timeToDamageMs ?? null,
      winrate: leetify?.winrate ?? null,
    },
    trust: {
      score: trust.score,
      level: trust.level,
      insaneCount,
      topSeverity,
    },
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { steamIds?: unknown };
    const steamIds = sanitizeSteamIds(body.steamIds);
    if (steamIds.length === 0) {
      return NextResponse.json({ contexts: [] as DemoPlayerContext[] });
    }

    const contexts = await mapPool(steamIds, CONCURRENCY, buildContext);
    return NextResponse.json({ contexts });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to build player context.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
