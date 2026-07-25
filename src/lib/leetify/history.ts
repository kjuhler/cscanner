import type {
  LeetifyMapStats,
  LeetifyRecentMatch,
  LeetifyStackStats,
  LeetifyTeammate,
} from "@/lib/types";
import type { SeasonGame } from "@/lib/leetify/seasons";

const PREMIER_RANK_TYPE = 11;
const COMPETITIVE_RANK_TYPE = 12;

type WebsiteGame = SeasonGame & {
  gameId?: string;
  mapName?: string | null;
  dataSource?: string | null;
  scores?: number[] | null;
  kills?: number | null;
  deaths?: number | null;
  accuracyHead?: number | null;
  preaim?: number | null;
  reactionTime?: number | null;
  partySize?: number | null;
  ctLeetifyRating?: number | null;
  tLeetifyRating?: number | null;
  ownTeamTotalLeetifyRatings?: Record<string, number | null> | null;
  hasBannedPlayer?: boolean;
};

export type DerivedAimExtras = {
  hsPercent: number | null;
  preaim: number | null;
  timeToDamageMs: number | null;
};

type WebsiteTeammate = {
  steam64Id?: string;
  steamNickname?: string | null;
  steamAvatarUrl?: string | null;
  matchesPlayedTogether?: number | null;
  winRateTogether?: number | null;
  profileUserLeetifyRating?: number | null;
  teammateLeetifyRating?: number | null;
  isBanned?: boolean;
  rank?: {
    type?: string | null;
    dataSource?: string | null;
    skillLevel?: number | null;
  } | null;
};

function round1(n: number | null | undefined): number | null {
  if (n == null || Number.isNaN(n)) return null;
  return Math.round(n * 10) / 10;
}

function round2(n: number | null | undefined): number | null {
  if (n == null || Number.isNaN(n)) return null;
  return Math.round(n * 100) / 100;
}

/** Leetify stores ratings like 0.0164 for display +1.64 */
export function scaleLeetifyRating(n: number | null | undefined): number | null {
  if (n == null || Number.isNaN(n)) return null;
  if (Math.abs(n) <= 1) return round2(n * 100);
  return round2(n);
}

function outcomeFromResult(
  result: string | null | undefined,
): LeetifyRecentMatch["outcome"] {
  const raw = (result || "").toLowerCase();
  if (raw === "win" || raw === "loss" || raw === "tie") return raw;
  return "unknown";
}

function playerRating(game: WebsiteGame, steamId: string): number | null {
  const own = game.ownTeamTotalLeetifyRatings?.[steamId];
  if (own != null) return scaleLeetifyRating(own);
  if (game.ctLeetifyRating != null || game.tLeetifyRating != null) {
    const parts = [game.ctLeetifyRating, game.tLeetifyRating].filter(
      (v): v is number => v != null,
    );
    if (parts.length === 0) return null;
    return scaleLeetifyRating(
      parts.reduce((a, b) => a + b, 0) / parts.length,
    );
  }
  return null;
}

export function gamesToRecentMatches(
  games: WebsiteGame[],
  steamId: string,
  limit = 30,
): LeetifyRecentMatch[] {
  return games.slice(0, limit).map((g) => {
    const skill = g.skillLevel ?? 0;
    const isPremier = g.rankType === PREMIER_RANK_TYPE;
    const isComp = g.rankType === COMPETITIVE_RANK_TYPE;
    const score =
      Array.isArray(g.scores) && g.scores.length >= 2
        ? `${g.scores[0]}-${g.scores[1]}`
        : null;
    const kills = g.kills ?? null;
    const deaths = g.deaths ?? null;

    return {
      id: g.gameId || `${g.mapName}-${g.gameFinishedAt}`,
      finishedAt: g.gameFinishedAt ?? null,
      source: g.dataSource ?? null,
      outcome: outcomeFromResult(g.matchResult),
      map: g.mapName ?? null,
      score,
      premierRating: isPremier && skill > 18 ? skill : null,
      competitiveRank: isComp && skill >= 1 && skill <= 18 ? skill : null,
      // CS:GO games often have skill 1-18 without rankType
      csgoRank:
        !g.isCs2 && skill >= 1 && skill <= 18
          ? skill
          : !isPremier && !isComp && skill >= 1 && skill <= 18
            ? skill
            : null,
      hsPercent: round1(
        g.accuracyHead != null && g.accuracyHead <= 1
          ? g.accuracyHead * 100
          : g.accuracyHead,
      ),
      leetifyRating: playerRating(g, steamId),
      kills,
      deaths,
      kd:
        kills != null && deaths != null && deaths > 0
          ? round2(kills / deaths)
          : kills != null && deaths === 0
            ? kills
            : null,
      tRating: scaleLeetifyRating(g.tLeetifyRating),
      ctRating: scaleLeetifyRating(g.ctLeetifyRating),
      isCs2: g.isCs2 ?? null,
      hasBannedPlayer: Boolean(g.hasBannedPlayer),
    };
  });
}

