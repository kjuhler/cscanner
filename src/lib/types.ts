export type SteamProfile = {
  steamId: string;
  personaName: string;
  avatarUrl: string;
  avatarFullUrl: string;
  profileUrl: string;
  timeCreated: number | null;
  accountAgeDays: number | null;
  communityVisibility: number;
  profilePrivate: boolean;
};

export type SteamLastMatch = {
  kills: number | null;
  deaths: number | null;
  kd: number | null;
  mvps: number | null;
  damage: number | null;
  rounds: number | null;
  contributionScore: number | null;
};

export type SteamMapWins = {
  map: string;
  wins: number;
};

export type SteamCs2Stats = {
  kills: number | null;
  deaths: number | null;
  kd: number | null;
  headshotKills: number | null;
  hsPercent: number | null;
  wins: number | null;
  roundsPlayed: number | null;
  winRate: number | null;
  shotsFired: number | null;
  shotsHit: number | null;
  accuracy: number | null;
  lastMatch: SteamLastMatch | null;
  mapWins: SteamMapWins[];
  privateOrUnavailable: boolean;
};

export type SteamExtras = {
  cs2PlaytimeHours: number | null;
  steamLevel: number | null;
  friendCount: number | null;
};

export type BannedFriend = {
  steamId: string;
  name: string;
  avatarUrl: string | null;
  profileUrl: string;
  vacBanned: boolean;
  numberOfVacBans: number;
  numberOfGameBans: number;
  daysSinceLastBan: number;
};

export type BannedFriendsStats = {
  /** Total Steam friends, or null if friends list is private. */
  friendCount: number | null;
  steam: {
    checked: number;
    banned: number;
    vacBanned: number;
    gameBanned: number;
    /** Individual banned friends (Steam VAC / game bans). */
    players: BannedFriend[];
  } | null;
  faceit: {
    sampled: number;
    withFaceit: number;
    banned: number;
  } | null;
};

export type FaceitPlayer = {
  playerId: string;
  nickname: string;
  avatarUrl: string | null;
  country: string | null;
  elo: number | null;
  skillLevel: number | null;
  faceitUrl: string;
};

export type FaceitStats = {
  matches: number | null;
  winRate: number | null;
  kd: number | null;
  hsPercent: number | null;
  wins: number | null;
  averageAdr: number | null;
};

export type FaceitMapStats = {
  map: string;
  matches: number | null;
  winRate: number | null;
  kd: number | null;
  hsPercent: number | null;
};

export type FaceitMatch = {
  matchId: string;
  finishedAt: number | null;
  gameMode: string | null;
  map: string | null;
  result: "win" | "loss" | "unknown";
  elo: number | null;
  score: string | null;
  faceitUrl: string;
};

export type CompetitiveMapRank = {
  map: string;
  rank: number;
  rankName: string;
};

export type Cs2SeasonRank = {
  seasonNumber: number;
  title: string;
  matches: number;
  wins: number;
  winRate: number | null;
  premierMin: number | null;
  premierMax: number | null;
  competitiveMin: number | null;
  competitiveMax: number | null;
};

export type CsgoRankSummary = {
  matches: number;
  wins: number;
  winRate: number | null;
  rankMin: number | null;
  rankMax: number | null;
};

export type PlatformBan = {
  platform: string;
  reason: string | null;
};

export type LeetifyRecentMatch = {
  id: string;
  finishedAt: string | null;
  source: string | null;
  outcome: "win" | "loss" | "tie" | "unknown";
  map: string | null;
  score: string | null;
  premierRating: number | null;
  competitiveRank: number | null;
  /** CS:GO skill group when applicable */
  csgoRank?: number | null;
  hsPercent: number | null;
  leetifyRating: number | null;
  kills?: number | null;
  deaths?: number | null;
  kd?: number | null;
  tRating?: number | null;
  ctRating?: number | null;
  isCs2?: boolean | null;
  /** True if Leetify marked any player in the lobby as banned. */
  hasBannedPlayer?: boolean;
};

export type LeetifyMapStats = {
  map: string;
  matches: number;
  winRate: number | null;
  leetifyRating: number | null;
  tRating: number | null;
  ctRating: number | null;
};

export type LeetifyTeammate = {
  steamId: string;
  name: string;
  avatarUrl: string | null;
  matchesTogether: number;
  winRateTogether: number | null;
  playerRating: number | null;
  teammateRating: number | null;
  premierRating: number | null;
  competitiveRank: number | null;
  isBanned: boolean;
};

