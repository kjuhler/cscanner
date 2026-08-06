import type { CsapiStats } from "@/lib/types";

const DEFAULT_BASE = "https://csapi.kju.dk";
const TIMEOUT_MS = 12_000;

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
 * Fetch aim/combat window stats from csapi.kju.dk/{steamId64}.
 * Requires CSAPI_API_KEY (header X-API-Key). Soft-fails to null on 404.
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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${getCsapiBase()}/${encodeURIComponent(id)}`, {
      headers: {
        Accept: "application/json",
        "X-API-Key": key,
      },
      signal: controller.signal,
      next: { revalidate: 120 },
    });

    if (res.status === 404) return null;
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `csapi unauthorized (${res.status}). Check CSAPI_API_KEY.`,
      );
    }
    if (!res.ok) {
      throw new Error(`csapi failed (${res.status})`);
    }

    const json = (await res.json()) as CsapiRaw;
    const mapped = mapStats(id, json);
    const hasAny = [
      mapped.timeToDamageMs,
      mapped.reactionTimeMs,
      mapped.kd,
      mapped.adr,
      mapped.hltvRating2,
    ].some((v) => v != null);
    return hasAny ? mapped : null;
  } finally {
    clearTimeout(timer);
  }
}
