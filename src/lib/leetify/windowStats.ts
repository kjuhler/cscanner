import type { LeetifyMatchPlayerRow, LeetifyWindowStats } from "@/lib/types";

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function avg(
  rows: LeetifyMatchPlayerRow[],
  pick: (r: LeetifyMatchPlayerRow) => number | null,
): number | null {
  let sum = 0;
  let n = 0;
  for (const row of rows) {
    const v = pick(row);
    if (v == null || Number.isNaN(v)) continue;
    sum += v;
    n += 1;
  }
  if (n === 0) return null;
  return sum / n;
}

/**
 * Per-match KAST estimate when round events are unavailable.
 * Clamps K+A+S+T so contribution cannot exceed rounds; overestimates vs true KAST.
 */
function estimateMatchKast(row: LeetifyMatchPlayerRow): number | null {
  const rounds = row.roundsCount;
  if (rounds <= 0) return null;
  const k = Math.min(row.kills, rounds);
  const a = Math.min(row.assists, rounds);
  const s = Math.min(row.roundsSurvived, rounds);
  const t = Math.min(row.tradedDeathsSucceed, rounds);
  return Math.min(100, ((k + a + s + t) / rounds) * 100);
}

/**
 * HLTV Rating 2.0
 * Rating = 0.0073*KAST + 0.3591*KPR − 0.5329*DPR + 0.2372*Impact + 0.0032*ADR + 0.1587
 * Impact = 2.13*KPR + 0.42*APR − 0.41
 */
export function hltvRating2(
  kpr: number,
  dpr: number,
  apr: number,
  adr: number,
  kast: number,
): number {
  const impact = 2.13 * kpr + 0.42 * apr - 0.41;
  return (
    0.0073 * kast +
    0.3591 * kpr +
    -0.5329 * dpr +
    0.2372 * impact +
    0.0032 * adr +
    0.1587
  );
}

export function filterMatchesByDays(
  rows: LeetifyMatchPlayerRow[],
  days: number,
  nowMs = Date.now(),
): LeetifyMatchPlayerRow[] {
  if (days <= 0) return [];
  const cutoff = nowMs - days * 24 * 60 * 60 * 1000;
  return rows.filter((r) => {
    if (!r.finishedAt) return false;
    const t = Date.parse(r.finishedAt);
    return Number.isFinite(t) && t >= cutoff;
  });
}

export function filterMatchesByCount(
  rows: LeetifyMatchPlayerRow[],
  n: number,
): LeetifyMatchPlayerRow[] {
  return rows.slice(0, Math.max(0, n));
}

/** Aggregate match rows using totals-based formulas. */
export function aggregateMatchRows(
  rows: LeetifyMatchPlayerRow[],
): LeetifyWindowStats | null {
  if (rows.length === 0) return null;

  const kills = rows.reduce((s, r) => s + r.kills, 0);
  const deaths = rows.reduce((s, r) => s + r.deaths, 0);
  const assists = rows.reduce((s, r) => s + r.assists, 0);
  const damage = rows.reduce((s, r) => s + r.damage, 0);
  const rounds = rows.reduce((s, r) => s + r.roundsCount, 0);
  const shotsFired = rows.reduce((s, r) => s + r.shotsFired, 0);
  const shotsHit = rows.reduce((s, r) => s + r.shotsHit, 0);
  const hsKills = rows.reduce((s, r) => s + r.hsKills, 0);

  const kd =
    deaths > 0 ? round2(kills / deaths) : kills > 0 ? round2(kills) : null;

  const adr = rounds > 0 ? round1(damage / rounds) : null;

  const accuracy =
    shotsFired > 0 ? round1((shotsHit / shotsFired) * 100) : null;

  const hsPercent =
    shotsHit > 0 ? round1((hsKills / shotsHit) * 100) : null;

  const ttd = avg(rows, (r) => r.timeToDamageMs);
  const ttdRounded = ttd != null ? Math.round(ttd) : null;
  const preaimAvg = avg(rows, (r) => r.preaim);
  const preaimRounded = preaimAvg != null ? round1(preaimAvg) : null;

  let kastSum = 0;
  let kastN = 0;
  for (const row of rows) {
    const k = estimateMatchKast(row);
    if (k == null) continue;
    kastSum += k;
    kastN += 1;
  }
  const kast = kastN > 0 ? round1(kastSum / kastN) : null;

  const kpr = rounds > 0 ? kills / rounds : 0;
  const dprStat = rounds > 0 ? deaths / rounds : 0;
  const apr = rounds > 0 ? assists / rounds : 0;
  const hltv =
    kast != null && rounds > 0 && adr != null
      ? round2(hltvRating2(kpr, dprStat, apr, adr, kast))
      : null;

  const wins = rows.filter((r) => r.won === true).length;
  const decided = rows.filter((r) => r.won != null).length;
  const winRate = decided > 0 ? round1((wins / decided) * 100) : null;

  const leetifyRating = avg(rows, (r) => r.leetifyRating);

  return {
    sampleSize: rows.length,
    /** Leetify `stats[].reaction_time` (seconds→ms). */
    timeToDamageMs: ttdRounded,
    /**
     * Leetify does not expose a separate reaction-time field from TTD.
     * CSRep shows both; we surface the same `reaction_time` value here so
     * the Reaction Time tile is populated from the real payload key.
     */
    reactionTimeMs: ttdRounded,
    /** Leetify `stats[].preaim` (degrees). */
    crosshairPlacement: preaimRounded,
    /** Same Leetify `preaim` key — no second angle in the payload. */
    preaim: preaimRounded,
    kd,
    adr,
    accuracy,
    hsPercent,
    /** Not present in /v3/profile/matches (no wallbang_kills / similar). */
    wallbangKillPercent: null,
    /**
     * Not present as kill % — payload only has `smoke_thrown` (utility count),
     * not smoke kills. Cannot compute (smoke_kills / kills) * 100.
     */
    smokeKillPercent: null,
    hltvRating: hltv,
    kast,
    accuracyEnemySpotted: null,
    sprayAccuracy: null,
    leetifyRating: leetifyRating != null ? round2(leetifyRating) : null,
    winRate,
  };
}

export function aggregateMatchWindow(
  rows: LeetifyMatchPlayerRow[],
  n: number,
): LeetifyWindowStats | null {
  return aggregateMatchRows(filterMatchesByCount(rows, n));
}

export function buildLeetifyWindows(rows: LeetifyMatchPlayerRow[]): {
  last30: LeetifyWindowStats | null;
  last90: LeetifyWindowStats | null;
} | null {
  if (rows.length === 0) return null;
  const last30 = aggregateMatchRows(filterMatchesByCount(rows, 30));
  const last90 = aggregateMatchRows(filterMatchesByCount(rows, 90));
  if (!last30 && !last90) return null;
  return { last30, last90 };
}
