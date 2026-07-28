import "server-only";

import type { LeetifyMatchPlayerRow } from "@/lib/types";

export type { LeetifyMatchPlayerRow };

type ApiPlayerStats = {
  steam64_id?: string;
  name?: string;
  preaim?: number;
  reaction_time?: number;
  accuracy?: number;
  accuracy_enemy_spotted?: number;
  accuracy_head?: number;
  spray_accuracy?: number;
  kd_ratio?: number;
  total_kills?: number;
  total_deaths?: number;
  total_assists?: number;
  total_hs_kills?: number;
  total_damage?: number;
  dpr?: number;
  leetify_rating?: number;
  rounds_count?: number;
  rounds_won?: number;
  rounds_lost?: number;
  rounds_survived?: number;
  traded_deaths_succeed?: number;
  shots_fired?: number;
  shots_hit_foe?: number;
  shots_hit_enemy_spotted?: number;
  initial_team_number?: number;
};

type ApiMatch = {
  id?: string;
  finished_at?: string;
  map_name?: string;
  data_source?: string;
  team_scores?: Array<{ team_number?: number; score?: number }>;
  stats?: ApiPlayerStats[];
};

function round1(n: number | null | undefined): number | null {
  if (n == null || Number.isNaN(n)) return null;
  return Math.round(n * 10) / 10;
}

function round2(n: number | null | undefined): number | null {
  if (n == null || Number.isNaN(n)) return null;
  return Math.round(n * 100) / 100;
}

/** Leetify sometimes stores reaction_time in seconds (0.59) vs ms (593). */
function reactionToMs(n: number | null | undefined): number | null {
  if (n == null || Number.isNaN(n) || n <= 0) return null;
  if (n <= 10) return Math.round(n * 1000);
  return Math.round(n);
}

/** Website/public ratings often store 0.0041 for display 0.41 */
function scaleLeetifyRating(n: number | null | undefined): number | null {
  if (n == null || Number.isNaN(n)) return null;
  if (Math.abs(n) <= 1) return round2(n * 100);
  return round2(n);
}

function leetifyHeaders(): HeadersInit {
  const key = process.env.LEETIFY_API_KEY?.trim();
  const headers: Record<string, string> = {
    Accept: "application/json",
    Origin: "https://leetify.com",
    Referer: "https://leetify.com/",
  };
  if (key) {
    headers.Authorization = `Bearer ${key}`;
    headers._leetify_key = key;
  }
  return headers;
}

function playerWon(
  stats: ApiPlayerStats,
  teamScores: ApiMatch["team_scores"],
): boolean | null {
  if (!teamScores || teamScores.length < 2) return null;
  const myTeam = stats.initial_team_number;
  if (myTeam == null) return null;
  const mine = teamScores.find((t) => t.team_number === myTeam);
  const theirs = teamScores.find((t) => t.team_number !== myTeam);
  if (mine?.score == null || theirs?.score == null) return null;
  if (mine.score === theirs.score) return null;
  return mine.score > theirs.score;
}

function mapPlayerRow(
  steamId: string,
  match: ApiMatch,
  stats: ApiPlayerStats,
): LeetifyMatchPlayerRow | null {
  const id = stats.steam64_id?.trim();
  if (!id || id !== steamId) return null;

  const kills = stats.total_kills ?? 0;
  const deaths = stats.total_deaths ?? 0;
  const roundsCount = stats.rounds_count ?? 0;
  const damage =
    stats.total_damage ??
    (stats.dpr != null && roundsCount > 0
      ? Math.round(stats.dpr * roundsCount)
      : 0);
  const shotsHit =
    stats.shots_hit_foe ?? stats.shots_hit_enemy_spotted ?? 0;

  return {
    steamId: id,
    finishedAt: match.finished_at ?? null,
    map: match.map_name ?? null,
    source: match.data_source ?? null,
    won: playerWon(stats, match.team_scores),
    preaim: stats.preaim != null ? round1(stats.preaim) : null,
    timeToDamageMs: reactionToMs(stats.reaction_time),
    kills,
    deaths,
    assists: stats.total_assists ?? 0,
    hsKills: stats.total_hs_kills ?? 0,
    shotsFired: stats.shots_fired ?? 0,
    shotsHit,
    damage,
    roundsCount,
    roundsSurvived: stats.rounds_survived ?? 0,
    tradedDeathsSucceed: stats.traded_deaths_succeed ?? 0,
    roundsWon: stats.rounds_won ?? null,
    roundsLost: stats.rounds_lost ?? null,
    leetifyRating: scaleLeetifyRating(stats.leetify_rating),
  };
}

function extractMatches(payload: unknown): ApiMatch[] {
  if (Array.isArray(payload)) return payload as ApiMatch[];
  if (payload && typeof payload === "object") {
    const obj = payload as { matches?: ApiMatch[]; data?: ApiMatch[] };
    if (Array.isArray(obj.matches)) return obj.matches;
    if (Array.isArray(obj.data)) return obj.data;
  }
  return [];
}

/**
 * Detailed match history with per-player stats.
 * GET /v3/profile/matches?steam64_id=&limit=
 */
export async function getLeetifyProfileMatches(
  steamId: string,
  limit = 100,
): Promise<LeetifyMatchPlayerRow[]> {
  const capped = Math.max(1, Math.min(limit, 100));
  const url =
    `https://api-public.cs-prod.leetify.com/v3/profile/matches` +
    `?steam64_id=${encodeURIComponent(steamId)}` +
    `&limit=${capped}`;

  const res = await fetch(url, {
    headers: leetifyHeaders(),
    next: { revalidate: 180 },
  });

  if (res.status === 404) return [];
  if (!res.ok) {
    throw new Error(`Leetify matches API failed (${res.status})`);
  }

  const payload: unknown = await res.json();
  const matches = extractMatches(payload);

  const rows: LeetifyMatchPlayerRow[] = [];
  for (const match of matches) {
    for (const stats of match.stats ?? []) {
      const row = mapPlayerRow(steamId, match, stats);
      if (row) rows.push(row);
    }
  }

  rows.sort((a, b) => {
    const ta = a.finishedAt ? Date.parse(a.finishedAt) : 0;
    const tb = b.finishedAt ? Date.parse(b.finishedAt) : 0;
    return tb - ta;
  });

  return rows;
}
