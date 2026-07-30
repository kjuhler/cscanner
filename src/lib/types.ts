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

export type LeetifyMatchPlayer = {
  steamId: string;
  name: string;
  teamNumber: number;
  kills: number;
  deaths: number;
  assists: number;
  kd: number | null;
  adr: number | null;
  hsPercent: number | null;
  leetifyRating: number | null;
  ctRating: number | null;
  tRating: number | null;
  mvps: number;
  preaim: number | null;
  timeToDamageMs: number | null;
  sprayAccuracy: number | null;
  score: number;
};

export type LeetifyMatchDetails = {
  id: string;
  finishedAt: string | null;
  source: string | null;
  sourceMatchId: string | null;
  map: string | null;
  hasBannedPlayer: boolean;
  replayUrl: string | null;
  score: string | null;
  players: LeetifyMatchPlayer[];
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

export type TrustPillarId = "statistical" | "accountFlags" | "anomalies";

export type RiskSignal = {
  id: string;
  label: string;
  weight: number;
  /** How much this signal reduces the pillar (risk contribution before invert). */
  contribution: number;
  detail: string;
  /** Which trust pillar this signal belongs to */
  pillar: TrustPillarId;
};

export type RiskProtectiveFactor = {
  id: string;
  label: string;
  detail: string;
};

/** Trust level — higher score is better (CSRep-style). */
export type TrustLevel =
  | "excellent"
  | "good"
  | "fair"
  | "poor"
  | "critical"
  | "unknown";

/** @deprecated Use TrustLevel */
export type RiskLevel = TrustLevel;

export type TrustPillars = {
  statistical: number;
  accountFlags: number;
  anomalies: number;
};

export type RiskAssessment = {
  /** Trust score 0–100 (higher = more trustworthy). Null when not enough data. */
  score: number | null;
  confidence: "low" | "medium" | "high";
  level: TrustLevel;
  pillars: TrustPillars | null;
  /** Small additive bonus (e.g. aged account + playtime + clean bans), 0–10. */
  accountBonus: number;
  signals: RiskSignal[];
  /** Highest-contribution concerning signals */
  redFlags: RiskSignal[];
  /** Patterns that pull toward a safer reading */
  protective: RiskProtectiveFactor[];
  disclaimer: string;
};

/** Alias — same object, trust-oriented naming. */
export type TrustAssessment = RiskAssessment;

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

/** Per-match player row from Leetify /v3/profile/matches (serializable). */
export type LeetifyMatchPlayerRow = {
  steamId: string;
  matchId?: string | null;
  finishedAt: string | null;
  map: string | null;
  source: string | null;
  won: boolean | null;
  /** Leetify crosshair/preaim degrees (single angle metric). */
  preaim: number | null;
  /** Time to damage (ms) — Leetify `reaction_time`. */
  timeToDamageMs: number | null;
  /** Ratio 0..1 in source payload. */
  accuracyRaw: number | null;
  /** Ratio 0..1 in source payload. */
  accuracyEnemySpottedRaw: number | null;
  /** Ratio 0..1 in source payload. */
  sprayAccuracyRaw: number | null;
  /** Ratio 0..1 in source payload. */
  counterStrafeRatioRaw: number | null;
  /** Ratio 0..1 in source payload. */
  tradeKillSuccessRaw: number | null;
  /** Avg utility value on death in source payload. */
  utilityOnDeathAvg: number | null;
  /** Avg HE damage per nade in source payload. */
  heDamagePerNade: number | null;
  /** Average flashes leading to kill in source payload. */
  flashLeadingToKill: number | null;
  kills: number;
  deaths: number;
  assists: number;
  hsKills: number;
  shotsFired: number;
  shotsHit: number;
  damage: number;
  roundsCount: number;
  roundsSurvived: number;
  tradedDeathsSucceed: number;
  roundsWon: number | null;
  roundsLost: number | null;
  leetifyRating: number | null;
};

/** Aggregated Leetify per-match stats over a recent window. */
export type LeetifyWindowStats = {
  sampleSize: number;
  timeToDamageMs: number | null;
  reactionTimeMs: number | null;
  crosshairPlacement: number | null;
  preaim: number | null;
  kd: number | null;
  adr: number | null;
  /** (hits / shots) * 100 */
  accuracy: number | null;
  /** (hs kills / hits) * 100 */
  hsPercent: number | null;
  wallbangKillPercent: number | null;
  smokeKillPercent: number | null;
  hltvRating: number | null;
  kast: number | null;
  accuracyEnemySpotted: number | null;
  sprayAccuracy: number | null;
  leetifyRating: number | null;
  winRate: number | null;
};

export type LeetifyWindows = {
  last30: LeetifyWindowStats | null;
  last90: LeetifyWindowStats | null;
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
  /** Recent-match windows from /v3/profile/matches (null when unavailable). */
  leetifyWindows: LeetifyWindows | null;
  /** Raw match rows for client-side day filters (null when unavailable). */
  leetifyMatchRows: LeetifyMatchPlayerRow[] | null;
  /** Scope ratings fetch (aim fallback); null when unavailable. */
  scope: ScopeSourceInfo | null;
  bans: PlayerBans;
  /** CSRep-style trust assessment (higher score = more trustworthy). */
  trust: TrustAssessment;
  errors: string[];
};
