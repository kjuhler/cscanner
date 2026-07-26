import {
  nameOf,
  normalizeSteamId,
  num,
  roundOf,
  steamIdOf,
  str,
} from "./helpers";
import type { Mistake, ParsedDemo } from "./types";

const FULL_BUY_EQUIPMENT = 4000;
const FORCE_BUY_CASH_MAX = 3000;
const FORCE_BUY_EQUIPMENT_MIN = 2500;
const GUN_ROUND_MIN_EQUIPMENT = 3500;

/**
 * Economy heuristics at freeze-end:
 * - Full buy without armor
 * - Low cash + expensive buy (force)
 */
export function analyzeEconomy(demo: ParsedDemo): Mistake[] {
  const mistakes: Mistake[] = [];

  if (demo.freezeTicks.length > 0) {
    for (const row of demo.freezeTicks) {
      const steamId = normalizeSteamId(
        str(row, "steamid", "steam_id", "player_steamid"),
      );
      if (!steamId || steamId === "0") continue;

      const name = str(row, "name", "player_name") || steamId;
      const round = roundOf(row);
      const cash = num(row, "balance", "m_iAccount", "account");
      const armor = num(row, "armor_value", "m_ArmorValue", "armor");
      const equip = num(
        row,
        "equipment_value_this_round",
        "equipment_value",
        "m_unCurrentEquipmentValue",
      );
      const alive = num(row, "is_alive", "m_bIsAlive");
      if (alive === 0) continue;

      if (equip >= GUN_ROUND_MIN_EQUIPMENT && armor <= 0) {
        mistakes.push({
          steamId,
          playerName: name,
          round,
          type: "economy",
          message: `Gun round without armor (equip ~$${equip})`,
          severity: "warn",
        });
      }

      if (cash > 0 && cash <= FORCE_BUY_CASH_MAX && equip >= FORCE_BUY_EQUIPMENT_MIN) {
        mistakes.push({
          steamId,
          playerName: name,
          round,
          type: "economy",
          message: `Likely force-buy: $${cash} cash with ~$${equip} equipment`,
          severity: "info",
        });
      }
    }
    return dedupeMistakes(mistakes);
  }

  // Fallback: infer from deaths early in round when no freeze tick props.
  // If a player dies with no armor and had significant equipment from hurts context — skip if no data.
  for (const row of demo.deaths) {
    const victimId = steamIdOf(row, "user");
    if (!victimId) continue;
    const armor = num(row, "user_armor", "armor");
    // Many demos expose armor on death events via player extra; without parse extras this may be 0 always.
    if (armor > 0) continue;
    const round = roundOf(row);
    // Only flag if there is at least one rifle kill in the round (gun round signal).
    const gunRound = demo.deaths.some((d) => {
      if (roundOf(d) !== round) return false;
      const w = str(d, "weapon").toLowerCase();
      return (
        w.includes("ak47") ||
        w.includes("m4a") ||
        w.includes("awp") ||
        w.includes("aug") ||
        w.includes("sg556") ||
        w.includes("galilar") ||
        w.includes("famas")
      );
    });
    if (!gunRound) continue;
    mistakes.push({
      steamId: victimId,
      playerName: nameOf(row, "user"),
      round,
      type: "economy",
      message: "Died without armor on a gun round",
      severity: "warn",
    });
  }

  return dedupeMistakes(mistakes);
}

function dedupeMistakes(mistakes: Mistake[]): Mistake[] {
  const seen = new Set<string>();
  const out: Mistake[] = [];
  for (const m of mistakes) {
    const key = `${m.steamId}|${m.round}|${m.type}|${m.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  // Soft-filter: avoid flooding when fallback fires for every death.
  if (out.filter((m) => m.message.includes("Died without armor")).length > 30) {
    return out.filter((m) => !m.message.includes("Died without armor"));
  }
  void FULL_BUY_EQUIPMENT;
  return out;
}