export function deriveMapStats(
  games: WebsiteGame[],
  steamId: string,
  limit = 100,
): LeetifyMapStats[] {
  const recent = games.filter((g) => g.isCs2 !== false).slice(0, limit);
  const byMap = new Map<
    string,
    {
      matches: number;
      wins: number;
      ratingSum: number;
      ratingN: number;
      tSum: number;
      tN: number;
      ctSum: number;
      ctN: number;
    }
  >();

  for (const g of recent) {
    const map = g.mapName;
    if (!map) continue;
    let bucket = byMap.get(map);
    if (!bucket) {
      bucket = {
        matches: 0,
        wins: 0,
        ratingSum: 0,
        ratingN: 0,
        tSum: 0,
        tN: 0,
        ctSum: 0,
        ctN: 0,
      };
      byMap.set(map, bucket);
    }
    bucket.matches += 1;
    if ((g.matchResult || "").toLowerCase() === "win") bucket.wins += 1;

    const rating = playerRating(g, steamId);
    if (rating != null) {
      bucket.ratingSum += rating;
      bucket.ratingN += 1;
    }
    const t = scaleLeetifyRating(g.tLeetifyRating);
    if (t != null) {
      bucket.tSum += t;
      bucket.tN += 1;
    }
    const ct = scaleLeetifyRating(g.ctLeetifyRating);
    if (ct != null) {
      bucket.ctSum += ct;
      bucket.ctN += 1;
    }
  }

  return [...byMap.entries()]
    .map(([map, b]) => ({
      map,
      matches: b.matches,
      winRate: b.matches > 0 ? Math.round((b.wins / b.matches) * 1000) / 10 : null,
      leetifyRating: b.ratingN > 0 ? round2(b.ratingSum / b.ratingN) : null,
      tRating: b.tN > 0 ? round2(b.tSum / b.tN) : null,
      ctRating: b.ctN > 0 ? round2(b.ctSum / b.ctN) : null,
    }))
    .sort((a, b) => b.matches - a.matches)
    .slice(0, 8);
}

/** Solo / party stack mix from recent games with known partySize. */
export function deriveStackStats(
  games: WebsiteGame[],
  sampleTarget = 100,
): LeetifyStackStats | null {
  let solo = 0;
  let stack2to4 = 0;
  let stack5 = 0;
  let sampled = 0;

  for (const g of games) {
    if (sampled >= sampleTarget) break;
    const size = g.partySize;
    if (size == null || size < 1) continue;
    sampled += 1;
    if (size <= 1) solo += 1;
    else if (size <= 4) stack2to4 += 1;
    else stack5 += 1;
  }

  if (sampled === 0) return null;

  const pct = (n: number) => Math.round((n / sampled) * 1000) / 10;
  return {
    soloPercent: pct(solo),
    stack2to4Percent: pct(stack2to4),
    stack5Percent: pct(stack5),
    sampleSize: sampled,
  };
}

/** Average HS% / preaim / reaction from recent games (website path). */
export function deriveAimExtras(
  games: WebsiteGame[],
  limit = 30,
): DerivedAimExtras {
  let hsSum = 0;
  let hsN = 0;
  let preaimSum = 0;
  let preaimN = 0;
  let ttdSum = 0;
  let ttdN = 0;

  // Walk newest-first; skip empty placeholders until we fill the sample.
  for (const g of games) {
    if (hsN >= limit && preaimN >= limit && ttdN >= limit) break;

    if (hsN < limit && g.accuracyHead != null && g.accuracyHead > 0) {
      const hs =
        g.accuracyHead <= 1 ? g.accuracyHead * 100 : g.accuracyHead;
      hsSum += hs;
      hsN += 1;
    }
    if (preaimN < limit && g.preaim != null && g.preaim > 0) {
      preaimSum += g.preaim;
      preaimN += 1;
    }
    if (ttdN < limit && g.reactionTime != null && g.reactionTime > 0) {
      // Website games store seconds (e.g. 0.48); public API uses ms.
      const ms =
        g.reactionTime <= 10 ? g.reactionTime * 1000 : g.reactionTime;
      ttdSum += ms;
      ttdN += 1;
    }
  }

  return {
    hsPercent: hsN > 0 ? round1(hsSum / hsN) : null,
    preaim: preaimN > 0 ? round1(preaimSum / preaimN) : null,
    timeToDamageMs: ttdN > 0 ? Math.round(ttdSum / ttdN) : null,
  };
}

export function parseTeammates(raw: WebsiteTeammate[]): LeetifyTeammate[] {
  return raw
    .filter((t) => t.steam64Id)
    .map((t) => {
      const skill = t.rank?.skillLevel ?? 0;
      const type = (t.rank?.type || "").toLowerCase();
      return {
        steamId: t.steam64Id!,
        name: t.steamNickname ?? "Unknown",
        avatarUrl: t.steamAvatarUrl ?? null,
        matchesTogether: t.matchesPlayedTogether ?? 0,
        winRateTogether:
          t.winRateTogether != null
            ? Math.round(t.winRateTogether * 1000) / 10
            : null,
        playerRating: scaleLeetifyRating(t.profileUserLeetifyRating),
        teammateRating: scaleLeetifyRating(t.teammateLeetifyRating),
        premierRating:
          type === "premier" && skill > 18 ? skill : null,
        competitiveRank:
          type !== "premier" && skill >= 1 && skill <= 18 ? skill : null,
        isBanned: Boolean(t.isBanned),
      };
    })
    .sort((a, b) => b.matchesTogether - a.matchesTogether);
}
