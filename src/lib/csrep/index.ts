import "server-only";

import {
  apiProxyHeaders,
  apiProxyUrl,
  isApiProxyEnabled,
} from "@/lib/apiProxy";
import type { CsrepMetric, CsrepPlayerStats, CsrepProfile } from "@/lib/types";

const DEFAULT_BASE = "https://csrep.gg/api";
const MAX_STATS_PAGES = 3;

type ApiEnvelope<T> = {
  status?: string;
  result?: T;
};

function getCsrepSecret(): string | null {
  return process.env.CSREP_API_KEY?.trim() || null;
}

function getCsrepKeyId(): string | null {
  return process.env.CSREP_API_KEY_ID?.trim() || null;
}

function getCsrepBase(): string {
  return (process.env.CSREP_API_BASE?.trim() || DEFAULT_BASE).replace(/\/$/, "");
}

/** True when CSRep can be called (local key or CF proxy with CSREP_API_KEY in worker secrets). */
export function isCsrepConfigured(): boolean {
  return Boolean(getCsrepSecret()) || isApiProxyEnabled();
}

function csrepAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const secret = getCsrepSecret();
  const keyId = getCsrepKeyId();
  if (secret) {
    headers["X-API-Key"] = secret;
  }
  if (keyId) {
    headers["X-API-Key-Id"] = keyId;
    headers["X-API-Key-ID"] = keyId;
  }
  return headers;
}