export type LeetifyStackStats = {
  soloPercent: number;
  stack2to4Percent: number;
  stack5Percent: number;
  sampleSize: number;
};

export type LeetifyProfile = {
  name: string | null;
  winrate: number | null;
  totalMatches: number | null;
  premier: number | null;
  premierRecent: number | null;
  faceitLevel: number | null;
  faceitElo: number | null;
  wingman: number | null;
  leetifyRating: number | null;
  competitive: CompetitiveMapRank[];
  /** Premier / competitive ranks per CS2 season (from Leetify match history). */
  seasonRanksCs2: Cs2SeasonRank[];
  /** CS:GO competitive skill-group range from Leetify history. */
  csgoRanks: CsgoRankSummary | null;
  mapStats: LeetifyMapStats[];
  teammates: LeetifyTeammate[];
  /** Solo vs party stack mix from recent Leetify games. */
  stackStats: LeetifyStackStats | null;
  hsPercent: number | null;
  aim: number | null;
  positioning: number | null;
  utility: number | null;
  clutch: number | null;
  opening: number | null;
  sprayAccuracy: number | null;
  /** Approx. time-to-damage (Leetify reaction_time_ms) */
  timeToDamageMs: number | null;
  /** Crosshair placement in degrees (Leetify `preaim`; lower is better) */
  preaim: number | null;
  accuracyEnemySpotted: number | null;
  counterStrafeRatio: number | null;
  openingDuelSuccess: number | null;
  tradeKillSuccess: number | null;
  /** Avg enemies killed while flashed by this player's flashbangs */
  flashbangLeadingToKill: number | null;
  enemiesFlashedPerFlashbang: number | null;
  teammatesFlashedPerFlashbang: number | null;
  heDamagePerNade: number | null;
  /** Avg $ value of unused utility on death (lower is better) */
  utilityOnDeathAvg: number | null;
  recentMatches: LeetifyRecentMatch[];
  profileUrl: string;
  platformBans: PlatformBan[];
  dataSource: "public_api" | "website";
  sampleGames: number | null;
  sampleRounds: number | null;
  /** Aim fields filled from Scope.gg when Leetify left them null. */
  scopeFilled?: string[];
  scopeProfileUrl?: string | null;
};

export type RiskSignal = {
  id: string;
  label: string;
  weight: number;
  contribution: number;
  detail: string;
  /** Which analysis pillar this signal belongs to */
  pillar: "trust" | "stats" | "consistency" | "bans";
};

export type RiskProtectiveFactor = {
  id: string;
  label: string;
  detail: string;
};

export type RiskLevel =
  | "low"
  | "moderate"
  | "elevated"
  | "high"
  | "critical"
  | "unknown";

export type RiskAssessment = {
  score: number | null;
  confidence: "low" | "medium" | "high";
  level: RiskLevel;
  signals: RiskSignal[];
  /** Highest-contribution concerning signals */
  redFlags: RiskSignal[];
  /** Patterns that pull toward a safer reading */
  protective: RiskProtectiveFactor[];
  disclaimer: string;
};

export type SteamBans = {
  vacBanned: boolean;
  numberOfVacBans: number;
  numberOfGameBans: number;
  daysSinceLastBan: number;
  communityBanned: boolean;
  economyBan: string;
};

export type FaceitBan = {
  type: string;
  reason: string | null;
  startsAt: string | null;
  endsAt: string | null;
};

export type PlayerBans = {
  steam: SteamBans | null;
  faceit: FaceitBan[];
  leetify: PlatformBan[];
  friends: BannedFriendsStats;
};

export type ScopeSourceInfo = {
  profileUrl: string;
  sampleMatches: number | null;
  filledFields: string[];
};

export type PlayerAggregate = {
  steamId: string;
  steam: SteamProfile | null;
  steamExtras: SteamExtras;
  cs2: SteamCs2Stats | null;
  faceit: {
    player: FaceitPlayer | null;
    stats: FaceitStats | null;
    maps: FaceitMapStats[];
    matches: FaceitMatch[];
    bans: FaceitBan[];
  };
  leetify: LeetifyProfile | null;
  /** Scope ratings fetch (aim fallback); null when unavailable. */
  scope: ScopeSourceInfo | null;
  bans: PlayerBans;
  risk: RiskAssessment;
  errors: string[];
};
