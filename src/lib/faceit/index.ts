import {
  apiProxyHeaders,
  apiProxyUrl,
  isApiProxyEnabled,
} from "@/lib/apiProxy";
import type {
  FaceitMapStats,
  FaceitMatch,
  FaceitPlayer,
  FaceitStats,
} from "@/lib/types";

function getFaceitKey(): string | null {
  return process.env.FACEIT_API_KEY || null;
}

/** True when FACEIT can be called (local key or CF proxy). */
export function isFaceitConfigured(): boolean {
  return Boolean(getFaceitKey()) || isApiProxyEnabled();
}

async function faceitGet<T>(path: string): Promise<T | null> {
  const useProxy = isApiProxyEnabled();
  const key = getFaceitKey();
  if (!useProxy && !key) {
    throw new Error("FACEIT_API_KEY is not configured");
  }

  const url = useProxy
    ? apiProxyUrl("faceit", `data/v4/${path.replace(/^\//, "")}`)
    : `https://open.faceit.com/data/v4${path}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (useProxy) {
    Object.assign(headers, apiProxyHeaders());
  } else if (key) {
    headers.Authorization = `Bearer ${key}`;
  }

  const res = await fetch(url, {
    headers,
    next: { revalidate: 120 },
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`FACEIT API ${path} failed (${res.status})`);
  }

  return res.json() as Promise<T>;
}

type FaceitPlayerResponse = {
  player_id: string;
  nickname: string;
  avatar: string;
  country: string;
  games?: {
    cs2?: {
      faceit_elo?: number;
      skill_level?: number;
      game_player_id?: string;
    };
  };
  faceit_url?: string;
};

export async function getFaceitPlayerBySteamId(
  steamId: string,
): Promise<FaceitPlayer | null> {
  const data = await faceitGet<FaceitPlayerResponse>(
    `/players?game=cs2&game_player_id=${encodeURIComponent(steamId)}`,
  );

  if (!data) return null;

  const cs2 = data.games?.cs2;
  const faceitUrl =
    data.faceit_url?.replace("{lang}", "en") ||
    `https://www.faceit.com/en/players/${encodeURIComponent(data.nickname)}`;

  return {
    playerId: data.player_id,
    nickname: data.nickname,
    avatarUrl: data.avatar || null,
    country: data.country || null,
    elo: cs2?.faceit_elo ?? null,
    skillLevel: cs2?.skill_level ?? null,
    faceitUrl,
  };
}

type FaceitStatsResponse = {
  lifetime?: Record<string, string | number | string[]>;
  segments?: Array<{
    type?: string;
    mode?: string;
    label?: string;
    stats?: Record<string, string | number | string[]>;
  }>;
};

