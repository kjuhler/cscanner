import { revalidateTag } from "next/cache";
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

function isAbortError(err: unknown): boolean {
  if (err instanceof Error && /aborted|abort|timeout/i.test(err.message)) {
    return true;
  }
  return (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    (err as { name: string }).name === "AbortError"
  );
}

async function fetchCsapiRaw(
  steamId: string,
  key: string,
  opts: { refresh: boolean; timeoutMs: number },
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
        // Refresh must not reuse a stale Next cache entry; cached reads revalidate.
        ...(opts.refresh
          ? { cache: "no-store" as RequestCache }
          : {
              next: {
                revalidate: 300,
                tags: [`csapi-${steamId}`],
              },
            }),
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
 * Requires CSAPI_API_KEY (header X-API-Key). Soft-fails to null on 404,
 * zeros, or timeout. Does **not** call ?r=1 (that enqueues upstream).
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

  let mapped: CsapiStats | null = null;
  try {
    const raw = await fetchCsapiRaw(id, key, {
      refresh: false,
      timeoutMs: TIMEOUT_CACHED_MS,
    });
    mapped = raw ? mapStats(id, raw) : null;
  } catch (err) {
    if (isAbortError(err)) return null;
    throw err;
  }

  if (!mapped || !hasUsefulStats(mapped)) return null;
  return mapped;
}

/**
 * Force-refresh csapi stats (`?r=1`). Enqueues recompute upstream — call only
 * from an explicit user action, never from profile aggregate.
 */
export async function refreshCsapiStats(
  steamId64: string,
): Promise<CsapiStats | null> {
  const id = steamId64.trim();
  if (!/^\d{17}$/.test(id)) {
    throw new Error("Invalid Steam ID");
  }

  const key = getCsapiKey();
  if (!key) {
    throw new Error("CSAPI_API_KEY is not configured");
  }

  const raw = await fetchCsapiRaw(id, key, {
    refresh: true,
    timeoutMs: TIMEOUT_REFRESH_MS,
  });
  const mapped = raw ? mapStats(id, raw) : null;
  // Drop any stale Next data-cache entry from prior cached GETs.
  revalidateTag(`csapi-${id}`, "max");
  if (!mapped || !hasUsefulStats(mapped)) return null;
  return mapped;
}
