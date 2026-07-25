const STEAM64_BASE = BigInt("76561197960265728");
const SCOPE_RATINGS_URL =
  "https://app.scope.gg/api/dashboard/public/v5/getRatings";

const WEAPON_PREF = ["Rifle", "SniperRifle", "Pistol", "SMG"] as const;

type ScopeMetric = {
  ID?: string;
  ConstructedFromWeaponClasses?: string[] | null;
  ShowToRoles?: string[] | null;
  CountUnit?: string | null;
  Aggregated?: Array<number[] | null> | null;
  Values?: Array<number | null> | null;
};

export type ScopeAimStats = {
  timeToDamageMs: number | null;
  medianKillTimeMs: number | null;
  hsPercent: number | null;
  accuracySpotted: number | null;
  firstBulletAccuracy: number | null;
  /** Approx. HE damage per nade (Scope AverageHEDamage). */
  averageHeDamage: number | null;
  sampleMatches: number | null;
  profileUrl: string;
  accountId: number;
};

export function steamId64ToAccountId(steamId64: string): number | null {
  try {
    const id = BigInt(steamId64.trim());
    if (id < STEAM64_BASE) return null;
    const accountId = id - STEAM64_BASE;
    if (accountId <= BigInt(0) || accountId > BigInt(Number.MAX_SAFE_INTEGER)) {
      return null;
    }
    return Number(accountId);
  } catch {
    return null;
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function metricMid(m: ScopeMetric): number | null {
  const agg = m.Aggregated?.[0];
  if (
    Array.isArray(agg) &&
    agg.length >= 2 &&
    typeof agg[0] === "number" &&
    typeof agg[1] === "number" &&
    !Number.isNaN(agg[0]) &&
    !Number.isNaN(agg[1])
  ) {
    return (agg[0] + agg[1]) / 2;
  }

  const vals = (m.Values ?? []).filter(
    (v): v is number => typeof v === "number" && !Number.isNaN(v),
  );
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function weaponScore(m: ScopeMetric): number {
  const weapons = m.ConstructedFromWeaponClasses ?? [];
  for (let i = 0; i < WEAPON_PREF.length; i++) {
    if (weapons.includes(WEAPON_PREF[i]!)) return WEAPON_PREF.length - i;
  }
  if ((m.ShowToRoles ?? []).includes("Rifler")) return 1;
  return 0;
}

function pickMetric(
  metrics: ScopeMetric[],
  id: string,
): ScopeMetric | null {
  const matches = metrics.filter(
    (m) => m.ID === id && metricMid(m) != null,
  );
  if (matches.length === 0) return null;
  matches.sort((a, b) => weaponScore(b) - weaponScore(a));
  return matches[0] ?? null;
}

function asPercent(raw: number | null, unit: string | null | undefined): number | null {
  if (raw == null || Number.isNaN(raw)) return null;
  if (unit === "%" || raw <= 1) return round1(raw * 100);
  return round1(raw);
}

function asMs(raw: number | null, unit: string | null | undefined): number | null {
  if (raw == null || Number.isNaN(raw)) return null;
  if (unit === "s" || raw <= 10) return Math.round(raw * 1000);
  return Math.round(raw);
}

function collectMetrics(payload: unknown): ScopeMetric[] {
  const ratings = (payload as { Ratings?: { StatsBySide?: unknown } })
    ?.Ratings?.StatsBySide as
    | {
        GeneralStats?: { Metrics?: ScopeMetric[] };
      }
    | undefined;
  const metrics = ratings?.GeneralStats?.Metrics;
  return Array.isArray(metrics) ? metrics : [];
}

function sampleMatchCount(payload: unknown): number | null {
  const chunks = (
    payload as {
      Ratings?: {
        PeriodsByRole?: { AllRoles?: { Chunks?: unknown[] } };
      };
    }
  )?.Ratings?.PeriodsByRole?.AllRoles?.Chunks;
  if (!Array.isArray(chunks) || chunks.length === 0) return null;
  // Chunks often include a boundary marker; prefer Values length via metrics.
  return Math.max(0, chunks.length - 1);
}

/**
 * Public Scope dashboard ratings (no login). Soft-fails to null.
 */
export async function getScopeAimStats(
  steamId64: string,
): Promise<ScopeAimStats | null> {
  const accountId = steamId64ToAccountId(steamId64);
  if (accountId == null) return null;

  const profileUrl = `https://app.scope.gg/profile/${accountId}`;

  try {
    const res = await fetch(SCOPE_RATINGS_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Origin: "https://app.scope.gg",
        Referer: profileUrl,
      },
      body: JSON.stringify({
        steamAccountId: accountId,
        sources: ["shareCode"],
      }),
      cache: "no-store",
    });

    if (!res.ok) return null;

    const data: unknown = await res.json();
    const metrics = collectMetrics(data);
    if (metrics.length === 0) return null;

    const damage = pickMetric(metrics, "MedianDamageTimeByClass");
    const kill = pickMetric(metrics, "MedianKillTimeByClass");
    const hs = pickMetric(metrics, "HeadshotPercentByClass");
    const spotted = pickMetric(metrics, "AccuracySpottedByClass");
    const firstBullet = pickMetric(metrics, "FirstBulletAccuracyByClass");
    const he = pickMetric(metrics, "AverageHEDamage");

    const timeToDamageMs = asMs(metricMid(damage ?? {}), damage?.CountUnit);
    const medianKillTimeMs = asMs(metricMid(kill ?? {}), kill?.CountUnit);
    const hsPercent = asPercent(metricMid(hs ?? {}), hs?.CountUnit);
    const accuracySpotted = asPercent(
      metricMid(spotted ?? {}),
      spotted?.CountUnit,
    );
    const firstBulletAccuracy = asPercent(
      metricMid(firstBullet ?? {}),
      firstBullet?.CountUnit,
    );
    const heRaw = metricMid(he ?? {});
    const averageHeDamage =
      heRaw == null || Number.isNaN(heRaw) ? null : round1(heRaw);

    if (
      timeToDamageMs == null &&
      medianKillTimeMs == null &&
      hsPercent == null &&
      accuracySpotted == null &&
      firstBulletAccuracy == null &&
      averageHeDamage == null
    ) {
      return null;
    }

    return {
      timeToDamageMs,
      medianKillTimeMs,
      hsPercent,
      accuracySpotted,
      firstBulletAccuracy,
      averageHeDamage,
      sampleMatches: sampleMatchCount(data),
      profileUrl,
      accountId,
    };
  } catch {
    return null;
  }
}
