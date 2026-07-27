import { buildCoachingHighlights } from "./highlights";
import { enemyBlindCount, isEnemyBlind } from "./flashBlinds";
import type { DemoAnalysis, Mistake, PlayerStats } from "./types";
import { normalizeAnalysis } from "./validateAnalysis";

function buildSummary(
  mistakes: Mistake[],
  cheatSignals: number,
  highestCheatRiskPlayer: string | null,
): DemoAnalysis["summary"] {
  const economyMistakes = mistakes.filter((m) => m.type === "economy").length;
  const openingMistakes = mistakes.filter((m) => m.type === "opening").length;
  const tradeMistakes = mistakes.filter((m) => m.type === "trade").length;
  const utilityMistakes = mistakes.filter((m) => m.type === "utility").length;

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

  return {
    totalMistakes: mistakes.length,
    economyMistakes,
    openingMistakes,
    tradeMistakes,
    utilityMistakes,
    cheatSignals,
    topMistakePlayer,
    highestCheatRiskPlayer,
  };
}

function rederivePlayerFlashStats(
  analysis: DemoAnalysis,
): PlayerStats[] {
  const replay = analysis.replay;
  if (!replay) return analysis.players;

  const flashAssists = new Map<string, number>();
  const enemiesFlashed = new Map<string, number>();

  for (const ev of replay.events) {
    if (ev.kind !== "flash" || !ev.actorSteamId) continue;
    const actorTeam = ev.actorTeam;
    const enemyCount = enemyBlindCount(ev.blinds, actorTeam);
    if (enemyCount > 0) {
      enemiesFlashed.set(
        ev.actorSteamId,
        (enemiesFlashed.get(ev.actorSteamId) ?? 0) + enemyCount,
      );
    }

    for (const blind of ev.blinds ?? []) {
      if (!isEnemyBlind(blind, actorTeam)) continue;
      const chainKill = replay.events.find(
        (k) =>
          k.kind === "kill" &&
          k.round === ev.round &&
          k.tick > ev.tick &&
          k.tick <= ev.tick + replay.tickRate * 3 &&
          k.targetSteamId === blind.steamId &&
          k.actorTeam === actorTeam,
      );
      if (chainKill?.actorSteamId && chainKill.actorSteamId !== ev.actorSteamId) {
        flashAssists.set(
          ev.actorSteamId,
          (flashAssists.get(ev.actorSteamId) ?? 0) + 1,
        );
      }
    }
  }

  return analysis.players.map((p) => ({
    ...p,
    enemiesFlashed: enemiesFlashed.get(p.steamId) ?? p.enemiesFlashed,
    flashAssists: flashAssists.get(p.steamId) ?? p.flashAssists,
  }));
}

function rebuildUtilityMistakesFromReplay(
  analysis: DemoAnalysis,
): Mistake[] {
  const replay = analysis.replay;
  if (!replay) return analysis.mistakes;

  const nonUtility = analysis.mistakes.filter((m) => m.type !== "utility");
  const utility: Mistake[] = [];

  for (const ev of replay.events) {
    if (ev.kind !== "flash" || !ev.actorSteamId) continue;
    const enemies = enemyBlindCount(ev.blinds, ev.actorTeam);
    if (enemies > 0) continue;
    utility.push({
      steamId: ev.actorSteamId,
      playerName: ev.actorName ?? ev.actorSteamId,
      round: ev.round,
      type: "utility",
      message: "Flashbang with no enemy flashed",
      severity: "info",
    });
  }

  return [...nonUtility, ...utility].sort(
    (a, b) => a.round - b.round || a.type.localeCompare(b.type),
  );
}

/**
 * Recompute replay-derived coaching fields from stored analysis JSON.
 * Does not re-parse the .dem (no economy/cheat/opening re-run).
 */
export function reanalyzeFromStored(analysis: DemoAnalysis): DemoAnalysis {
  const normalized = normalizeAnalysis(analysis);
  const players = rederivePlayerFlashStats(normalized);
  const highlights = buildCoachingHighlights(normalized.replay, players);
  const mistakes = rebuildUtilityMistakesFromReplay({
    ...normalized,
    players,
  });

  return {
    ...normalized,
    players,
    highlights,
    mistakes,
    summary: buildSummary(
      mistakes,
      normalized.summary.cheatSignals,
      normalized.summary.highestCheatRiskPlayer,
    ),
  };
}
