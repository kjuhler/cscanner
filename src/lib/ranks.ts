const COMPETITIVE_RANKS: Record<number, string> = {
  1: "Silver I",
  2: "Silver II",
  3: "Silver III",
  4: "Silver IV",
  5: "Silver Elite",
  6: "Silver Elite Master",
  7: "Gold Nova I",
  8: "Gold Nova II",
  9: "Gold Nova III",
  10: "Gold Nova Master",
  11: "Master Guardian I",
  12: "Master Guardian II",
  13: "Master Guardian Elite",
  14: "Distinguished Master Guardian",
  15: "Legendary Eagle",
  16: "Legendary Eagle Master",
  17: "Supreme Master First Class",
  18: "Global Elite",
};

/** Official CS2 panorama skill-group SVGs (extracted from game files). */
const CS2_ICON_BASE =
  "https://cdn.jsdelivr.net/gh/Juknum/counter-strike-icons@main/cs2/panorama/images";

const FACEIT_ICON_BASE =
  "https://cdn.jsdelivr.net/gh/itzarty/csgo-rank-icons@main/faceit";

export function competitiveRankName(rank: number): string {
  return COMPETITIVE_RANKS[rank] ?? (rank > 0 ? `Rank ${rank}` : "Unranked");
}

export function formatPremier(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US").format(value);
}

/** CS2 competitive skill-group badge (1–18). Wide in-game icon. */
export function competitiveRankIconUrl(
  rank: number | null | undefined,
): string | null {
  if (rank == null || rank < 1 || rank > 18) return null;
  return `${CS2_ICON_BASE}/icons/skillgroups/skillgroup${rank}.svg`;
}

/** FACEIT level icon (1–10). */
export function faceitLevelIconUrl(
  level: number | null | undefined,
): string | null {
  if (level == null || level < 1 || level > 10) return null;
  return `${FACEIT_ICON_BASE}/${level}.svg`;
}

/** Official Premier rating plate background (uncolored Valve asset). */
export function premierRatingBgUrl(hasRating: boolean): string {
  return hasRating
    ? `${CS2_ICON_BASE}/icons/ui/premier_rating_bg.svg`
    : `${CS2_ICON_BASE}/icons/ui/premier_rating_bg_none.svg`;
}

/** CS2Tracker-style Premier tier keys (their assets collapse pink into purple). */
export type PremierTierKey =
  | "gray"
  | "light_blue"
  | "dark_blue"
  | "purple"
  | "red"
  | "yellow";

/**
 * Premier tier — same bands/colors as CS2Tracker.
 * gray <5k · light_blue 5k · dark_blue 10k · purple 15k · red 25k · yellow 30k+
 */
export function premierTierKey(
  rating: number | null | undefined,
): PremierTierKey {
  if (rating == null || Number.isNaN(rating) || rating < 5000) return "gray";
  if (rating < 10000) return "light_blue";
  if (rating < 15000) return "dark_blue";
  if (rating < 25000) return "purple";
  if (rating < 30000) return "red";
  return "yellow";
}

/** Text / glow color for Premier banner (CS2Tracker palette). */
export function premierTierColor(rating: number | null | undefined): string {
  switch (premierTierKey(rating)) {
    case "yellow":
      return "#FCD312";
    case "red":
      return "#FE544B";
    case "purple":
      return "#D677FB";
    case "dark_blue":
      return "#6684F0";
    case "light_blue":
      return "#72BFE7";
    default:
      return "#B5C4D0";
  }
}

/** Colored Premier plate SVG (CS2Tracker-style assets). */
export function premierTierBgUrl(
  rating: number | null | undefined,
  ranked = false,
): string {
  const key = ranked ? premierTierKey(rating) : "gray";
  return `/images/premier_ranks/${key}.svg`;
}
