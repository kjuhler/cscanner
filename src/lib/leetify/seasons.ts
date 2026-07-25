import type { Cs2SeasonRank, CsgoRankSummary } from "@/lib/types";

/** Premier season windows — mirrored from Leetify client (`getSeasonForDate`). */
export const CS2_PREMIER_SEASONS = [
  {
    number: 0,
    title: "Beta Season",
    from: "2023-08-31T00:00:00.000Z",
    to: "2023-09-27T20:29:59.999Z",
  },
  {
    number: 1,
    title: "Season One",
    from: "2023-09-27T20:30:00.000Z",
    to: "2025-01-28T23:59:59.999Z",
  },
  {
    number: 2,
    title: "Season Two",
    from: "2025-01-29T00:00:00.000Z",
    to: "2025-07-15T19:59:59.999Z",
  },
  {
    number: 3,
    title: "Season Three",
    from: "2025-07-15T20:00:00.000Z",
    to: "2026-01-21T19:59:59.999Z",
  },
  {
    number: 4,
    title: "Season Four",
    from: "2026-01-21T20:00:00.000Z",
    to: "2026-07-08T19:59:59.999Z",
  },
  {
    number: 5,
    title: "Season Five",
    from: "2026-07-08T20:00:00.000Z",
    to: null as string | null,
  },
] as const;

export type SeasonGame = {
  isCs2?: boolean;
  gameFinishedAt?: string;
  rankType?: number | null;
  skillLevel?: number | null;
  matchResult?: string | null;
};

const PREMIER_RANK_TYPE = 11;
const COMPETITIVE_RANK_TYPE = 12;

function seasonForDate(iso: string) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return (
    CS2_PREMIER_SEASONS.find((s) => {
      const from = new Date(s.from).getTime();
      const to = s.to ? new Date(s.to).getTime() : Number.POSITIVE_INFINITY;
      return t >= from && t <= to;
    }) ?? null
  );
}

export function deriveCs2SeasonRanks(games: SeasonGame[]): Cs2SeasonRank[] {
  const byNumber = new Map<
    number,
    {
      title: string;
      matches: number;
      wins: number;
      premierMin: number | null;
      premierMax: number | null;
      competitiveMin: number | null;
      competitiveMax: number | null;
    }
  >();

  for (const game of games) {
    if (!game.isCs2 || !game.gameFinishedAt) continue;
    const season = seasonForDate(game.gameFinishedAt);
    if (!season || season.number === 0) continue;

    let bucket = byNumber.get(season.number);
    if (!bucket) {
      bucket = {
        title: season.title,
        matches: 0,
        wins: 0,
        premierMin: null,
        premierMax: null,
        competitiveMin: null,
        competitiveMax: null,
      };
      byNumber.set(season.number, bucket);
    }

    bucket.matches += 1;
    if ((game.matchResult || "").toLowerCase() === "win") bucket.wins += 1;

    const skill = game.skillLevel ?? 0;
    if (skill <= 0) continue;

    if (game.rankType === PREMIER_RANK_TYPE) {
      bucket.premierMin =
        bucket.premierMin == null ? skill : Math.min(bucket.premierMin, skill);
      bucket.premierMax =
        bucket.premierMax == null ? skill : Math.max(bucket.premierMax, skill);
    }

    if (game.rankType === COMPETITIVE_RANK_TYPE && skill <= 18) {
      bucket.competitiveMin =
        bucket.competitiveMin == null
          ? skill
          : Math.min(bucket.competitiveMin, skill);
      bucket.competitiveMax =
        bucket.competitiveMax == null
          ? skill
          : Math.max(bucket.competitiveMax, skill);
    }
  }

  return [...byNumber.entries()]
    .map(([seasonNumber, b]) => ({
      seasonNumber,
      title: b.title,
      matches: b.matches,
      wins: b.wins,
      winRate:
        b.matches > 0 ? Math.round((b.wins / b.matches) * 1000) / 10 : null,
      premierMin: b.premierMin,
      premierMax: b.premierMax,
      competitiveMin: b.competitiveMin,
      competitiveMax: b.competitiveMax,
    }))
    .filter(
      (s) =>
        s.premierMin != null ||
        s.premierMax != null ||
        s.competitiveMin != null ||
        s.competitiveMax != null,
    )
    .sort((a, b) => b.seasonNumber - a.seasonNumber);
}

export function deriveCsgoRankSummary(
  games: SeasonGame[],
): CsgoRankSummary | null {
  let matches = 0;
  let wins = 0;
  let rankMin: number | null = null;
  let rankMax: number | null = null;

  for (const game of games) {
    if (game.isCs2) continue;
    matches += 1;
    if ((game.matchResult || "").toLowerCase() === "win") wins += 1;

    const skill = game.skillLevel ?? 0;
    if (skill < 1 || skill > 18) continue;
    rankMin = rankMin == null ? skill : Math.min(rankMin, skill);
    rankMax = rankMax == null ? skill : Math.max(rankMax, skill);
  }

  if (matches === 0 || (rankMin == null && rankMax == null)) return null;

  return {
    matches,
    wins,
    winRate: matches > 0 ? Math.round((wins / matches) * 1000) / 10 : null,
    rankMin,
    rankMax,
  };
}