function num(value: string | number | string[] | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number") return value;
  if (Array.isArray(value)) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export type FaceitStatsBundle = {
  lifetime: FaceitStats;
  maps: FaceitMapStats[];
};

export async function getFaceitStats(
  playerId: string,
): Promise<FaceitStatsBundle | null> {
  const data = await faceitGet<FaceitStatsResponse>(
    `/players/${playerId}/stats/cs2`,
  );
  if (!data?.lifetime) return null;

  const life = data.lifetime;
  const lifetime: FaceitStats = {
    matches: num(life["Matches"]),
    winRate: num(life["Win Rate %"]),
    kd: num(life["Average K/D Ratio"]),
    hsPercent: num(life["Average Headshots %"]),
    wins: num(life["Wins"]),
    averageAdr: num(life["ADR"]) ?? num(life["Average Damage per Round"]),
  };

  const maps: FaceitMapStats[] = (data.segments ?? [])
    .filter((seg) => {
      const label = (seg.label || "").toLowerCase();
      return (
        label.startsWith("de_") ||
        label.startsWith("cs_") ||
        seg.type === "Map" ||
        seg.mode === "5v5"
      );
    })
    .map((seg) => {
      const stats = seg.stats ?? {};
      const rawLabel = seg.label || "unknown";
      return {
        map: rawLabel.replace(/^de_|^cs_/, ""),
        matches: num(stats["Matches"]),
        winRate: num(stats["Win Rate %"]),
        kd: num(stats["Average K/D Ratio"]),
        hsPercent:
          num(stats["Average Headshots %"]) ??
          num(stats["Headshots per Match"]),
      };
    })
    .filter((m) => (m.matches ?? 0) > 0)
    .sort((a, b) => (b.matches ?? 0) - (a.matches ?? 0));

  return { lifetime, maps };
}

type FaceitHistoryResponse = {
  items?: Array<{
    match_id: string;
    finished_at?: number;
    game_mode?: string;
    competition_name?: string;
    results?: {
      winner?: string;
      score?: Record<string, number>;
    };
    teams?: Record<
      string,
      {
        team_id?: string;
        nickname?: string;
        players?: Array<{ player_id: string }>;
      }
    >;
    playing_players?: string[];
    elo?: string | number;
  }>;
};

export async function getFaceitMatchHistory(
  playerId: string,
  limit = 10,
): Promise<FaceitMatch[]> {
  const data = await faceitGet<FaceitHistoryResponse>(
    `/players/${playerId}/history?game=cs2&offset=0&limit=${limit}`,
  );

  if (!data?.items) return [];

  return data.items.map((item) => {
    let result: FaceitMatch["result"] = "unknown";
    const teams = item.teams ?? {};
    const winner = item.results?.winner;

    for (const [teamKey, team] of Object.entries(teams)) {
      const onTeam = team.players?.some((p) => p.player_id === playerId);
      if (onTeam && winner) {
        result = teamKey === winner || team.team_id === winner ? "win" : "loss";
        break;
      }
    }

    const scoreEntries = item.results?.score
      ? Object.values(item.results.score)
      : [];
    const score =
      scoreEntries.length === 2
        ? `${scoreEntries[0]}-${scoreEntries[1]}`
        : null;

    const mapName =
      item.competition_name ||
      (typeof item.game_mode === "string" ? item.game_mode : null);

    return {
      matchId: item.match_id,
      finishedAt: item.finished_at ?? null,
      gameMode: item.game_mode ?? null,
      map: mapName,
      result,
      elo: item.elo != null ? Number(item.elo) || null : null,
      score,
      faceitUrl: `https://www.faceit.com/en/cs2/room/${item.match_id}`,
    };
  });
}

type FaceitBansResponse = {
  items?: Array<{
    nickname?: string;
    type?: string;
    reason?: string;
    starts_at?: string;
    ends_at?: string;
  }>;
};

export async function getFaceitBans(playerId: string) {
  const data = await faceitGet<FaceitBansResponse>(
    `/players/${playerId}/bans?offset=0&limit=20`,
  );

  return (data?.items ?? []).map((ban) => ({
    type: ban.type ?? "ban",
    reason: ban.reason ?? null,
    startsAt: ban.starts_at ?? null,
    endsAt: ban.ends_at ?? null,
  }));
}

/**
 * Among Steam friends, count how many have a FACEIT CS2 profile with bans.
 * Caps sample size to keep page load reasonable.
 */
export async function getFaceitFriendBanStats(
  friendSteamIds: string[],
  options?: { limit?: number; concurrency?: number },
): Promise<{
  sampled: number;
  withFaceit: number;
  banned: number;
}> {
  const limit = options?.limit ?? 40;
  const concurrency = options?.concurrency ?? 6;
  const sample = friendSteamIds.slice(0, limit);

  let withFaceit = 0;
  let banned = 0;

  for (let i = 0; i < sample.length; i += concurrency) {
    const chunk = sample.slice(i, i + concurrency);
    const results = await Promise.all(
      chunk.map(async (steamId) => {
        try {
          const player = await getFaceitPlayerBySteamId(steamId);
          if (!player) return { found: false, banned: false };
          const bans = await getFaceitBans(player.playerId);
          return { found: true, banned: bans.length > 0 };
        } catch {
          return { found: false, banned: false };
        }
      }),
    );
    for (const r of results) {
      if (r.found) withFaceit += 1;
      if (r.banned) banned += 1;
    }
  }

  return { sampled: sample.length, withFaceit, banned };
}
