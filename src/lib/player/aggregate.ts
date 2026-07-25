import {
  getFaceitBans,
  getFaceitFriendBanStats,
  getFaceitMatchHistory,
  getFaceitPlayerBySteamId,
  getFaceitStats,
} from "@/lib/faceit";
import { getLeetifyProfile } from "@/lib/leetify";
import { assessRisk } from "@/lib/risk/score";
import { getScopeAimStats, type ScopeAimStats } from "@/lib/scope";
import {
  getCs2LifetimeStats,
  getCs2PlaytimeHours,
  getFriendIds,
  getPlayerBans,
  getPlayerSummaries,
  getPlayerSummary,
  getSteamFriendBanStats,
  getSteamLevel,
} from "@/lib/steam";
import type {
  BannedFriend,
  BannedFriendsStats,
  FaceitBan,
  FaceitMapStats,
  FaceitMatch,
  FaceitStats,
  LeetifyProfile,
  PlayerAggregate,
  ScopeSourceInfo,
} from "@/lib/types";

export { isSteamId64, parseSteamInput, resolveSteamId } from "@/lib/steam";

async function settled<T>(
  promise: Promise<T>,
  errors: string[],
  label: string,
): Promise<T | null> {
  try {
    return await promise;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(`${label}: ${message}`);
    return null;
  }
}

function mergeScopeAim(
  leetify: LeetifyProfile | null,
  scope: ScopeAimStats | null,
  steamHs: number | null,
  faceitHs: number | null,
): { leetify: LeetifyProfile | null; scopeInfo: ScopeSourceInfo | null } {
  if (!scope) {
    return { leetify, scopeInfo: null };
  }

  const filled: string[] = [];
  let next = leetify;

  if (next) {
    const patch: Partial<LeetifyProfile> = {};

    if (next.timeToDamageMs == null && scope.timeToDamageMs != null) {
      patch.timeToDamageMs = scope.timeToDamageMs;
      filled.push("timeToDamageMs");
    }
    if (next.hsPercent == null && scope.hsPercent != null) {
      patch.hsPercent = scope.hsPercent;
      filled.push("hsPercent");
    }
    if (
      next.accuracyEnemySpotted == null &&
      scope.accuracySpotted != null
    ) {
      patch.accuracyEnemySpotted = scope.accuracySpotted;
      filled.push("accuracyEnemySpotted");
    }
    if (
      next.sprayAccuracy == null &&
      scope.firstBulletAccuracy != null
    ) {
      patch.sprayAccuracy = scope.firstBulletAccuracy;
      filled.push("sprayAccuracy");
    }
    if (
      next.heDamagePerNade == null &&
      scope.averageHeDamage != null
    ) {
      patch.heDamagePerNade = scope.averageHeDamage;
      filled.push("heDamagePerNade");
    }

    // Steam / FACEIT HS% when Leetify + Scope both lack it.
    const hsAfterScope = patch.hsPercent ?? next.hsPercent;
    if (hsAfterScope == null) {
      if (steamHs != null) patch.hsPercent = steamHs;
      else if (faceitHs != null) patch.hsPercent = faceitHs;
    }

    next = {
      ...next,
      ...patch,
      scopeFilled: filled,
      scopeProfileUrl: scope.profileUrl,
    };
  }

  return {
    leetify: next,
    scopeInfo: {
      profileUrl: scope.profileUrl,
      sampleMatches: scope.sampleMatches,
      filledFields: filled,
    },
  };
}

