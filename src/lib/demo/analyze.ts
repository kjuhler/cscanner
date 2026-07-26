import { analyzeCheating } from "./cheating";
import { buildReplay } from "./buildReplay";
import { analyzeEconomy } from "./economy";
import { analyzeOpeningAndTrades } from "./opening";
import { parseDemoFile, type ParseProgressFn } from "./parse";
import { computePlayerStats, countRounds } from "./stats";
import type {
  DemoAnalysis,
  DemoSummary,
  MatchMeta,
  Mistake,
  PlayerCheatScore,
} from "./types";
import { analyzeUtility } from "./utility";
import { mapCode } from "@/lib/maps";

export type AnalyzeProgressFn = (
  stage: "parsing" | "analyzing" | "replay",
  detail: string,
  pct: number,
) => void;

function mapNameFromHeader(header: Record<string, unknown>): string {
  const candidates = [
    header.map_name,
    header.mapname,
    header.map,
    header.MapName,
    header.add_ons,
    header.server_name,
  ];

  for (const raw of candidates) {
    if (typeof raw !== "string" || !raw.trim()) continue;
    const cleaned = raw.trim().replace(/\\/g, "/").split("/").pop() ?? raw;
    const noExt = cleaned.replace(/\.bsp$/i, "");
    const code = noExt.match(/\b((?:de|cs|ar|gd)_[a-z0-9]+)\b/i);
    if (code?.[1]) return code[1].toLowerCase();
    if (noExt) return noExt;
  }

  // Last resort: scan every string field for a Valve map code.
  for (const value of Object.values(header)) {
    if (typeof value !== "string") continue;
    const code = value.match(/\b((?:de|cs|ar|gd)_[a-z0-9]+)\b/i);
    if (code?.[1]) return code[1].toLowerCase();
  }

  return "unknown";
}

function tickRateFromHeader(header: Record<string, unknown>): number {
  const raw = header.tickrate ?? header.tick_rate ?? null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (Number.isFinite(n) && n > 0 && n < 1000) return Math.round(n);
  return 64;
}

function buildSummary(
  mistakes: Mistake[],
  cheatScores: PlayerCheatScore[],
): DemoSummary {
  const economyMistakes = mistakes.filter((m) => m.type === "economy").length;
  const openingMistakes = mistakes.filter((m) => m.type === "opening").length;
  const tradeMistakes = mistakes.filter((m) => m.type === "trade").length;
  const utilityMistakes = mistakes.filter((m) => m.type === "utility").length;
  const cheatSignals = mistakes.filter((m) => m.type === "cheat").length;

  const countByPlayer = new Map<string, { name: string; n: number }>();
  for (const m of mistakes) {
    const cur = countByPlayer.get(m.steamId) ?? {
      name: m.playerName,
      n: 0,
    };
    cur.n += 1;
    countByPlayer.set(m.steamId, cur);
  }
  let topMistakePlayer: string | null = null;
  let topN = 0;
  for (const { name, n } of countByPlayer.values()) {
    if (n > topN) {
      topN = n;
      topMistakePlayer = name;
    }
  }

  const topCheat = cheatScores.find((c) => c.cheatRisk > 0) ?? null;

  return {
    totalMistakes: mistakes.length,
    economyMistakes,
    openingMistakes,
    tradeMistakes,
    utilityMistakes,
    cheatSignals,
    topMistakePlayer,
    highestCheatRiskPlayer: topCheat?.name ?? null,
  };
}

/**
 * Full demo analysis pipeline: parse → stats → heuristics → replay.
 * Progress pct is absolute within the post-upload pipeline (≈15–100).
 */
export function analyzeDemo(
  path: string,
  onProgress?: AnalyzeProgressFn,
): DemoAnalysis {
  const report = onProgress ?? (() => {});
  const parseProgress: ParseProgressFn = (detail, pct) => {
    report("parsing", detail, pct);
  };

  const demo = parseDemoFile(path, parseProgress);
  const rounds = countRounds(demo);
  const tickRate = tickRateFromHeader(demo.header);
  const rawMapName = mapNameFromHeader(demo.header);
  const mapName = mapCode(rawMapName) ?? rawMapName;

  report("analyzing", "Computing player stats…", 76);
  let players = computePlayerStats(demo, rounds);

  report("analyzing", "Checking economy…", 78);
  const economyMistakes = analyzeEconomy(demo);

  report("analyzing", "Checking openings & trades…", 82);
  const { mistakes: openingMistakes, players: withTrades } =
    analyzeOpeningAndTrades(demo, players, tickRate);
  players = withTrades;

  report("analyzing", "Checking utility…", 85);
  const utilityMistakes = analyzeUtility(demo);

  report("analyzing", "Running cheat heuristics…", 88);
  const { mistakes: cheatMistakes, cheatScores } = analyzeCheating(
    demo,
    players,
    tickRate,
  );

  const mistakes = [
    ...cheatMistakes,
    ...economyMistakes,
    ...openingMistakes,
    ...utilityMistakes,
  ].sort((a, b) => a.round - b.round || a.type.localeCompare(b.type));

  const match: MatchMeta = {
    mapName,
    tickRate,
    durationTicks:
      typeof demo.header.playback_ticks === "number"
        ? demo.header.playback_ticks
        : null,
    rounds,
    scoreCt: null,
    scoreT: null,
  };

  report("replay", "Building radar replay…", 92);
  const replay = buildReplay(demo, players, mapName, tickRate);
  report("replay", "Almost done…", 98);

  return {
    match,
    players,
    cheatScores,
    mistakes,
    summary: buildSummary(mistakes, cheatScores),
    replay,
  };
}

export type { DemoAnalysis };
