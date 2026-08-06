import {
  apiProxyHeaders,
  apiProxyUrl,
  isApiProxyEnabled,
} from "@/lib/apiProxy";

const STEAM_ID64_RE = /^7656119\d{10}$/;

export function isSteamId64(value: string): boolean {
  return STEAM_ID64_RE.test(value.trim());
}

/**
 * Parse Steam profile URL, vanity URL, SteamID64, or raw vanity into a lookup hint.
 * Accepts steamcommunity.com / .ai / .name (change TLD only) and similar hosts.
 */
export function parseSteamInput(raw: string): {
  kind: "steamid64" | "vanity";
  value: string;
} | null {
  const input = raw.trim();
  if (!input) return null;

  if (isSteamId64(input)) {
    return { kind: "steamid64", value: input };
  }

  try {
    const withProtocol = /^https?:\/\//i.test(input) ? input : `https://${input}`;
    const url = new URL(withProtocol);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();

    if (isSteamCommunityHost(host)) {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0] === "profiles" && parts[1] && isSteamId64(parts[1])) {
        return { kind: "steamid64", value: parts[1] };
      }
      if (parts[0] === "id" && parts[1]) {
        return { kind: "vanity", value: parts[1] };
      }
    }
  } catch {
    // not a URL — treat as vanity
  }

  // vanity names are alphanumeric + underscore/dash
  if (/^[a-zA-Z0-9_-]{2,64}$/.test(input)) {
    return { kind: "vanity", value: input };
  }

  return null;
}

function isSteamCommunityHost(host: string): boolean {
  if (host === "xsteamcommunity.com") return true;
  if (host.endsWith(".steamcommunity.com")) return true;
  // steamcommunity.com / .ai / .name / any single TLD swap
  return /^steamcommunity\.[a-z0-9-]+$/i.test(host);
}

function getSteamKey(): string {
  const key = process.env.STEAM_API_KEY;
  if (!key) {
    throw new Error("STEAM_API_KEY is not configured");
  }
  return key;
}

async function steamGet<T>(
  path: string,
  params: Record<string, string>,
): Promise<T> {
  const useProxy = isApiProxyEnabled();
  let url: string;

  if (useProxy) {
    url = apiProxyUrl("steam", path, params);
  } else {
    const direct = new URL(`https://api.steampowered.com/${path}`);
    direct.searchParams.set("key", getSteamKey());
    for (const [k, v] of Object.entries(params)) {
      direct.searchParams.set(k, v);
    }
    url = direct.toString();
  }

  const res = await fetch(url, {
    headers: useProxy ? apiProxyHeaders() : undefined,
    next: { revalidate: 120 },
  });

  if (!res.ok) {
    throw new Error(`Steam API ${path} failed (${res.status})`);
  }

  return res.json() as Promise<T>;
}

export async function resolveSteamId(raw: string): Promise<string | null> {
  const parsed = parseSteamInput(raw);
  if (!parsed) return null;

  if (parsed.kind === "steamid64") {
    return parsed.value;
  }

  type VanityResponse = {
    response: { success: number; steamid?: string; message?: string };
  };

  const data = await steamGet<VanityResponse>(
    "ISteamUser/ResolveVanityURL/v1/",
    { vanityurl: parsed.value },
  );

  if (data.response.success === 1 && data.response.steamid) {
    return data.response.steamid;
  }

  return null;
}

type PlayerSummaryResponse = {
  response: {
    players: Array<{
      steamid: string;
      personaname: string;
      profileurl: string;
      avatar: string;
      avatarmedium: string;
      avatarfull: string;
      communityvisibilitystate: number;
      timecreated?: number;
    }>;
  };
};

export async function getPlayerSummary(steamId: string) {
  const data = await steamGet<PlayerSummaryResponse>(
    "ISteamUser/GetPlayerSummaries/v2/",
    { steamids: steamId },
  );

  const player = data.response.players[0];
  if (!player) return null;

  const now = Math.floor(Date.now() / 1000);
  const timeCreated = player.timecreated ?? null;
  const accountAgeDays =
    timeCreated != null
      ? Math.floor((now - timeCreated) / (60 * 60 * 24))
      : null;

  return {
    steamId: player.steamid,
    personaName: player.personaname,
    avatarUrl: player.avatarmedium || player.avatar,
    avatarFullUrl: player.avatarfull || player.avatarmedium || player.avatar,
    profileUrl: player.profileurl,
    timeCreated,
    accountAgeDays,
    communityVisibility: player.communityvisibilitystate,
    profilePrivate: player.communityvisibilitystate < 3,
  };
}