export async function aggregatePlayer(
  steamId: string,
): Promise<PlayerAggregate> {
  const errors: string[] = [];

  const [steam, playtime, level, friendIds, cs2, leetifyRaw, steamBans, scope] =
    await Promise.all([
      settled(getPlayerSummary(steamId), errors, "Steam profile"),
      settled(getCs2PlaytimeHours(steamId), errors, "CS2 playtime"),
      settled(getSteamLevel(steamId), errors, "Steam level"),
      settled(getFriendIds(steamId), errors, "Friends"),
      settled(getCs2LifetimeStats(steamId), errors, "CS2 lifetime stats"),
      settled(getLeetifyProfile(steamId), errors, "Leetify"),
      settled(getPlayerBans(steamId), errors, "Steam bans"),
      settled(getScopeAimStats(steamId), errors, "Scope"),
    ]);

  const friendsList = friendIds ?? null;
  const steamExtras = {
    cs2PlaytimeHours: playtime,
    steamLevel: level,
    friendCount: friendsList?.length ?? null,
  };

  let faceitPlayerData = null;
  let faceitStats: FaceitStats | null = null;
  let faceitMaps: FaceitMapStats[] = [];
  let faceitMatches: FaceitMatch[] = [];
  let faceitBans: FaceitBan[] = [];

  if (process.env.FACEIT_API_KEY) {
    faceitPlayerData = await settled(
      getFaceitPlayerBySteamId(steamId),
      errors,
      "FACEIT player",
    );

    if (faceitPlayerData) {
      const [statsBundle, matches, bans] = await Promise.all([
        settled(
          getFaceitStats(faceitPlayerData.playerId),
          errors,
          "FACEIT stats",
        ),
        settled(
          getFaceitMatchHistory(faceitPlayerData.playerId, 12),
          errors,
          "FACEIT matches",
        ),
        settled(
          getFaceitBans(faceitPlayerData.playerId),
          errors,
          "FACEIT bans",
        ),
      ]);
      faceitStats = statsBundle?.lifetime ?? null;
      faceitMaps = statsBundle?.maps ?? [];
      faceitMatches = matches ?? [];
      faceitBans = bans ?? [];
    }
  } else {
    errors.push("FACEIT: FACEIT_API_KEY is not configured");
  }

  const { leetify, scopeInfo } = mergeScopeAim(
    leetifyRaw,
    scope,
    cs2?.hsPercent ?? null,
    faceitStats?.hsPercent ?? null,
  );

  const bannedFriends: BannedFriendsStats = {
    friendCount: friendsList?.length ?? null,
    steam: null,
    faceit: null,
  };

  if (friendsList && friendsList.length > 0) {
    const [steamFriendBans, faceitFriendBans] = await Promise.all([
      settled(
        getSteamFriendBanStats(friendsList),
        errors,
        "Steam friend bans",
      ),
      process.env.FACEIT_API_KEY
        ? settled(
            getFaceitFriendBanStats(friendsList, { limit: 40 }),
            errors,
            "FACEIT friend bans",
          )
        : Promise.resolve(null),
    ]);

    if (steamFriendBans) {
      let players: BannedFriend[] = steamFriendBans.players.map((p) => ({
        steamId: p.steamId,
        name: p.steamId,
        avatarUrl: null,
        profileUrl: `https://steamcommunity.com/profiles/${p.steamId}`,
        vacBanned: p.vacBanned,
        numberOfVacBans: p.numberOfVacBans,
        numberOfGameBans: p.numberOfGameBans,
        daysSinceLastBan: p.daysSinceLastBan,
      }));

      if (players.length > 0) {
        const summaries = await settled(
          getPlayerSummaries(players.map((p) => p.steamId)),
          errors,
          "Banned friend profiles",
        );
        if (summaries) {
          players = players.map((p) => {
            const s = summaries.get(p.steamId);
            if (!s) return p;
            return {
              ...p,
              name: s.personaName,
              avatarUrl: s.avatarUrl,
              profileUrl: s.profileUrl,
            };
          });
        }
        players.sort((a, b) => a.daysSinceLastBan - b.daysSinceLastBan);
      }

      bannedFriends.steam = {
        checked: steamFriendBans.checked,
        banned: steamFriendBans.banned,
        vacBanned: steamFriendBans.vacBanned,
        gameBanned: steamFriendBans.gameBanned,
        players,
      };
    }

    bannedFriends.faceit = faceitFriendBans;
  }

  const bans = {
    steam: steamBans,
    faceit: faceitBans,
    leetify: leetify?.platformBans ?? [],
    friends: bannedFriends,
  };

  const risk = assessRisk({
    steam,
    steamExtras,
    cs2,
    faceitPlayer: faceitPlayerData,
    faceitStats,
    leetify,
    bans,
  });

  return {
    steamId,
    steam,
    steamExtras,
    cs2,
    faceit: {
      player: faceitPlayerData,
      stats: faceitStats,
      maps: faceitMaps,
      matches: faceitMatches,
      bans: faceitBans,
    },
    leetify,
    scope: scopeInfo,
    bans,
    risk,
    errors,
  };
}
