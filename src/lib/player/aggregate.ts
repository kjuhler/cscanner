import { getCsstatProfile } from "@/lib/csstat";
import { getCsapiStats, isCsapiConfigured } from "@/lib/csapi";
import { getCsrepProfile, isCsrepConfigured } from "@/lib/csrep";
import {
  getFaceitBans,
  getFaceitFriendBanStats,
  getFaceitMatchHistory,
  getFaceitPlayerBySteamId,
  getFaceitStats,
  isFaceitConfigured,
} from "@/lib/faceit";
import { getLeetifyProfile } from "@/lib/leetify";
import { getLeetifyProfileMatches } from "@/lib/leetify/matches";
import { buildLeetifyWindows } from "@/lib/leetify/windowStats";
import { compositeScores } from "@/lib/player/composite";
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
  CsstatProfile,
  CsrepProfile,
  FaceitBan,
  FaceitMapStats,
  FaceitMatch,
  FaceitPlayer,
  FaceitStats,
  LeetifyMatchPlayerRow,
  LeetifyProfile,
  LeetifyWindows,
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

function mergeCsstatGaps(args: {
  steamId: string;
  leetify: LeetifyProfile | null;
  faceitPlayer: FaceitPlayer | null;
  faceitStats: FaceitStats | null;
  faceitBans: FaceitBan[];
  playtimeHours: number | null;
  csstat: CsstatProfile | null;
}): {
  leetify: LeetifyProfile | null;
  faceitPlayer: FaceitPlayer | null;
  faceitStats: FaceitStats | null;
  faceitBans: FaceitBan[];
  playtimeHours: number | null;
  csstat: CsstatProfile | null;
} {
  const { csstat, steamId } = args;
  if (!csstat) {
    return {
      leetify: args.leetify,
      faceitPlayer: args.faceitPlayer,
      faceitStats: args.faceitStats,
      faceitBans: args.faceitBans,
      playtimeHours: args.playtimeHours,
      csstat: null,
    };
  }

  const filled: string[] = [];
  let leetify = args.leetify;
  let faceitPlayer = args.faceitPlayer;
  let faceitStats = args.faceitStats;
  let faceitBans = args.faceitBans;
  let playtimeHours = args.playtimeHours;

  const L = csstat.leetify;
  const extra = csstat.leetifyExtra;

  if (L || extra) {
    if (!leetify) {
      leetify = {
        name: csstat.steam?.name ?? csstat.faceit?.nickname ?? null,
        winrate: L?.winRate?.value ?? extra?.winRate ?? null,
        totalMatches: L?.matches ?? null,
        premier: null,
        premierRecent: null,
        faceitLevel: csstat.faceit?.skillLevel ?? null,
        faceitElo: csstat.faceit?.elo ?? null,
        wingman: null,
        leetifyRating: L?.rating?.value ?? null,
        competitive: [],
        seasonRanksCs2: [],
        csgoRanks: null,
        mapStats: [],
        teammates: [],
        stackStats: null,
        hsPercent: null,
        aim: L?.aim?.value ?? null,
        positioning: L?.positioning?.value ?? null,
        utility: L?.utility?.value ?? null,
        clutch: L?.clutch?.value ?? null,
        opening: L?.opening?.value ?? null,
        sprayAccuracy: null,
        timeToDamageMs: L?.timeToDamageMs?.value ?? null,
        preaim: L?.preaim?.value ?? null,
        accuracyEnemySpotted: null,
        counterStrafeRatio: null,
        openingDuelSuccess: null,
        tradeKillSuccess: null,
        flashbangLeadingToKill: null,
        enemiesFlashedPerFlashbang: null,
        teammatesFlashedPerFlashbang: null,
        heDamagePerNade: L?.avgHeDamage?.value ?? null,
        utilityOnDeathAvg: null,
        recentMatches: [],
        profileUrl: `https://leetify.com/app/profile/${steamId}`,
        platformBans: [],
        dataSource: "website",
        sampleGames: L?.matches ?? null,
        sampleRounds: null,
      };
      filled.push(
        "aim",
        "positioning",
        "utility",
        "clutch",
        "opening",
        "preaim",
        "timeToDamageMs",
        "winrate",
        "matches",
      );
    } else {
      const patch: Partial<LeetifyProfile> = {};
      if (leetify.aim == null && L?.aim?.value != null) {
        patch.aim = L.aim.value;
        filled.push("aim");
      }
      if (leetify.positioning == null && L?.positioning?.value != null) {
        patch.positioning = L.positioning.value;
        filled.push("positioning");
      }
      if (leetify.utility == null && L?.utility?.value != null) {
        patch.utility = L.utility.value;
        filled.push("utility");
      }
      if (leetify.clutch == null && L?.clutch?.value != null) {
        patch.clutch = L.clutch.value;
        filled.push("clutch");
      }
      if (leetify.opening == null && L?.opening?.value != null) {
        patch.opening = L.opening.value;
        filled.push("opening");
      }
      if (leetify.preaim == null && L?.preaim?.value != null) {
        patch.preaim = L.preaim.value;
        filled.push("preaim");
      }
      if (leetify.timeToDamageMs == null && L?.timeToDamageMs?.value != null) {
        patch.timeToDamageMs = L.timeToDamageMs.value;
        filled.push("timeToDamageMs");
      }
      if (leetify.heDamagePerNade == null && L?.avgHeDamage?.value != null) {
        patch.heDamagePerNade = L.avgHeDamage.value;
        filled.push("heDamagePerNade");
      }
      if (leetify.leetifyRating == null && L?.rating?.value != null) {
        patch.leetifyRating = L.rating.value;
        filled.push("leetifyRating");
      }
      if (
        leetify.winrate == null &&
        (L?.winRate?.value != null || extra?.winRate != null)
      ) {
        patch.winrate = L?.winRate?.value ?? extra?.winRate ?? null;
        filled.push("winrate");
      }
      if (leetify.totalMatches == null && L?.matches != null) {
        patch.totalMatches = L.matches;
        filled.push("totalMatches");
      }
      if (Object.keys(patch).length > 0) {
        leetify = { ...leetify, ...patch };
      }
    }
  }

  const F = csstat.faceit;
  if (F) {
    if (!faceitPlayer && (F.elo != null || F.nickname)) {
      faceitPlayer = {
        playerId: "",
        nickname: F.nickname ?? "FACEIT",
        avatarUrl: null,
        country: F.country,
        elo: F.elo,
        skillLevel: F.skillLevel,
        faceitUrl:
          F.profileUrl ??
          `https://www.faceit.com/en/search/players/${steamId}`,
      };
      filled.push("faceitPlayer");
    } else if (faceitPlayer) {
      if (faceitPlayer.elo == null && F.elo != null) {
        faceitPlayer = { ...faceitPlayer, elo: F.elo };
        filled.push("faceitElo");
      }
      if (faceitPlayer.skillLevel == null && F.skillLevel != null) {
        faceitPlayer = { ...faceitPlayer, skillLevel: F.skillLevel };
        filled.push("faceitLevel");
      }
    }

    if (!faceitStats && (F.matches != null || F.kd != null || F.hsPercent != null)) {
      faceitStats = {
        matches: F.matches,
        winRate: F.winRate,
        kd: F.kd,
        hsPercent: F.hsPercent,
        wins: null,
        averageAdr: null,
      };
      filled.push("faceitStats");
    } else if (faceitStats) {
      const patch: Partial<FaceitStats> = {};
      if (faceitStats.matches == null && F.matches != null) {
        patch.matches = F.matches;
        filled.push("faceitMatches");
      }
      if (faceitStats.kd == null && F.kd != null) {
        patch.kd = F.kd;
        filled.push("faceitKd");
      }
      if (faceitStats.hsPercent == null && F.hsPercent != null) {
        patch.hsPercent = F.hsPercent;
        filled.push("faceitHs");
      }
      if (faceitStats.winRate == null && F.winRate != null) {
        patch.winRate = F.winRate;
        filled.push("faceitWinRate");
      }
      if (Object.keys(patch).length > 0) {
        faceitStats = { ...faceitStats, ...patch };
      }
    }

    if (F.banReason && faceitBans.length === 0) {
      faceitBans = [
        {
          type: "ban",
          reason: F.banReason,
          startsAt: F.banDate,
          endsAt: null,
        },
      ];
      filled.push("faceitBan");
    }
  }

  if (
    playtimeHours == null &&
    csstat.steam?.cs2PlaytimeHours != null
  ) {
    playtimeHours = csstat.steam.cs2PlaytimeHours;
    filled.push("cs2PlaytimeHours");
  }

  return {
    leetify,
    faceitPlayer,
    faceitStats,
    faceitBans,
    playtimeHours,
    csstat: { ...csstat, filledFields: filled },
  };
}