type OwnedGamesResponse = {
  response: {
    games?: Array<{
      appid: number;
      playtime_forever: number;
    }>;
  };
};

export async function getCs2PlaytimeHours(
  steamId: string,
): Promise<number | null> {
  try {
    const data = await steamGet<OwnedGamesResponse>(
      "IPlayerService/GetOwnedGames/v1/",
      {
        steamid: steamId,
        include_appinfo: "0",
        include_played_free_games: "1",
      },
    );

    const game = data.response.games?.find((g) => g.appid === 730);
    if (!game) return null;
    return Math.round((game.playtime_forever / 60) * 10) / 10;
  } catch {
    return null;
  }
}

type SteamLevelResponse = {
  response: { player_level?: number };
};

export async function getSteamLevel(steamId: string): Promise<number | null> {
  try {
    const data = await steamGet<SteamLevelResponse>(
      "IPlayerService/GetSteamLevel/v1/",
      { steamid: steamId },
    );
    return data.response.player_level ?? null;
  } catch {
    return null;
  }
}

type FriendListResponse = {
  friendslist?: { friends: Array<{ steamid: string }> };
};

export async function getFriendIds(steamId: string): Promise<string[] | null> {
  try {
    const data = await steamGet<FriendListResponse>(
      "ISteamUser/GetFriendList/v1/",
      { steamid: steamId, relationship: "friend" },
    );
    const friends = data.friendslist?.friends;
    if (!friends) return null;
    return friends.map((f) => f.steamid).filter(Boolean);
  } catch {
    // Private friends list or API error
    return null;
  }
}

export async function getFriendCount(steamId: string): Promise<number | null> {
  const ids = await getFriendIds(steamId);
  return ids?.length ?? null;
}

type PlayerBansResponse = {
  players: Array<{
    SteamId: string;
    CommunityBanned: boolean;
    VACBanned: boolean;
    NumberOfVACBans: number;
    DaysSinceLastBan: number;
    NumberOfGameBans: number;
    EconomyBan: string;
  }>;
};

export async function getPlayerBans(steamId: string) {
  const data = await steamGet<PlayerBansResponse>(
    "ISteamUser/GetPlayerBans/v1/",
    { steamids: steamId },
  );

  const player = data.players[0];
  if (!player) return null;

  return {
    vacBanned: player.VACBanned,
    numberOfVacBans: player.NumberOfVACBans,
    numberOfGameBans: player.NumberOfGameBans,
    daysSinceLastBan: player.DaysSinceLastBan,
    communityBanned: player.CommunityBanned,
    economyBan: player.EconomyBan || "none",
  };
}

/** VAC / game-ban details across Steam friends (CS2-relevant). Batches of 100. */
export async function getSteamFriendBanStats(friendIds: string[]): Promise<{
  checked: number;
  banned: number;
  vacBanned: number;
  gameBanned: number;
  players: Array<{
    steamId: string;
    vacBanned: boolean;
    numberOfVacBans: number;
    numberOfGameBans: number;
    daysSinceLastBan: number;
  }>;
}> {
  if (friendIds.length === 0) {
    return {
      checked: 0,
      banned: 0,
      vacBanned: 0,
      gameBanned: 0,
      players: [],
    };
  }

  let vacBanned = 0;
  let gameBanned = 0;
  let banned = 0;
  let checked = 0;
  const bannedPlayers: Array<{
    steamId: string;
    vacBanned: boolean;
    numberOfVacBans: number;
    numberOfGameBans: number;
    daysSinceLastBan: number;
  }> = [];

  const chunkSize = 100;
  for (let i = 0; i < friendIds.length; i += chunkSize) {
    const chunk = friendIds.slice(i, i + chunkSize);
    const data = await steamGet<PlayerBansResponse>(
      "ISteamUser/GetPlayerBans/v1/",
      { steamids: chunk.join(",") },
    );
    for (const p of data.players ?? []) {
      checked += 1;
      const hasVac = p.VACBanned || p.NumberOfVACBans > 0;
      const hasGame = p.NumberOfGameBans > 0;
      if (hasVac) vacBanned += 1;
      if (hasGame) gameBanned += 1;
      if (hasVac || hasGame) {
        banned += 1;
        bannedPlayers.push({
          steamId: p.SteamId,
          vacBanned: hasVac,
          numberOfVacBans: p.NumberOfVACBans,
          numberOfGameBans: p.NumberOfGameBans,
          daysSinceLastBan: p.DaysSinceLastBan,
        });
      }
    }
  }

  return { checked, banned, vacBanned, gameBanned, players: bannedPlayers };
}

