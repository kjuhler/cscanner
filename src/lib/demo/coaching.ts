import type { Mistake, PlayerStats } from "./types";

export type CoachingArea =
  | "aim"
  | "utility"
  | "economy"
  | "teamplay"
  | "positioning";

export type CoachingPriority = "high" | "medium" | "low";

export type CoachingTip = {
  priority: CoachingPriority;
  area: CoachingArea;
  title: string;
  detail: string;
  practice: string;
};

type LeetifyContext = {
  aim: number | null;
  preaim: number | null;
  premier: number | null;
};

type SteamContext = {
  kd: number | null;
  hsPercent: number | null;
};

const PRIORITY_RANK: Record<CoachingPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function countMistakes(mistakes: Mistake[], steamId: string, type: Mistake["type"]) {
  return mistakes.filter((m) => m.steamId === steamId && m.type === type).length;
}

/**
 * Rule-based improvement tips from one demo + optional external stats.
 */
export function buildPlayerCoachingTips(opts: {
  player: PlayerStats;
  mistakes: Mistake[];
  rounds: number;
  leetify?: LeetifyContext | null;
  steam?: SteamContext | null;
  limit?: number;
}): CoachingTip[] {
  const { player, mistakes, rounds } = opts;
  const tips: CoachingTip[] = [];
  const sid = player.steamId;

  const economyFlags = countMistakes(mistakes, sid, "economy");
  const tradeFlags = countMistakes(mistakes, sid, "trade");
  const utilityFlags = countMistakes(mistakes, sid, "utility");
  const openingFlags = countMistakes(mistakes, sid, "opening");

  if (player.missedTrades >= 2 || tradeFlags >= 2) {
    tips.push({
      priority: "high",
      area: "teamplay",
      title: "Trade support",
      detail: `${player.missedTrades} missed trade${player.missedTrades === 1 ? "" : "s"} this match — teammates died in openings without a refrag.`,
      practice:
        "Play closer default spacing on opens; jiggle for info but stay within ~1.5s trade range.",
    });
  } else if (player.missedTrades === 1) {
    tips.push({
      priority: "medium",
      area: "teamplay",
      title: "Closer trade timing",
      detail: "One opening death went untraded.",
      practice:
        "When a teammate peeks first, hold the adjacent angle ready to shoot within a second of contact.",
    });
  }

  if (economyFlags >= 2) {
    tips.push({
      priority: "high",
      area: "economy",
      title: "Buy discipline",
      detail: `${economyFlags} economy issues flagged (force buys, missing armor on gun rounds).`,
      practice:
        "Review round types before buying: full buy, half-buy, or save. On gun rounds, prioritize armor + kit.",
    });
  } else if (economyFlags === 1) {
    tips.push({
      priority: "medium",
      area: "economy",
      title: "Tighter economy",
      detail: "At least one round had a questionable buy.",
      practice:
        "Check team money before forcing — one bad force can lose the next two rounds.",
    });
  }

  if (utilityFlags >= 2 || (rounds >= 12 && player.enemiesFlashed === 0)) {
    tips.push({
      priority: utilityFlags >= 2 ? "high" : "medium",
      area: "utility",
      title: "Utility impact",
      detail:
        utilityFlags > 0
          ? `${utilityFlags} utility issue${utilityFlags === 1 ? "" : "s"} (wasted flashes or HE).`
          : "No enemies flashed despite a full-length match.",
      practice:
        "Learn 2–3 map lineups per side; throw flashes before peeking, not after teammates are already exposed.",
    });
  } else if (player.utilityDamage < 20 && rounds >= 10) {
    tips.push({
      priority: "low",
      area: "utility",
      title: "More nade damage",
      detail: `Only ${player.utilityDamage} utility damage — HE/molotovs aren't contributing much.`,
      practice:
        "Pre-throw HE on common stacks and molly choke points before your team commits.",
    });
  }

  const hs = player.hsPercent;
  const adr = player.adr;
  if (hs < 28 && adr < 75) {
    tips.push({
      priority: "high",
      area: "aim",
      title: "Aim + damage output",
      detail: `HS% ${hs} and ADR ${adr} are both low for this match.`,
      practice:
        "10–15 min daily: aim map headshots, then DM focusing on crosshair at head height before peeking.",
    });
  } else if (hs < 32) {
    tips.push({
      priority: "medium",
      area: "aim",
      title: "Headshot consistency",
      detail: `HS% ${hs} — many kills are body shots.`,
      practice:
        "Slow peek drills: place crosshair on expected head level, tap instead of spray at range.",
    });
  } else if (adr < 70 && player.deaths > player.kills) {
    tips.push({
      priority: "medium",
      area: "aim",
      title: "More round impact",
      detail: `ADR ${adr} with a negative K/D — low damage traded per life.`,
      practice:
        "Take safer duels, use utility to soften targets, and re-peek after teammate contact.",
    });
  }

  if (player.firstDeaths >= 3 && player.entries <= 1) {
    tips.push({
      priority: "high",
      area: "positioning",
      title: "Opening deaths",
      detail: `${player.firstDeaths} first deaths with only ${player.entries} entry kills.`,
      practice:
        "Let a dedicated entry go first, or wide-swing with flash support instead of dry peeking.",
    });
  } else if (openingFlags >= 1) {
    tips.push({
      priority: "medium",
      area: "positioning",
      title: "Opening duels",
      detail: "Flagged in opening/trade situations this match.",
      practice:
        "Use jiggle peeks for info; commit only when you have utility or a trade partner ready.",
    });
  }

  const leetifyPreaim = opts.leetify?.preaim;
  if (leetifyPreaim != null && leetifyPreaim < 55) {
    tips.push({
      priority: "medium",
      area: "aim",
      title: "Pre-aim (Leetify)",
      detail: `Leetify pre-aim rating ${leetifyPreaim} is below average.`,
      practice:
        "Pre-aim common angles on your main maps; walk through sites with crosshair on head-level clears.",
    });
  }

  const leetifyAim = opts.leetify?.aim;
  if (leetifyAim != null && leetifyAim < 50 && !tips.some((t) => t.area === "aim")) {
    tips.push({
      priority: "medium",
      area: "aim",
      title: "Aim rating (Leetify)",
      detail: `Leetify aim rating ${leetifyAim} suggests mechanical improvement room.`,
      practice:
        "Routine: 5 min flicking, 5 min tracking, then one DM focusing only on crosshair placement.",
    });
  }

  if (tips.length === 0) {
    tips.push({
      priority: "low",
      area: "teamplay",
      title: "Solid baseline",
      detail:
        "No major recurring issues flagged in this demo — focus on consistency and review close rounds.",
      practice:
        "Re-watch 2–3 lost rounds and note one decision you could repeat or fix next match.",
    });
  }

  tips.sort(
    (a, b) =>
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      a.title.localeCompare(b.title),
  );

  const limit = opts.limit ?? 5;
  return tips.slice(0, limit);
}
