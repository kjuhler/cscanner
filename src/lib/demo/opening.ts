import {
  nameOf,
  num,
  roundOf,
  secondsBetween,
  steamIdOf,
  tickOf,
} from "./helpers";
import { buildSceneAtTick } from "./scene";
import type { Mistake, ParsedDemo, PlayerStats, SceneMarker } from "./types";

const TRADE_WINDOW_SECONDS = 5;

type OpeningKill = {
  round: number;
  tick: number;
  attackerId: string;
  attackerName: string;
  attackerTeam: number;
  victimId: string;
  victimName: string;
  victimTeam: number;
};

/**
 * Opening duels + trade window analysis.
 * First valid kill each round is the opening; a teammate killing the opener's
 * killer within TRADE_WINDOW_SECONDS is a successful trade.
 */
export function analyzeOpeningAndTrades(
  demo: ParsedDemo,
  players: PlayerStats[],
  tickRate: number,
): { mistakes: Mistake[]; players: PlayerStats[] } {
  const teamById = new Map(players.map((p) => [p.steamId, p.team]));
  const nameById = new Map(players.map((p) => [p.steamId, p.name]));
  const updated = players.map((p) => ({ ...p }));
  const byId = new Map(updated.map((p) => [p.steamId, p]));

  const deathsSorted = [...demo.deaths].sort(
    (a, b) => tickOf(a) - tickOf(b),
  );

  const openings: OpeningKill[] = [];
  const seenRounds = new Set<number>();

  for (const row of deathsSorted) {
    const attackerId = steamIdOf(row, "attacker");
    const victimId = steamIdOf(row, "user");
    if (!attackerId || !victimId || attackerId === victimId) continue;

    const round = roundOf(row);
    if (seenRounds.has(round)) continue;
    seenRounds.add(round);

    openings.push({
      round,
      tick: tickOf(row),
      attackerId,
      attackerName:
        nameOf(row, "attacker") || nameById.get(attackerId) || attackerId,
      attackerTeam: teamById.get(attackerId) ?? num(row, "attacker_team_num"),
      victimId,
      victimName: nameOf(row, "user") || nameById.get(victimId) || victimId,
      victimTeam: teamById.get(victimId) ?? num(row, "user_team_num"),
    });
  }

  const mistakes: Mistake[] = [];

  for (const opening of openings) {
    const tradeKill = deathsSorted.find((row) => {
      if (roundOf(row) !== opening.round) return false;
      const tick = tickOf(row);
      if (tick <= opening.tick) return false;
      if (secondsBetween(opening.tick, tick, tickRate) > TRADE_WINDOW_SECONDS) {
        return false;
      }
      const attackerId = steamIdOf(row, "attacker");
      const victimId = steamIdOf(row, "user");
      if (victimId !== opening.attackerId) return false;
      if (!attackerId || attackerId === opening.victimId) return false;

      const traderTeam = teamById.get(attackerId);
      const victimTeam = opening.victimTeam;
      if (traderTeam && victimTeam && traderTeam === victimTeam) return true;
      if (!traderTeam || !victimTeam) return true;
      return false;
    });

    const victim = byId.get(opening.victimId);
    if (tradeKill) {
      if (victim) victim.tradedDeaths += 1;
      continue;
    }

    if (victim) victim.missedTrades += 1;

    const teammates = updated.filter(
      (p) =>
        p.steamId !== opening.victimId &&
        opening.victimTeam > 0 &&
        p.team === opening.victimTeam,
    );

    const roles: Record<string, SceneMarker["role"]> = {
      [opening.victimId]: "victim",
      [opening.attackerId]: "attacker",
    };
    for (const mate of teammates) {
      roles[mate.steamId] = "teammate";
    }

    const scene = buildSceneAtTick(demo, opening.tick, roles, {
      includeDead: true,
      focusSteamId: opening.victimId,
    });

    const mateNames = teammates.map((t) => t.name).slice(0, 4);
    const mateHint =
      mateNames.length > 0
        ? ` — teammates nearby: ${mateNames.join(", ")}`
        : "";

    mistakes.push({
      steamId: opening.victimId,
      playerName: opening.victimName,
      round: opening.round,
      type: "trade",
      message: `Missed trade: ${opening.victimName} died in opening vs ${opening.attackerName} (no trade within ${TRADE_WINDOW_SECONDS}s)${mateHint}`,
      severity: "warn",
      relatedSteamIds: teammates.map((t) => t.steamId),
      scene,
    });
  }

  return { mistakes, players: updated };
}
