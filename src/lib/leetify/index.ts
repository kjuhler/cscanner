import {
  apiProxyHeaders,
  apiProxyUrl,
  isApiProxyEnabled,
} from "@/lib/apiProxy";
import type {
  Cs2SeasonRank,
  CsgoRankSummary,
  LeetifyProfile,
  LeetifyRecentMatch,
} from "@/lib/types";
import { competitiveRankName } from "@/lib/ranks";
import {
  deriveCs2SeasonRanks,
  deriveCsgoRankSummary,
  type SeasonGame,
} from "@/lib/leetify/seasons";
import {
  deriveAimExtras,
  deriveMapStats,
  deriveStackStats,
  gamesToRecentMatches,
  parseTeammates,
} from "@/lib/leetify/history";

type PublicApiProfile = {
  name?: string;
  winrate?: number;
  total_matches?: number;
  ranks?: {
    leetify?: number | null;
    premier?: number | null;
    faceit?: number | null;
    faceit_elo?: number | null;
    wingman?: number | null;
    competitive?: Array<{ map_name: string; rank: number }>;
  };
  rating?: {
    aim?: number;
    positioning?: number;
    utility?: number;
    clutch?: number;
    opening?: number;
    ct_leetify?: number;
    t_leetify?: number;
  };
  stats?: {
    accuracy_head?: number;
    spray_accuracy?: number;
    reaction_time_ms?: number;
    preaim?: number;
    accuracy_enemy_spotted?: number;
    counter_strafing_good_shots_ratio?: number;
    ct_opening_duel_success_percentage?: number;
    t_opening_duel_success_percentage?: number;
    trade_kills_success_percentage?: number;
    flashbang_leading_to_kill?: number;
    flashbang_hit_foe_per_flashbang?: number;
    flashbang_hit_friend_per_flashbang?: number;
    he_foes_damage_avg?: number;
    utility_on_death_avg?: number;
  };
  recent_matches?: Array<{
    id: string;
    finished_at?: string;
    data_source?: string;
    outcome?: string;
    rank?: number;
    rank_type?: number | null;
    map_name?: string;
    leetify_rating?: number;
    score?: number[];
    accuracy_head?: number;
  }>;
  bans?: Array<{ platform?: string; reason?: string }>;
};

type MiniProfile = {
  name?: string;
  steam64Id?: string;
  faceitNickname?: string;
  platformBans?: Array<{ platform?: string; reason?: string }>;
  ratings?: {
    aim?: number;
    positioning?: number;
    utility?: number;
    clutch?: number;
    opening?: number;
    leetify?: number;
    ctLeetify?: number;
    tLeetify?: number;
    gamesPlayed?: number;
    leetifyRatingRounds?: number;
  };
  ranks?: Array<{
    type?: string;
    dataSource?: string;
    skillLevel?: number;
  }>;
  recentMatches?: Array<{
    id: string;
    result?: string;
  }>;
};

const PREMIER_RANK_TYPE = 11;
const COMPETITIVE_RANK_TYPE = 12;
const SITE_ORIGIN = "https://api.cs-prod.leetify.com";

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

function siteHeaders(steamId: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    Origin: "https://leetify.com",
    Referer: `https://leetify.com/app/profile/${steamId}`,
    "User-Agent":
      "Mozilla/5.0 (compatible; ProfileCheck/1.0; +https://localhost)",
  };
  return isApiProxyEnabled() ? apiProxyHeaders(headers) : headers;
}

