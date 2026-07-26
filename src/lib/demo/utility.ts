import {
  nameOf,
  num,
  roundOf,
  steamIdOf,
  str,
  tickOf,
} from "./helpers";
import type { Mistake, ParsedDemo } from "./types";

/**
 * Utility efficiency heuristics:
 * - Flashbang with no enemy blind nearby in time
 * - HE grenade with zero damage attributed
 */
export function analyzeUtility(demo: ParsedDemo): Mistake[] {
  const mistakes: Mistake[] = [];

  const blindsByRound = new Map<number, typeof demo.blinds>();
  for (const blind of demo.blinds) {
    const round = roundOf(blind);
    const list = blindsByRound.get(round) ?? [];
    list.push(blind);
    blindsByRound.set(round, list);
  }

  for (const flash of demo.flashDetonates) {
    const throwerId =
      steamIdOf(flash, "thrower") || steamIdOf(flash, "user");
    if (!throwerId) continue;
    const throwerName =
      nameOf(flash, "thrower") || nameOf(flash, "user") || throwerId;
    const round = roundOf(flash);
    const flashTick = tickOf(flash);

    const blinds = blindsByRound.get(round) ?? [];
    const enemyBlind = blinds.some((b) => {
      const attackerId = steamIdOf(b, "attacker");
      const victimId = steamIdOf(b, "user");
      if (attackerId !== throwerId) return false;
      if (!victimId || victimId === throwerId) return false;
      const bt = tickOf(b);
      // Blind events usually land within a short window of detonate.
      return Math.abs(bt - flashTick) <= 128; // ~2s at 64 tick
    });

    if (!enemyBlind) {
      mistakes.push({
        steamId: throwerId,
        playerName: throwerName,
        round,
        type: "utility",
        message: "Flashbang with no enemy flashed",
        severity: "info",
      });
    }
  }

  // HE damage by round+approximate thrower via player_hurt weapon hegrenade.
  const heDamageByRoundPlayer = new Map<string, number>();
  for (const hurt of demo.hurts) {
    const weapon = str(hurt, "weapon").toLowerCase();
    if (!weapon.includes("hegrenade")) continue;
    const attackerId = steamIdOf(hurt, "attacker");
    if (!attackerId) continue;
    const key = `${roundOf(hurt)}|${attackerId}`;
    heDamageByRoundPlayer.set(
      key,
      (heDamageByRoundPlayer.get(key) ?? 0) +
        num(hurt, "dmg_health", "dmg_health_real"),
    );
  }

  for (const he of demo.heDetonates) {
    const throwerId = steamIdOf(he, "thrower") || steamIdOf(he, "user");
    if (!throwerId) continue;
    const throwerName =
      nameOf(he, "thrower") || nameOf(he, "user") || throwerId;
    const round = roundOf(he);
    const dmg = heDamageByRoundPlayer.get(`${round}|${throwerId}`) ?? 0;
    if (dmg <= 0) {
      mistakes.push({
        steamId: throwerId,
        playerName: throwerName,
        round,
        type: "utility",
        message: "HE grenade dealt 0 damage",
        severity: "info",
      });
    }
  }

  return mistakes;
}