/** Batch GetPlayerSummaries (chunks of 100). */
export async function getPlayerSummaries(
  steamIds: string[],
): Promise<
  Map<
    string,
    {
      steamId: string;
      personaName: string;
      avatarUrl: string;
      profileUrl: string;
    }
  >
> {
  const out = new Map<
    string,
    {
      steamId: string;
      personaName: string;
      avatarUrl: string;
      profileUrl: string;
    }
  >();
  if (steamIds.length === 0) return out;

  const chunkSize = 100;
  for (let i = 0; i < steamIds.length; i += chunkSize) {
    const chunk = steamIds.slice(i, i + chunkSize);
    const data = await steamGet<PlayerSummaryResponse>(
      "ISteamUser/GetPlayerSummaries/v2/",
      { steamids: chunk.join(",") },
    );
    for (const player of data.response.players ?? []) {
      out.set(player.steamid, {
        steamId: player.steamid,
        personaName: player.personaname,
        avatarUrl: player.avatarmedium || player.avatar,
        profileUrl: player.profileurl,
      });
    }
  }
  return out;
}

type UserStatsResponse = {
  playerstats?: {
    stats?: Array<{ name: string; value: number }>;
    error?: string;
  };
};

function pickStat(
  stats: Array<{ name: string; value: number }> | undefined,
  name: string,
): number | null {
  const found = stats?.find((s) => s.name === name);
  return found ? found.value : null;
}

const emptyCs2Stats = {
  kills: null,
  deaths: null,
  kd: null,
  headshotKills: null,
  hsPercent: null,
  wins: null,
  roundsPlayed: null,
  winRate: null,
  shotsFired: null,
  shotsHit: null,
  accuracy: null,
  lastMatch: null,
  mapWins: [] as Array<{ map: string; wins: number }>,
  privateOrUnavailable: true,
};

export async function getCs2LifetimeStats(steamId: string) {
  try {
    const data = await steamGet<UserStatsResponse>(
      "ISteamUserStats/GetUserStatsForGame/v2/",
      { steamid: steamId, appid: "730" },
    );

    const stats = data.playerstats?.stats;
    if (!stats || stats.length === 0) {
      return emptyCs2Stats;
    }

    const kills = pickStat(stats, "total_kills");
    const deaths = pickStat(stats, "total_deaths");
    const headshotKills = pickStat(stats, "total_kills_headshot");
    const wins = pickStat(stats, "total_wins");
    const roundsPlayed = pickStat(stats, "total_rounds_played");
    const shotsFired = pickStat(stats, "total_shots_fired");
    const shotsHit = pickStat(stats, "total_shots_hit");

    const kd =
      kills != null && deaths != null && deaths > 0
        ? Math.round((kills / deaths) * 100) / 100
        : null;
    const hsPercent =
      kills != null && headshotKills != null && kills > 0
        ? Math.round((headshotKills / kills) * 1000) / 10
        : null;
    const winRate =
      wins != null && roundsPlayed != null && roundsPlayed > 0
        ? Math.round((wins / roundsPlayed) * 1000) / 10
        : null;
    const accuracy =
      shotsFired != null && shotsHit != null && shotsFired > 0
        ? Math.round((shotsHit / shotsFired) * 1000) / 10
        : null;

    const lmKills = pickStat(stats, "last_match_kills");
    const lmDeaths = pickStat(stats, "last_match_deaths");
    const lastMatch =
      lmKills != null || lmDeaths != null
        ? {
            kills: lmKills,
            deaths: lmDeaths,
            kd:
              lmKills != null && lmDeaths != null && lmDeaths > 0
                ? Math.round((lmKills / lmDeaths) * 100) / 100
                : null,
            mvps: pickStat(stats, "last_match_mvps"),
            damage: pickStat(stats, "last_match_damage"),
            rounds: pickStat(stats, "last_match_rounds"),
            contributionScore: pickStat(stats, "last_match_contribution_score"),
          }
        : null;

    const mapWins = stats
      .filter((s) => s.name.startsWith("total_wins_map_") && s.value > 0)
      .map((s) => ({
        map: s.name
          .replace("total_wins_map_", "")
          .replace(/^de_|^cs_/, ""),
        wins: s.value,
      }))
      .sort((a, b) => b.wins - a.wins)
      .slice(0, 12);

    return {
      kills,
      deaths,
      kd,
      headshotKills,
      hsPercent,
      wins,
      roundsPlayed,
      winRate,
      shotsFired,
      shotsHit,
      accuracy,
      lastMatch,
      mapWins,
      privateOrUnavailable: false,
    };
  } catch {
    return emptyCs2Stats;
  }
}