async function fetchPublicApi(
  steamId: string,
): Promise<LeetifyProfile | null> {
  const url = isApiProxyEnabled()
    ? apiProxyUrl("leetify-public", "v3/profile", {
        steam64_id: steamId,
      })
    : `https://api-public.cs-prod.leetify.com/v3/profile?steam64_id=${encodeURIComponent(steamId)}`;

  const res = await fetch(url, {
    headers: leetifyHeaders(),
    next: { revalidate: 180 },
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Leetify public API failed (${res.status})`);
  }

  const data = (await res.json()) as PublicApiProfile;
  if (data && "error" in data) return null;

  const recentMatches: LeetifyRecentMatch[] = (data.recent_matches ?? [])
    .map((m) => {
      const outcomeRaw = (m.outcome || "").toLowerCase();
      const outcome: LeetifyRecentMatch["outcome"] =
        outcomeRaw === "win" || outcomeRaw === "loss" || outcomeRaw === "tie"
          ? outcomeRaw
          : "unknown";
      const isPremier = m.rank_type === PREMIER_RANK_TYPE;
      const isComp = m.rank_type === COMPETITIVE_RANK_TYPE;

      return {
        id: m.id,
        finishedAt: m.finished_at ?? null,
        source: m.data_source ?? null,
        outcome,
        map: m.map_name ?? null,
        score:
          Array.isArray(m.score) && m.score.length === 2
            ? `${m.score[0]}-${m.score[1]}`
            : null,
        premierRating: isPremier && m.rank != null ? m.rank : null,
        competitiveRank: isComp && m.rank != null ? m.rank : null,
        hsPercent: round1(m.accuracy_head),
        leetifyRating: scaleSmall(m.leetify_rating),
      };
    });

  const premierFromRecent =
    recentMatches.find((m) => m.premierRating != null)?.premierRating ?? null;

  const ctOpen = data.stats?.ct_opening_duel_success_percentage;
  const tOpen = data.stats?.t_opening_duel_success_percentage;
  const openingDuelSuccess =
    ctOpen != null && tOpen != null
      ? round1((ctOpen + tOpen) / 2)
      : round1(ctOpen ?? tOpen);

  return {
    name: data.name ?? null,
    winrate: data.winrate != null ? Math.round(data.winrate * 1000) / 10 : null,
    totalMatches: data.total_matches ?? null,
    premier: data.ranks?.premier ?? null,
    premierRecent: premierFromRecent,
    faceitLevel: data.ranks?.faceit ?? null,
    faceitElo: data.ranks?.faceit_elo ?? null,
    wingman: data.ranks?.wingman ?? null,
    leetifyRating: round2(data.ranks?.leetify) ?? scaleSmall(data.rating?.ct_leetify),
    competitive: (data.ranks?.competitive ?? [])
      .filter((c) => c.rank > 0)
      .sort((a, b) => b.rank - a.rank)
      .map((c) => ({
        map: c.map_name.replace(/^de_|^cs_/, ""),
        rank: c.rank,
        rankName: competitiveRankName(c.rank),
      })),
    seasonRanksCs2: [],
    csgoRanks: null,
    mapStats: [],
    teammates: [],
    stackStats: null,
    hsPercent: round1(data.stats?.accuracy_head),
    aim: round1(data.rating?.aim),
    positioning: round1(data.rating?.positioning),
    utility: round1(data.rating?.utility),
    clutch: scalePct(data.rating?.clutch),
    opening: scaleSmall(data.rating?.opening),
    sprayAccuracy: round1(data.stats?.spray_accuracy),
    timeToDamageMs:
      data.stats?.reaction_time_ms != null
        ? Math.round(data.stats.reaction_time_ms)
        : null,
    preaim: round1(data.stats?.preaim),
    accuracyEnemySpotted: round1(data.stats?.accuracy_enemy_spotted),
    counterStrafeRatio: round1(data.stats?.counter_strafing_good_shots_ratio),
    openingDuelSuccess,
    tradeKillSuccess: round1(data.stats?.trade_kills_success_percentage),
    flashbangLeadingToKill: round2(data.stats?.flashbang_leading_to_kill),
    enemiesFlashedPerFlashbang: round2(
      data.stats?.flashbang_hit_foe_per_flashbang,
    ),
    teammatesFlashedPerFlashbang: round2(
      data.stats?.flashbang_hit_friend_per_flashbang,
    ),
    heDamagePerNade: round1(data.stats?.he_foes_damage_avg),
    utilityOnDeathAvg:
      data.stats?.utility_on_death_avg != null
        ? Math.round(data.stats.utility_on_death_avg)
        : null,
    recentMatches,
    profileUrl: `https://leetify.com/app/profile/${steamId}`,
    platformBans: (data.bans ?? []).map((ban) => ({
      platform: ban.platform ?? "unknown",
      reason: ban.reason ?? null,
    })),
    dataSource: "public_api",
    sampleGames: null,
    sampleRounds: null,
  };
}

type WebsiteFullProfile = {
  recentGameRatings?: MiniProfile["ratings"];
  meta?: { faceitNickname?: string; name?: string };
  games?: SeasonGame[];
  teammates?: Parameters<typeof parseTeammates>[0];
};

async function fetchMiniProfile(steamId: string): Promise<MiniProfile | null> {
  const url = isApiProxyEnabled()
    ? apiProxyUrl("leetify-site", `api/mini-profiles/${steamId}`)
    : `${SITE_ORIGIN}/api/mini-profiles/${steamId}`;

  const res = await fetch(url, {
    headers: siteHeaders(steamId),
    next: { revalidate: 180 },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Leetify mini-profile failed (${res.status})`);
  }
  return (await res.json()) as MiniProfile;
}

/**
 * Full website profile can be >1MB (thousands of games). Avoid Next data-cache
 * for this payload — caching it often fails and used to wipe the whole Leetify
 * result when paired with mini via Promise.all.
 */
async function fetchFullWebsiteProfile(
  steamId: string,
): Promise<WebsiteFullProfile | null> {
  const url = isApiProxyEnabled()
    ? apiProxyUrl("leetify-site", `api/profile/id/${steamId}`)
    : `${SITE_ORIGIN}/api/profile/id/${steamId}`;

  const res = await fetch(url, {
    headers: siteHeaders(steamId),
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Leetify website profile failed (${res.status})`);
  }
  return (await res.json()) as WebsiteFullProfile;
}

async function fetchWebsiteProfile(
  steamId: string,
): Promise<LeetifyProfile | null> {
  const [miniResult, profileResult] = await Promise.allSettled([
    fetchMiniProfile(steamId),
    fetchFullWebsiteProfile(steamId),
  ]);

  const mini =
    miniResult.status === "fulfilled" ? miniResult.value : null;
  const profile =
    profileResult.status === "fulfilled" ? profileResult.value : null;

  if (!mini && !profile) {
    const errs = [miniResult, profileResult]
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .map((r) =>
        r.reason instanceof Error ? r.reason.message : String(r.reason),
      );
    if (errs.length > 0) {
      throw new Error(errs.join("; "));
    }
    return null;
  }

  let seasonRanksCs2: Cs2SeasonRank[] = [];
  let csgoRanks: CsgoRankSummary | null = null;
  let mapStats: LeetifyProfile["mapStats"] = [];
  let teammates: LeetifyProfile["teammates"] = [];
  let gamesAsMatches: LeetifyRecentMatch[] = [];
  let stackStats: LeetifyProfile["stackStats"] = null;
  let aimExtras = {
    hsPercent: null as number | null,
    preaim: null as number | null,
    timeToDamageMs: null as number | null,
  };

  const games = profile?.games ?? [];
  if (games.length > 0) {
    try {
      seasonRanksCs2 = deriveCs2SeasonRanks(games);
      csgoRanks = deriveCsgoRankSummary(games);
      mapStats = deriveMapStats(games, steamId, 100);
      gamesAsMatches = gamesToRecentMatches(games, steamId, 30);
      aimExtras = deriveAimExtras(games, 30);
      stackStats = deriveStackStats(games, 100);
    } catch {
      // Keep mini-profile ratings even if game history processing fails.
    }
  }

  try {
    teammates = parseTeammates(profile?.teammates ?? []);
  } catch {
    teammates = [];
  }

  const ratings = mini?.ratings ?? profile?.recentGameRatings ?? {};
  const ranks = mini?.ranks ?? [];

  const premierRank = ranks.find(
    (r) => r.type === "premier" && r.dataSource === "matchmaking",
  );
  const faceitRank = ranks.find((r) => r.dataSource === "faceit");
  const wingmanRank = ranks.find(
    (r) => r.dataSource === "matchmaking_wingman",
  );

  const competitive = ranks
    .filter(
      (r) =>
        r.dataSource === "matchmaking" &&
        r.type &&
        r.type !== "premier" &&
        (r.skillLevel ?? 0) > 0,
    )
    .map((r) => ({
      map: (r.type || "").replace(/^de_|^cs_/, ""),
      rank: r.skillLevel ?? 0,
      rankName: competitiveRankName(r.skillLevel ?? 0),
    }))
    .sort((a, b) => b.rank - a.rank);

  const recentRaw = mini?.recentMatches ?? [];

  const recentMatches: LeetifyRecentMatch[] =
    gamesAsMatches.length > 0
      ? gamesAsMatches
      : recentRaw.map((m) => {
          const outcomeRaw = (m.result || "").toLowerCase();
          const outcome: LeetifyRecentMatch["outcome"] =
            outcomeRaw === "win" ||
            outcomeRaw === "loss" ||
            outcomeRaw === "tie"
              ? outcomeRaw
              : "unknown";
          return {
            id: m.id,
            finishedAt: null,
            source: null,
            outcome,
            map: null,
            score: null,
            premierRating: null,
            competitiveRank: null,
            hsPercent: null,
            leetifyRating: null,
          };
        });

  // Prefer last-30 from full game history (matches Leetify UI). Mini
  // recentMatches is often only ~5 stub entries and understates WR badly.
  const wrSample =
    games.length > 0
      ? games.slice(0, 30).map((g) => (g.matchResult || "").toLowerCase())
      : recentRaw.map((m) => (m.result || "").toLowerCase());
  const wins = wrSample.filter((r) => r === "win").length;
  const played = wrSample.filter((r) => r === "win" || r === "loss").length;

  const premierValue =
    premierRank?.skillLevel && premierRank.skillLevel > 0
      ? premierRank.skillLevel
      : null;

  return {
    name: mini?.name ?? profile?.meta?.name ?? null,
    winrate:
      played > 0 ? Math.round((wins / played) * 1000) / 10 : null,
    totalMatches: ratings.gamesPlayed ?? null,
    premier: premierValue,
    premierRecent: premierValue,
    faceitLevel: faceitRank?.skillLevel ?? null,
    faceitElo: null,
    wingman: wingmanRank?.skillLevel ?? null,
    leetifyRating: scaleSmall(ratings.leetify),
    competitive,
    seasonRanksCs2,
    csgoRanks,
    mapStats,
    teammates,
    stackStats,
    hsPercent: aimExtras.hsPercent,
    aim: round1(ratings.aim),
    positioning: round1(ratings.positioning),
    utility: round1(ratings.utility),
    clutch: scalePct(ratings.clutch),
    opening: scaleSmall(ratings.opening),
    sprayAccuracy: null,
    timeToDamageMs: aimExtras.timeToDamageMs,
    preaim: aimExtras.preaim,
    accuracyEnemySpotted: null,
    counterStrafeRatio: null,
    openingDuelSuccess: null,
    tradeKillSuccess: null,
    flashbangLeadingToKill: null,
    enemiesFlashedPerFlashbang: null,
    teammatesFlashedPerFlashbang: null,
    heDamagePerNade: null,
    utilityOnDeathAvg: null,
    recentMatches,
    profileUrl: `https://leetify.com/app/profile/${steamId}`,
    platformBans: (mini?.platformBans ?? []).map((ban) => ({
      platform: ban.platform ?? "unknown",
      reason: ban.reason ?? null,
    })),
    dataSource: "website",
    sampleGames: ratings.gamesPlayed ?? null,
    sampleRounds: ratings.leetifyRatingRounds ?? null,
  };
}

export async function getLeetifyProfile(
  steamId: string,
): Promise<LeetifyProfile | null> {
  const [publicResult, websiteResult] = await Promise.allSettled([
    fetchPublicApi(steamId),
    fetchWebsiteProfile(steamId),
  ]);

  const fromPublic =
    publicResult.status === "fulfilled" ? publicResult.value : null;
  const fromWebsite =
    websiteResult.status === "fulfilled" ? websiteResult.value : null;

  if (!fromPublic && !fromWebsite) {
    const errs = [publicResult, websiteResult]
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .map((r) =>
        r.reason instanceof Error ? r.reason.message : String(r.reason),
      );
    if (errs.length > 0) {
      throw new Error(errs.join("; "));
    }
    return null;
  }

  if (fromPublic && fromWebsite) {
    return {
      ...fromWebsite,
      ...fromPublic,
      // Prefer public competitive ranks when present; keep website seasons.
      competitive:
        fromPublic.competitive.length > 0
          ? fromPublic.competitive
          : fromWebsite.competitive,
      seasonRanksCs2: fromWebsite.seasonRanksCs2,
      csgoRanks: fromWebsite.csgoRanks,
      mapStats: fromWebsite.mapStats,
      teammates: fromWebsite.teammates,
      stackStats: fromWebsite.stackStats,
      recentMatches:
        fromWebsite.recentMatches.length > 0 &&
        fromWebsite.recentMatches.some((m) => m.map != null)
          ? fromWebsite.recentMatches
          : fromPublic.recentMatches,
      // Website may fill HS/preaim/TTD from games when public omits them.
      hsPercent: fromPublic.hsPercent ?? fromWebsite.hsPercent,
      preaim: fromPublic.preaim ?? fromWebsite.preaim,
      timeToDamageMs:
        fromPublic.timeToDamageMs ?? fromWebsite.timeToDamageMs,
      dataSource: "public_api",
    };
  }

  return fromPublic ?? fromWebsite;
}
