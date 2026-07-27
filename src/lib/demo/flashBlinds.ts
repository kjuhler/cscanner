import {
  isAliveValue,
  nameOf,
  normalizeSteamId,
  num,
  steamIdOf,
  str,
  tickOf,
} from "./helpers";
import type { DemoEventRow, ParsedDemo, ReplayBlind } from "./types";

const FULL_FLASH_DURATION_SEC = 2.5;

export function blindPercentFromBlind(blind: {
  duration: number;
  maxAlpha?: number;
}): number {
  // On HLTV demos flash_max_alpha is often stuck at 255 for everyone —
  // duration is the reliable signal for how hard someone was flashed.
  if (blind.duration > 0) {
    return Math.min(1, Math.max(0, blind.duration / FULL_FLASH_DURATION_SEC));
  }
  if (blind.maxAlpha != null && blind.maxAlpha > 0 && blind.maxAlpha < 255) {
    return Math.min(1, Math.max(0, blind.maxAlpha / 255));
  }
  return 0;
}

function enrichBlindPercent(blind: ReplayBlind): ReplayBlind {
  const blindPercent = blindPercentFromBlind(blind);
  return { ...blind, blindPercent };
}

/**
 * Collect blinds from player_blind events near a flash detonation.
 */
export function collectFlashBlindsFromEvents(
  demo: ParsedDemo,
  flashTick: number,
  throwerId: string | undefined,
  tickRate: number,
  teamById: Map<string, number>,
): ReplayBlind[] {
  const window = Math.max(12, Math.round(tickRate * 0.45));
  const blinds: ReplayBlind[] = [];
  const seen = new Set<string>();

  for (const row of demo.blinds) {
    const t = tickOf(row);
    if (Math.abs(t - flashTick) > window) continue;

    const attackerId = steamIdOf(row, "attacker");
    if (throwerId && attackerId && attackerId !== throwerId) continue;

    const victimId = steamIdOf(row, "user");
    if (!victimId || victimId === throwerId || seen.has(victimId)) continue;

    const duration = num(row, "blind_duration", "flash_duration", "duration");
    if (duration > 0 && duration < 0.3) continue;

    seen.add(victimId);
    blinds.push(
      enrichBlindPercent({
        steamId: victimId,
        name: nameOf(row, "user") || victimId,
        duration: duration || 1,
        team: teamById.get(victimId) ?? 0,
      }),
    );
  }

  blinds.sort((a, b) => b.duration - a.duration);
  return blinds;
}

/**
 * Fallback: infer blinds from flash_duration / flash_max_alpha tick samples.
 */
export function collectFlashBlindsFromTicks(
  demo: ParsedDemo,
  flashTick: number,
  throwerId: string | undefined,
  throwerTeam: number | undefined,
  tickRate: number,
  teamById: Map<string, number>,
  nameById: Map<string, string>,
): ReplayBlind[] {
  const window = Math.max(16, Math.round(tickRate * 1.25));
  const byPlayer = new Map<
    string,
    { duration: number; maxAlpha: number; team: number }
  >();

  for (const row of demo.flashTickSamples) {
    const t = tickOf(row);
    if (t < flashTick || t > flashTick + window) continue;

    const steamId = normalizeSteamId(str(row, "steamid", "steam_id"));
    if (!steamId || steamId === "0" || steamId === throwerId) continue;
    if (!isAliveValue(row)) continue;

    // HLTV: flash_max_alpha is often always 255 — only trust flash_duration.
    const duration = num(row, "flash_duration");
    if (duration <= 0.2) continue;

    const team =
      num(row, "team_num", "team_number") || teamById.get(steamId) || 0;
    const maxAlpha = num(row, "flash_max_alpha");

    const cur = byPlayer.get(steamId) ?? { duration: 0, maxAlpha: 0, team };
    cur.duration = Math.max(cur.duration, duration);
    cur.maxAlpha = Math.max(cur.maxAlpha, maxAlpha);
    if (team > 0) cur.team = team;
    byPlayer.set(steamId, cur);
  }

  const blinds: ReplayBlind[] = [];
  for (const [steamId, data] of byPlayer) {
    blinds.push(
      enrichBlindPercent({
        steamId,
        name: nameById.get(steamId) ?? steamId,
        duration: data.duration || data.maxAlpha / 100 || 1,
        team: data.team,
        maxAlpha: data.maxAlpha > 0 ? data.maxAlpha : undefined,
      }),
    );
  }

  blinds.sort((a, b) => (b.blindPercent ?? 0) - (a.blindPercent ?? 0));
  return blinds;
}

export function collectFlashBlinds(
  demo: ParsedDemo,
  flashTick: number,
  throwerId: string | undefined,
  tickRate: number,
  teamById: Map<string, number>,
  nameById: Map<string, string>,
): ReplayBlind[] {
  const throwerTeam = throwerId ? teamById.get(throwerId) : undefined;
  const fromEvents = collectFlashBlindsFromEvents(
    demo,
    flashTick,
    throwerId,
    tickRate,
    teamById,
  );

  if (fromEvents.length > 0) {
    return fromEvents;
  }

  return collectFlashBlindsFromTicks(
    demo,
    flashTick,
    throwerId,
    throwerTeam,
    tickRate,
    teamById,
    nameById,
  );
}

/** Merge tick alpha data into existing event-based blinds. */
export function mergeTickAlphaIntoBlinds(
  demo: ParsedDemo,
  flashTick: number,
  blinds: ReplayBlind[],
  tickRate: number,
): ReplayBlind[] {
  if (blinds.length === 0 || demo.flashTickSamples.length === 0) return blinds;

  const window = Math.max(12, Math.round(tickRate * 0.5));
  const alphaById = new Map<string, number>();

  for (const row of demo.flashTickSamples) {
    const t = tickOf(row);
    if (t < flashTick || t > flashTick + window) continue;
    const steamId = normalizeSteamId(str(row, "steamid", "steam_id"));
    if (!steamId) continue;
    const maxAlpha = num(row, "flash_max_alpha");
    if (maxAlpha > (alphaById.get(steamId) ?? 0)) {
      alphaById.set(steamId, maxAlpha);
    }
  }

  return blinds.map((b) => {
    const maxAlpha = alphaById.get(b.steamId);
    if (!maxAlpha) return b;
    return enrichBlindPercent({ ...b, maxAlpha });
  });
}

export function isEnemyBlind(
  blind: ReplayBlind,
  actorTeam: number | undefined,
): boolean {
  if (!actorTeam || blind.team <= 0) return true;
  return blind.team !== actorTeam;
}

export function enemyBlindCount(
  blinds: ReplayBlind[] | undefined,
  actorTeam: number | undefined,
): number {
  if (!blinds?.length) return 0;
  return blinds.filter((b) => isEnemyBlind(b, actorTeam)).length;
}

export function avgEnemyBlindPercent(
  blinds: ReplayBlind[] | undefined,
  actorTeam: number | undefined,
): number {
  const enemies = (blinds ?? []).filter((b) => isEnemyBlind(b, actorTeam));
  if (enemies.length === 0) return 0;
  const sum = enemies.reduce((s, b) => s + (b.blindPercent ?? 0), 0);
  return sum / enemies.length;
}

/** Rows grouped by tick for flash tick lookup. */
export function flashTickRowsAt(
  demo: ParsedDemo,
  tick: number,
): DemoEventRow[] {
  return demo.flashTickSamples.filter((r) => tickOf(r) === tick);
}
