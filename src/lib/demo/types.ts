export type MistakeType =
  | "economy"
  | "opening"
  | "trade"
  | "utility"
  | "cheat";

export type MistakeSeverity = "info" | "warn" | "danger";

export type CheatCategory = "wall" | "aim" | "context";

export type SceneMarkerRole =
  | "victim"
  | "attacker"
  | "teammate"
  | "focus"
  | "other";

export type SceneMarker = {
  steamId: string;
  name: string;
  team: number;
  x: number;
  y: number;
  z: number;
  yaw?: number;
  role: SceneMarkerRole;
  alive?: boolean;
};

/** Positions at the moment an issue was flagged (for radar visualization). */
export type EventScene = {
  tick: number;
  markers: SceneMarker[];
  focusSteamId?: string;
};

export type Mistake = {
  steamId: string;
  playerName: string;
  round: number;
  type: MistakeType;
  message: string;
  severity: MistakeSeverity;
  /** Cheat signal grouping for demo review UI. */
  cheatCategory?: CheatCategory;
  /** Optional related players (e.g. teammates who should have traded). */
  relatedSteamIds?: string[];
  scene?: EventScene;
};

export type PlayerStats = {
  steamId: string;
  name: string;
  team: number;
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  adr: number;
  hsPercent: number;
  entries: number;
  flashAssists: number;
  enemiesFlashed: number;
  utilityDamage: number;
  firstDeaths: number;
  tradedDeaths: number;
  missedTrades: number;
};

/** Per-player cheat heuristic scores from demo tick analysis. */
export type PlayerCheatScore = {
  steamId: string;
  name: string;
  /** 0–100: share of alive samples aiming at distant/occluded enemies. */
  wallLookScore: number;
  wallLookSamples: number;
  preAimFlags: number;
  /** Repeated quick switches between different occluded targets. */
  wallTrackRotations: number;
  /** Pre-fight target locks with low scan variance while enemies are around. */
  selectiveClearFlags: number;
  /** Early-round hidden-target locks before first engagement. */
  infoRotateFlags: number;
  rageSnaps: number;
  spinbotFlags: number;
  /** Damage on smoked victims without plausible info cues. */
  smokeSpamFlags: number;
  /** Shots fired within a few ticks of target becoming visible. */
  triggerFlags: number;
  /** Multi-kill jumps between occluded targets. */
  transferFlags: number;
  /** Overly uniform spray compensation during long bursts. */
  rcsFlags: number;
  /** Mid-round 180° checks on hidden lurkers. */
  lurkerCheckFlags: number;
  /** Cheat signals clustered when team is down big. */
  momentumFlags: number;
  /** Combined 0–100 risk from demo heuristics only. */
  cheatRisk: number;
};

export type MatchMeta = {
  mapName: string;
  tickRate: number | null;
  durationTicks: number | null;
  rounds: number;
  scoreCt: number | null;
  scoreT: number | null;
};

export type DemoSummary = {
  totalMistakes: number;
  economyMistakes: number;
  openingMistakes: number;
  tradeMistakes: number;
  utilityMistakes: number;
  cheatSignals: number;
  topMistakePlayer: string | null;
  highestCheatRiskPlayer: string | null;
};

export type DemoAnalysis = {
  match: MatchMeta;
  players: PlayerStats[];
  cheatScores: PlayerCheatScore[];
  mistakes: Mistake[];
  summary: DemoSummary;
  replay: DemoReplay | null;
};

/** Raw event row from demoparser2 (column names vary by event). */
export type DemoEventRow = Record<
  string,
  string | number | boolean | null | undefined
>;

export type ParsedDemo = {
  path: string;
  header: Record<string, unknown>;
  playerInfo: Array<{
    steamid?: string | number;
    name?: string;
    team_number?: number;
  }>;
  deaths: DemoEventRow[];
  hurts: DemoEventRow[];
  weaponFires: DemoEventRow[];
  blinds: DemoEventRow[];
  flashDetonates: DemoEventRow[];
  heDetonates: DemoEventRow[];
  smokeDetonates: DemoEventRow[];
  smokeExpires: DemoEventRow[];
  molotovDetonates: DemoEventRow[];
  molotovExpires: DemoEventRow[];
  roundStarts: DemoEventRow[];
  roundFreezeEnds: DemoEventRow[];
  roundEnds: DemoEventRow[];
  roundMvps: DemoEventRow[];
  freezeTicks: DemoEventRow[];
  /** Sampled position/angle ticks for cheat heuristics + replay. */
  motionTicks: DemoEventRow[];
  /** Grenade trajectory samples from demoparser2 parseGrenades. */
  grenadeTrajectories: DemoEventRow[];
};

export type ReplayPlayerRef = {
  steamId: string;
  name: string;
  team: number;
};

export type ReplayPlayerPose = {
  steamId: string;
  x: number;
  y: number;
  yaw: number;
  alive: boolean;
  team: number;
};

export type ReplayFrame = {
  tick: number;
  players: ReplayPlayerPose[];
};

export type ReplayEventKind = "kill" | "flash" | "he" | "smoke" | "molotov";

export type ReplayBlind = {
  steamId: string;
  name: string;
  /** Flash duration from the game event (seconds-ish / raw value). */
  duration: number;
  team: number;
};

export type ReplayEvent = {
  tick: number;
  round: number;
  kind: ReplayEventKind;
  /** Detonation / impact position. */
  x: number;
  y: number;
  actorSteamId?: string;
  actorName?: string;
  actorTeam?: number;
  targetSteamId?: string;
  targetName?: string;
  /** Players blinded by this flash (only for kind === "flash"). */
  blinds?: ReplayBlind[];
  /** How long the overlay should stay visible on the radar. */
  durationTicks?: number;
  /** True when duration is a CS2 default guess (no expire event matched). */
  durationEstimated?: boolean;
  /** Total HP damage from this HE / molly (from player_hurt). */
  damage?: number;
  /** Where the nade was thrown from (player position at throw). */
  throwX?: number;
  throwY?: number;
  throwTick?: number;
};

export type ReplayRound = {
  round: number;
  startTick: number;
  endTick: number;
  /** Winning team number (2 = T, 3 = CT). */
  winnerTeam?: number;
  /** SteamID of round MVP, if known. */
  mvpSteamId?: string;
};

export type DemoReplay = {
  tickRate: number;
  mapName: string;
  startTick: number;
  endTick: number;
  players: ReplayPlayerRef[];
  frames: ReplayFrame[];
  events: ReplayEvent[];
  rounds: ReplayRound[];
};