export async function aggregatePlayer(
  steamId: string,
): Promise<PlayerAggregate> {
  const errors: string[] = [];

  const [
    steam,
    playtime,
    level,
    friendIds,
    cs2,
    leetifyRaw,
    steamBans,
    scope,
    matchRows,
    csstatRaw,
    csrepRaw,
    csapi,
  ] = await Promise.all([
      settled(getPlayerSummary(steamId), errors, "Steam profile"),
      settled(getCs2PlaytimeHours(steamId), errors, "CS2 playtime"),
      settled(getSteamLevel(steamId), errors, "Steam level"),
      settled(getFriendIds(steamId), errors, "Friends"),
      settled(getCs2LifetimeStats(steamId), errors, "CS2 lifetime stats"),
      settled(getLeetifyProfile(steamId), errors, "Leetify"),
      settled(getPlayerBans(steamId), errors, "Steam bans"),
      settled(getScopeAimStats(steamId), errors, "Scope"),
      settled(getLeetifyProfileMatches(steamId, 100), errors, "Leetify matches"),
      settled(getCsstatProfile(steamId), errors, "csst.at"),
      isCsrepConfigured()
        ? settled(getCsrepProfile(steamId), errors, "CSRep")
        : Promise.resolve(null as CsrepProfile | null),
      isCsapiConfigured()
        ? settled(getCsapiStats(steamId), errors, "csapi")
        : Promise.resolve(null),
    ]);

  if (!isCsrepConfigured()) {
    errors.push("CSRep: CSREP_API_KEY / API proxy is not configured");
  }
  if (!isCsapiConfigured()) {
    errors.push("csapi: CSAPI_API_KEY is not configured");
  }

  const leetifyMatchRows: LeetifyMatchPlayerRow[] | null = matchRows?.length
    ? matchRows
    : null;
  const leetifyWindows: LeetifyWindows | null = leetifyMatchRows
    ? buildLeetifyWindows(leetifyMatchRows)
    : null;

  let faceitPlayerData: FaceitPlayer | null = null;
  let faceitStats: FaceitStats | null = null;
  let faceitMaps: FaceitMapStats[] = [];
  let faceitMatches: FaceitMatch[] = [];
  let faceitBans: FaceitBan[] = [];

  if (isFaceitConfigured()) {
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
    errors.push("FACEIT: FACEIT_API_KEY / API proxy is not configured");
  }

  const { leetify: leetifyAfterScope, scopeInfo } = mergeScopeAim(
    leetifyRaw,
    scope,
    cs2?.hsPercent ?? null,
    faceitStats?.hsPercent ?? null,
  );

  const merged = mergeCsstatGaps({
    steamId,
    leetify: leetifyAfterScope,
    faceitPlayer: faceitPlayerData,
    faceitStats,
    faceitBans,
    playtimeHours: playtime,
    csstat: csstatRaw,
  });

  const leetify = merged.leetify;
  faceitPlayerData = merged.faceitPlayer;
  faceitStats = merged.faceitStats;
  faceitBans = merged.faceitBans;
  const csstat = merged.csstat;

  const friendsList = friendIds ?? null;
  const steamExtras = {
    cs2PlaytimeHours: merged.playtimeHours,
    steamLevel: level,
    friendCount: friendsList?.length ?? null,
  };

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
      isFaceitConfigured()
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

  const trust = assessRisk({
    steam,
    steamExtras,
    cs2,
    faceitPlayer: faceitPlayerData,
    faceitStats,
    leetify,
    csapi,
    bans,
  });

  const composite = compositeScores({
    trust,
    csrep: csrepRaw,
    cs2,
    faceitPlayer: faceitPlayerData,
    faceitStats,
    leetify,
    leetifyWindows,
    csstat,
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
    leetifyWindows,
    leetifyMatchRows,
    scope: scopeInfo,
    csstat,
    csapi: csapi,
    csrep: csrepRaw,
    composite,
    bans,
    trust,
    errors,
  };
}