async function csrepGet(path: string, searchParams?: Record<string, string>) {
  const useProxy = isApiProxyEnabled();
  const secret = getCsrepSecret();
  if (!useProxy && !secret) {
    throw new Error("CSREP_API_KEY is not configured");
  }

  const url = useProxy
    ? apiProxyUrl("csrep", path.replace(/^\//, ""), searchParams)
    : (() => {
        const u = new URL(`${getCsrepBase()}${path.startsWith("/") ? path : `/${path}`}`);
        if (searchParams) {
          for (const [k, v] of Object.entries(searchParams)) {
            u.searchParams.set(k, v);
          }
        }
        return u.toString();
      })();

  const headers: Record<string, string> = { Accept: "application/json" };
  if (useProxy) {
    Object.assign(headers, apiProxyHeaders());
  } else {
    Object.assign(headers, csrepAuthHeaders());
  }

  const res = await fetch(url, { headers, next: { revalidate: 180 } });
  return res;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value.replace(/%/g, "").trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t || null;
}

function pick(obj: Record<string, unknown> | null, ...keys: string[]): unknown {
  if (!obj) return undefined;
  for (const key of keys) {
    if (key in obj && obj[key] != null) return obj[key];
  }
  return undefined;
}

function metric(value: unknown, delta?: unknown, verdict?: unknown): CsrepMetric {
  const rec = asRecord(value);
  if (rec) {
    return {
      value: num(pick(rec, "value", "raw", "score", "avg")),
      delta: num(pick(rec, "delta", "diff", "change")),
      verdict: str(pick(rec, "verdict", "label", "status", "rating")),
    };
  }
  return {
    value: num(value),
    delta: num(delta),
    verdict: str(verdict),
  };
}

function mapMetrics(raw: unknown): CsrepProfile["metrics"] {
  const obj = asRecord(raw) ?? {};
  const get = (...keys: string[]) => metric(pick(obj, ...keys));

  return {
    timeToDamageMs: get("time_to_damage", "timeToDamage", "ttd", "ttdMs"),
    reactionMs: get("reaction_time", "reactionTime", "reactionMs"),
    crosshairDeg: get("crosshair_placement", "crosshairPlacement", "crosshairDeg"),
    preaimDeg: get("preaim", "preaimDeg"),
    kd: get("kd", "kd_ratio", "kdRatio"),
    adr: get("adr"),
    aimAccuracy: get("aim_accuracy", "aimAccuracy", "aimAcc"),
    headAccuracy: get("head_accuracy", "headAccuracy", "hs_accuracy", "headAcc"),
    wallbangPct: get("wallbang", "wallbang_kill_pct", "wallbangPct"),
    smokeKillPct: get("smoke", "smoke_kill_pct", "smokeKillPct"),
    hltvRating: get("hltv_rating", "hltvRating", "rating"),
    kast: get("kast"),
  };
}

function mapPlayerEntity(steamId: string, entity: Record<string, unknown>): CsrepProfile {
  const user = asRecord(entity.user);
  const steamIdFromUser = str(pick(user, "steam_id", "steamId"));

  return {
    id: str(entity.id),
    steamId: steamIdFromUser ?? steamId,
    name: str(entity.name),
    avatar: str(entity.avatar),
    trustRating: num(entity.trust_rating),
    premierElo: num(entity.premier_elo),
    cs2Hours: num(entity.cs2_hours),
    inventoryValue: num(entity.inventory_value),
    steamLevel: num(entity.steam_level),
    steamCreatedAt: str(entity.steam_created_at),
    faceitId: str(entity.faceit_id),
    faceitUrl: str(entity.faceit_url),
    faceitLevel: num(entity.faceit_level),
    faceitElo: num(entity.faceit_elo),
    faceitLatestMatchDate: str(entity.faceit_latest_match_date),
    refreshedAt: str(entity.refreshed_at),
    bans: asRecord(entity.bans),
    commendations: asRecord(entity.commendations),
    mapRanks: asRecord(entity.map_ranks),
    privacy: asRecord(entity.privacy),
    anomalies: null,
    sba: null,
    sbaDelta: null,
    metrics: mapMetrics(null),
    stats: null,
    profileUrl: `https://csrep.gg/player/${steamId}`,
    rawKeys: Object.keys(entity).slice(0, 48),
  };
}

function unwrapResult(json: unknown): unknown {
  const root = asRecord(json);
  if (!root) return json;
  if ("result" in root) return root.result;
  return json;
}

function enrichFromStats(profile: CsrepProfile, statsPayload: unknown): CsrepProfile {
  const root = asRecord(statsPayload);
  if (!root) return profile;

  const nested =
    asRecord(pick(root, "stats", "window", "overview", "aggregates", "summary")) ?? root;

  const trust = num(
    pick(nested, "trust", "trust_rating", "trustRating", "trust_score"),
  );
  const anomalies = num(
    pick(nested, "anomalies", "anomalies_detected", "anomaliesDetected", "anomaly_pct"),
  );
  const sba = num(
    pick(nested, "sba", "stats_based_analysis", "statsBasedAnalysis", "sba_score"),
  );
  const sbaDelta = num(pick(nested, "sba_delta", "sbaDelta", "stats_based_analysis_delta"));

  const metricsRaw = pick(
    nested,
    "metrics",
    "sba_metrics",
    "stats",
    "window_stats",
    "overview_stats",
  );

  const matchCount = num(
    pick(nested, "match_count", "matches", "sample_size", "sampleSize"),
  );
  const fromMatch = num(pick(root, "from_match", "fromMatch", "next_from_match"));

  const stats: CsrepPlayerStats = {
    fromMatch,
    matchCount,
    sampleLabel: str(pick(nested, "label", "window_label", "windowLabel")),
    metrics: mapMetrics(metricsRaw),
    rawKeys: Object.keys(root).slice(0, 48),
  };

  return {
    ...profile,
    trustRating: profile.trustRating ?? trust,
    anomalies: anomalies ?? profile.anomalies,
    sba: sba ?? profile.sba,
    sbaDelta: sbaDelta ?? profile.sbaDelta,
    metrics: mapMetrics(metricsRaw),
    stats,
  };
}

async function fetchPlayerEntity(steamId: string): Promise<Record<string, unknown> | null> {
  const byIds = await csrepGet("/players", { ids: steamId });
  if (byIds.status === 404) return null;
  if (byIds.ok) {
    const json = (await byIds.json()) as ApiEnvelope<Record<string, unknown>[]>;
    const first = unwrapResult(json);
    if (Array.isArray(first) && first[0]) return first[0] as Record<string, unknown>;
  }

  const byId = await csrepGet(`/players/${encodeURIComponent(steamId)}`);
  if (byId.status === 404) return null;
  if (byId.status === 401 || byId.status === 403) {
    throw new Error(`CSRep API unauthorized (${byId.status}). Check CSREP_API_KEY.`);
  }
  if (!byId.ok) {
    throw new Error(`CSRep GET /players/{id} failed (${byId.status})`);
  }

  const json = await byId.json();
  const entity = unwrapResult(json);
  return asRecord(entity);
}

/**
 * Undocumented stats window — GET /players/{steamId}/stats?from_match=N
 * Paginates up to MAX_STATS_PAGES when next_from_match is returned.
 */
export async function getCsrepPlayerStats(
  steamId: string,
  fromMatch = 0,
): Promise<unknown | null> {
  if (!isCsrepConfigured()) return null;

  let cursor = fromMatch;
  let merged: unknown = null;

  for (let page = 0; page < MAX_STATS_PAGES; page++) {
    const res = await csrepGet(
      `/players/${encodeURIComponent(steamId)}/stats`,
      { from_match: String(cursor) },
    );

    if (res.status === 404) return merged;
    if (res.status === 401 || res.status === 403) {
      throw new Error(`CSRep stats unauthorized (${res.status})`);
    }
    if (res.status === 405 || res.status === 501) return merged;
    if (!res.ok) {
      if (page === 0) throw new Error(`CSRep GET /stats failed (${res.status})`);
      break;
    }

    const json: unknown = await res.json();
    merged = json;

    const root = asRecord(unwrapResult(json)) ?? asRecord(json);
    const next = num(pick(root, "next_from_match", "nextFromMatch", "next_match"));
    if (next == null || next === cursor) break;
    cursor = next;
  }

  return merged;
}

/** Fetch CSRep player + optional stats window. Soft-fails stats when unavailable. */
export async function getCsrepProfile(steamId: string): Promise<CsrepProfile | null> {
  if (!isCsrepConfigured()) {
    throw new Error("CSREP_API_KEY / API proxy is not configured");
  }

  const entity = await fetchPlayerEntity(steamId);
  if (!entity) return null;

  let profile = mapPlayerEntity(steamId, entity);

  try {
    const statsJson = await getCsrepPlayerStats(steamId, 0);
    if (statsJson != null) {
      profile = enrichFromStats(profile, unwrapResult(statsJson) ?? statsJson);
    }
  } catch {
    /* stats endpoint optional — player entity still useful */
  }

  return profile;
}
