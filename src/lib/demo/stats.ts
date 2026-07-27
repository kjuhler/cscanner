import {
  nameOf,
  normalizeSteamId,
  num,
  roundOf,
  steamIdOf,
  str,
  tickOf,
} from "./helpers";
import type { ParsedDemo, PlayerStats } from "./types";

type Acc = {
  steamId: string;
  name: string;
  team: number;
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  headshotKills: number;
  entries: number;
  flashAssists: number;
  enemiesFlashed: number;
  utilityDamage: number;
  firstDeaths: number;
  tradedDeaths: number;
  missedTrades: number;
};

function ensure(map: Map<string, Acc>, steamId: string, name: string): Acc {
  let acc = map.get(steamId);
  if (!acc) {
    acc = {
      steamId,
      name: name || steamId,
      team: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
      damage: 0,
      headshotKills: 0,
      entries: 0,
      flashAssists: 0,
      enemiesFlashed: 0,
      utilityDamage: 0,
      firstDeaths: 0,
      tradedDeaths: 0,
      missedTrades: 0,
    };
    map.set(steamId, acc);
  } else if (name && (!acc.name || acc.name === acc.steamId)) {
    acc.name = name;
  }
  return acc;
}

function isRealKill(row: ParsedDemo["deaths"][number]): boolean {
  const attacker = steamIdOf(row, "attacker");
  const victim = steamIdOf(row, "user");
  if (!attacker || !victim || attacker === victim) return false;
  // Ignore bomb/world/suicide-like kills without an attacker steamid.
  return true;
}

/**
 * Aggregate per-player match stats from death/hurt/blind events.
 */
export function computePlayerStats(
  demo: ParsedDemo,
  rounds: number,
): PlayerStats[] {
  const byId = new Map<string, Acc>();

  for (const p of demo.playerInfo) {
    const sid = normalizeSteamId(p.steamid);
    if (!sid || sid === "0") continue;
    const acc = ensure(byId, sid, p.name ?? "");
    if (typeof p.team_number === "number") acc.team = p.team_number;
  }

  // Opening (entry) = first valid kill each round.
  const firstKillRound = new Set<number>();
  const firstDeathRound = new Set<number>();

  const deathsSorted = [...demo.deaths].sort(
    (a, b) => tickOf(a) - tickOf(b),
  );

  for (const row of deathsSorted) {
    if (!isRealKill(row)) continue;
    const round = roundOf(row);
    const attackerId = steamIdOf(row, "attacker");
    const victimId = steamIdOf(row, "user");
    const attackerName = nameOf(row, "attacker");
    const victimName = nameOf(row, "user");
    const assisterId = steamIdOf(row, "assister");

    const attacker = ensure(byId, attackerId, attackerName);
    attacker.kills += 1;
    if (num(row, "headshot") === 1 || str(row, "headshot") === "true") {
      attacker.headshotKills += 1;
    }

    const victim = ensure(byId, victimId, victimName);
    victim.deaths += 1;

    if (assisterId && assisterId !== attackerId) {
      ensure(byId, assisterId, nameOf(row, "assister")).assists += 1;
    }

    if (!firstKillRound.has(round)) {
      firstKillRound.add(round);
      attacker.entries += 1;
    }
    if (!firstDeathRound.has(round)) {
      firstDeathRound.add(round);
      victim.firstDeaths += 1;
    }
  }

  for (const row of demo.hurts) {
    const attackerId = steamIdOf(row, "attacker");
    const victimId = steamIdOf(row, "user");
    if (!attackerId || attackerId === victimId) continue;
    const dmg = num(row, "dmg_health", "dmg_health_real");
    if (dmg <= 0) continue;
    const acc = ensure(byId, attackerId, nameOf(row, "attacker"));
    acc.damage += dmg;
    const weapon = str(row, "weapon").toLowerCase();
    if (
      weapon.includes("hegrenade") ||
      weapon.includes("inferno") ||
      weapon.includes("molotov") ||
      weapon.includes("incgrenade")
    ) {
      acc.utilityDamage += dmg;
    }
  }

  const teamById = new Map<string, number>();
  for (const p of demo.playerInfo) {
    const sid = normalizeSteamId(p.steamid);
    if (sid && typeof p.team_number === "number") {
      teamById.set(sid, p.team_number);
    }
  }
  for (const [, acc] of byId) {
    if (acc.team > 0) teamById.set(acc.steamId, acc.team);
  }

  for (const row of demo.blinds) {
    const attackerId = steamIdOf(row, "attacker");
    const victimId = steamIdOf(row, "user");
    if (!attackerId || !victimId || attackerId === victimId) continue;
    const attackerTeam = teamById.get(attackerId) ?? 0;
    const victimTeam = teamById.get(victimId) ?? 0;
    if (attackerTeam > 0 && victimTeam > 0 && attackerTeam === victimTeam) continue;
    ensure(byId, attackerId, nameOf(row, "attacker")).enemiesFlashed += 1;
  }

  const roundCount = Math.max(rounds, 1);

  return [...byId.values()]
    .filter((p) => p.kills + p.deaths + p.damage > 0 || p.team > 0)
    .map((p) => ({
      steamId: p.steamId,
      name: p.name,
      team: p.team,
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      damage: p.damage,
      adr: Math.round((p.damage / roundCount) * 10) / 10,
      hsPercent:
        p.kills > 0
          ? Math.round((p.headshotKills / p.kills) * 1000) / 10
          : 0,
      entries: p.entries,
      flashAssists: p.flashAssists,
      enemiesFlashed: p.enemiesFlashed,
      utilityDamage: p.utilityDamage,
      firstDeaths: p.firstDeaths,
      tradedDeaths: p.tradedDeaths,
      missedTrades: p.missedTrades,
    }))
    .sort((a, b) => b.kills - a.kills || b.adr - a.adr);
}

export function countRounds(demo: ParsedDemo): number {
  if (demo.roundEnds.length > 0) return demo.roundEnds.length;
  if (demo.roundStarts.length > 0) return demo.roundStarts.length;
  const maxRound = demo.deaths.reduce(
    (max, row) => Math.max(max, roundOf(row)),
    0,
  );
  return maxRound;
}
