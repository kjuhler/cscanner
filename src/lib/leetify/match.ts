import "server-only";

import {
  apiProxyHeaders,
  apiProxyUrl,
  isApiProxyEnabled,
} from "@/lib/apiProxy";
import type { LeetifyMatchDetails, LeetifyMatchPlayer } from "@/lib/types";

type ApiTeamScore = {
  team_number?: number;
  score?: number;
};

type ApiPlayerStats = {
  steam64_id?: string;
  name?: string;
  initial_team_number?: number;
  total_kills?: number;
  total_deaths?: number;
  total_assists?: number;
  kd_ratio?: number;
  dpr?: number;
  accuracy_head?: number;
  leetify_rating?: number;
  ct_leetify_rating?: number;
  t_leetify_rating?: number;
  mvps?: number;
  preaim?: number;
  reaction_time?: number;
  spray_accuracy?: number;
  score?: number;
};

type ApiMatchDetails = {
  id?: string;
  finished_at?: string;
  data_source?: string;
  data_source_match_id?: string;
  map_name?: string;
  has_banned_player?: boolean;
  replay_url?: string;
  team_scores?: ApiTeamScore[];
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

/** Website ratings often store 0.0041 for display value 0.41 */
function scaleSmall(n: number | null | undefined): number | null {
  if (n == null || Number.isNaN(n)) return null;
  if (Math.abs(n) <= 1) return round2(n * 100);
  return round2(n);
}

function scalePct(n: number | null | undefined): number | null {
  if (n == null || Number.isNaN(n)) return null;
  if (n <= 1) return round1(n * 100);
  return round1(n);
}

function leetifyHeaders(): Record<string, string> {
  const useProxy = isApiProxyEnabled();
  const key = process.env.LEETIFY_API_KEY?.trim();
  const headers: Record<string, string> = {
    Accept: "application/json",
    Origin: "https://leetify.com",
    Referer: "https://leetify.com/",
  };
  if (useProxy) {
    return apiProxyHeaders(headers);
  }
  if (key) {
    headers.Authorization = `Bearer ${key}`;
  }
  return headers;
}

function mapPlayer(p: ApiPlayerStats): LeetifyMatchPlayer | null {
  const steamId = p.steam64_id?.trim();
  if (!steamId) return null;
  return {
    steamId,
    name: p.name?.trim() || steamId,
    teamNumber: p.initial_team_number ?? 0,
    kills: p.total_kills ?? 0,
    deaths: p.total_deaths ?? 0,
    assists: p.total_assists ?? 0,
    kd: p.kd_ratio != null ? round2(p.kd_ratio) : null,
    adr: p.dpr != null ? round1(p.dpr) : null,
    hsPercent: scalePct(p.accuracy_head),
    leetifyRating: scaleSmall(p.leetify_rating),
    ctRating: scaleSmall(p.ct_leetify_rating),
    tRating: scaleSmall(p.t_leetify_rating),
    mvps: p.mvps ?? 0,
    preaim: p.preaim != null ? round1(p.preaim) : null,
    timeToDamageMs:
      p.reaction_time != null ? Math.round(p.reaction_time) : null,
    sprayAccuracy: scalePct(p.spray_accuracy),
    score: p.score ?? 0,
  };
}

function formatTeamScore(scores: ApiTeamScore[] | undefined): string | null {
  if (!scores || scores.length < 2) return null;
  const sorted = [...scores].sort(
    (a, b) => (a.team_number ?? 0) - (b.team_number ?? 0),
  );
  if (sorted.length === 2) {
    return `${sorted[0]?.score ?? 0}-${sorted[1]?.score ?? 0}`;
  }
  return sorted.map((s) => s.score ?? 0).join("-");
}

const GAME_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isLeetifyGameId(gameId: string): boolean {
  return GAME_ID_RE.test(gameId.trim());
}

/**
 * Full lobby stats for a single match via Leetify public API.
 * GET /v2/matches/{gameId}
 */
export async function getLeetifyMatch(
  gameId: string,
): Promise<LeetifyMatchDetails | null> {
  const id = gameId.trim();
  if (!isLeetifyGameId(id)) {
    throw new Error("Invalid Leetify game id.");
  }

  const url = isApiProxyEnabled()
    ? apiProxyUrl("leetify-public", `v2/matches/${encodeURIComponent(id)}`)
    : `https://api-public.cs-prod.leetify.com/v2/matches/${encodeURIComponent(id)}`;

  const res = await fetch(url, {
    headers: leetifyHeaders(),
    next: { revalidate: 300 },
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Leetify match API failed (${res.status})`);
  }

  const data = (await res.json()) as ApiMatchDetails;
  const players = (data.stats ?? [])
    .map(mapPlayer)
    .filter((p): p is LeetifyMatchPlayer => p != null)
    .sort((a, b) => {
      if (b.kills !== a.kills) return b.kills - a.kills;
      return (b.leetifyRating ?? -999) - (a.leetifyRating ?? -999);
    });

  return {
    id: data.id ?? id,
    finishedAt: data.finished_at ?? null,
    source: data.data_source ?? null,
    sourceMatchId: data.data_source_match_id ?? null,
    map: data.map_name ?? null,
    hasBannedPlayer: Boolean(data.has_banned_player),
    replayUrl: data.replay_url ?? null,
    score: formatTeamScore(data.team_scores),
    players,
  };
}
