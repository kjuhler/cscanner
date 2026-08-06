import type { CsapiStats } from "@/lib/types";

const DEFAULT_BASE = "https://csapi.kju.dk";
/** Cached lookups are usually fast; force-refresh can take a while to compute. */
const TIMEOUT_CACHED_MS = 12_000;
const TIMEOUT_REFRESH_MS = 45_000;

function getCsapiBase(): string {
  return (process.env.CSAPI_BASE?.trim() || DEFAULT_BASE).replace(/\/$/, "");
}

function getCsapiKey(): string | null {
  return process.env.CSAPI_API_KEY?.trim() || null;
}

export function isCsapiConfigured(): boolean {
  return Boolean(getCsapiKey());
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

type CsapiRaw = {
  ttd?: unknown;
  reaction_time?: unknown;
  crosshair_placement?: unknown;
  preaim?: unknown;
  kd_ratio?: unknown;
  adr?: unknown;
  accuracy?: unknown;
  accuracy_head?: unknown;
  wallbang_kill_percent?: unknown;
  smoke_kill_percent?: unknown;
  hltv_rating_2?: unknown;
  kast?: unknown;
};

function mapStats(steamId: string, raw: CsapiRaw): CsapiStats {
  return {
    steamId,
    timeToDamageMs: num(raw.ttd),
    reactionTimeMs: num(raw.reaction_time),
    crosshairPlacement: num(raw.crosshair_placement),
    preaim: num(raw.preaim),
    kd: num(raw.kd_ratio),
    adr: num(raw.adr),
    /** 0–1 ratio from API; UI multiplies for display. */
    accuracy: num(raw.accuracy),
    accuracyHead: num(raw.accuracy_head),
    wallbangKillPercent: num(raw.wallbang_kill_percent),
    smokeKillPercent: num(raw.smoke_kill_percent),
    hltvRating2: num(raw.hltv_rating_2),
    kast: num(raw.kast),
    profileUrl: `${getCsapiBase()}/${steamId}`,
  };
}

/**
 * Upstream sometimes returns a full zero payload from a stale cache entry.
 * Treat that as "no data" — never display 0ms / 0.00 as real combat stats.
 */
function hasUsefulStats(mapped: CsapiStats): boolean {
  return [
    mapped.timeToDamageMs,
    mapped.reactionTimeMs,
    mapped.crosshairPlacement,
    mapped.preaim,
    mapped.kd,
    mapped.adr,
    mapped.accuracy,
    mapped.accuracyHead,
    mapped.hltvRating2,
    mapped.kast,
  ].some((v) => v != null && v > 0);
}

async function fetchCsapiRaw(
  steamId: string,
  key: string,
  opts: { refresh: boolean; timeoutMs: number; cache: RequestCache | undefined },
): Promise<CsapiRaw | null> {
  const qs = opts.refresh ? "?r=1" : "";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  try {
    const res = await fetch(
      `${getCsapiBase()}/${encodeURIComponent(steamId)}${qs}`,
      {
        headers: {
          Accept: "application/json",
          "X-API-Key": key,
        },
        signal: controller.signal,
        ...(opts.cache
          ? { cache: opts.cache }
          : { next: { revalidate: 300 } }),
      },
    );

    if (res.status === 404) return null;
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `csapi unauthorized (${res.status}). Check CSAPI_API_KEY.`,
      );
    }
    if (!res.ok) {
      throw new Error(`csapi failed (${res.status})`);
    }

    return (await res.json()) as CsapiRaw;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch aim/combat window stats from csapi.kju.dk/{steamId64}.
 * Requires CSAPI_API_KEY (header X-API-Key). Soft-fails to null on 404.
 *
 * Upstream cache often returns all zeros; we retry with ?r=1 to force recompute.
 */
export async function getCsapiStats(
  steamId64: string,
): Promise<CsapiStats | null> {
  const id = steamId64.trim();
  if (!/^\d{17}$/.test(id)) return null;

  const key = getCsapiKey();
  if (!key) {
    throw new Error("CSAPI_API_KEY is not configured");
  }

  // Prefer cached lookup, but never persist/trust an all-zero stub.
  let mapped: CsapiStats | null = null;
  try {
    const raw = await fetchCsapiRaw(id, key, {
      refresh: false,
      timeoutMs: TIMEOUT_CACHED_MS,
      cache: "no-store",
    });
    mapped = raw ? mapStats(id, raw) : null;
  } catch (err) {
    // Timeout / transient — fall through to force-refresh.
    const aborted =
      (err instanceof Error && /aborted|abort|timeout/i.test(err.message)) ||
      (typeof err === "object" &&
        err !== null &&
        "name" in err &&
        (err as { name: string }).name === "AbortError");
    if (!aborted) throw err;
  }

  if (!mapped || !hasUsefulStats(mapped)) {
    const raw = await fetchCsapiRaw(id, key, {
      refresh: true,
      timeoutMs: TIMEOUT_REFRESH_MS,
      cache: undefined,
    });
    mapped = raw ? mapStats(id, raw) : null;
  }

  if (!mapped || !hasUsefulStats(mapped)) return null;
  return mapped;
}
