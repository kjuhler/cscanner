/**
 * CS2Tracker-style "Aims like / Positions like" Premier estimates.
 * Aim/positioning/utility/opening/clutch tables mirrored from cs2tracker.gg.
 * Extra Leetify stats use the same interpolation style.
 */

export type SkillLikeKey =
  | "aim"
  | "positioning"
  | "utility"
  | "opening"
  | "clutch"
  | "hs"
  | "preaim"
  | "ttd"
  | "kd"
  | "spotted"
  | "spray"
  | "counterStrafe"
  | "openingDuel"
  | "trade"
  | "flashKill"
  | "enemiesFlashed"
  | "teammatesFlashed"
  | "heDamage"
  | "utilityDeath";

type RankPoint = { value: number; rank: number };

const SKILL_TO_PREMIER: Record<SkillLikeKey, RankPoint[]> = {
  aim: [
    { value: 20, rank: 500 },
    { value: 30, rank: 2000 },
    { value: 40, rank: 4500 },
    { value: 50, rank: 8000 },
    { value: 58, rank: 11000 },
    { value: 65, rank: 15000 },
    { value: 72, rank: 19000 },
    { value: 80, rank: 25000 },
    { value: 88, rank: 30000 },
    { value: 95, rank: 35000 },
  ],
  positioning: [
    { value: 15, rank: 500 },
    { value: 25, rank: 2000 },
    { value: 35, rank: 4500 },
    { value: 45, rank: 8000 },
    { value: 51, rank: 11000 },
    { value: 58, rank: 15000 },
    { value: 65, rank: 19000 },
    { value: 72, rank: 25000 },
    { value: 80, rank: 30000 },
    { value: 88, rank: 35000 },
  ],
  utility: [
    { value: 20, rank: 500 },
    { value: 30, rank: 2000 },
    { value: 40, rank: 4500 },
    { value: 48, rank: 8000 },
    { value: 55, rank: 11000 },
    { value: 62, rank: 15000 },
    { value: 70, rank: 19000 },
    { value: 78, rank: 25000 },
    { value: 85, rank: 30000 },
    { value: 92, rank: 35000 },
  ],
  // Raw Leetify opening (~ -0.03 … 0.03), not the ×100 display value
  opening: [
    { value: -0.03, rank: 1066 },
    { value: -0.02, rank: 2120 },
    { value: -0.013, rank: 3126 },
    { value: -0.01, rank: 4117 },
    { value: -0.005, rank: 5094 },
    { value: 0, rank: 8878 },
    { value: 0.003, rank: 11375 },
    { value: 0.007, rank: 14918 },
    { value: 0.01, rank: 17376 },
    { value: 0.013, rank: 19920 },
    { value: 0.017, rank: 23115 },
    { value: 0.02, rank: 26500 },
    { value: 0.025, rank: 28853 },
    { value: 0.031, rank: 30088 },
  ],
  // Raw clutch ratio (0–1), not percent
  clutch: [
    { value: 0.093, rank: 1066 },
    { value: 0.105, rank: 1871 },
    { value: 0.112, rank: 4117 },
    { value: 0.116, rank: 5094 },
    { value: 0.12, rank: 8878 },
    { value: 0.123, rank: 9921 },
    { value: 0.125, rank: 13380 },
    { value: 0.127, rank: 15076 },
    { value: 0.13, rank: 19117 },
    { value: 0.132, rank: 19920 },
    { value: 0.135, rank: 22618 },
    { value: 0.14, rank: 25085 },
    { value: 0.15, rank: 28853 },
    { value: 0.17, rank: 30088 },
  ],
  hs: [
    { value: 8, rank: 1000 },
    { value: 12, rank: 4000 },
    { value: 16, rank: 8000 },
    { value: 20, rank: 12000 },
    { value: 24, rank: 16000 },
    { value: 28, rank: 20000 },
    { value: 32, rank: 24000 },
    { value: 36, rank: 28000 },
    { value: 42, rank: 32000 },
    { value: 50, rank: 36000 },
  ],
  preaim: [
    { value: 4, rank: 34000 },
    { value: 6, rank: 28000 },
    { value: 8, rank: 23000 },
    { value: 10, rank: 18000 },
    { value: 12, rank: 14000 },
    { value: 14, rank: 10000 },
    { value: 16, rank: 7000 },
    { value: 20, rank: 3500 },
    { value: 25, rank: 1500 },
  ],
  // Lower ms = better. Anchored near public pro/community bands
  // (roughly ~450–550ms strong, ~600ms average, sub-~350 suspicious).
  ttd: [
    { value: 350, rank: 35000 },
    { value: 400, rank: 30000 },
    { value: 450, rank: 25000 },
    { value: 500, rank: 20000 },
    { value: 550, rank: 15000 },
    { value: 600, rank: 11000 },
    { value: 650, rank: 8000 },
    { value: 700, rank: 5000 },
    { value: 800, rank: 2500 },
    { value: 900, rank: 1000 },
  ],
  kd: [
    { value: 0.6, rank: 1500 },
    { value: 0.75, rank: 4000 },
    { value: 0.9, rank: 8000 },
    { value: 1.0, rank: 12000 },
    { value: 1.1, rank: 16000 },
    { value: 1.2, rank: 20000 },
    { value: 1.35, rank: 25000 },
    { value: 1.5, rank: 30000 },
    { value: 1.75, rank: 35000 },
  ],
  // Accuracy (enemy spotted) %
  spotted: [
    { value: 18, rank: 1500 },
    { value: 22, rank: 4000 },
    { value: 26, rank: 8000 },
    { value: 30, rank: 12000 },
    { value: 34, rank: 16000 },
    { value: 38, rank: 20000 },
    { value: 42, rank: 25000 },
    { value: 46, rank: 30000 },
    { value: 52, rank: 35000 },
  ],
  // Spray accuracy %
  spray: [
    { value: 18, rank: 1500 },
    { value: 22, rank: 4000 },
    { value: 26, rank: 8000 },
    { value: 30, rank: 12000 },
    { value: 34, rank: 16000 },
    { value: 38, rank: 20000 },
    { value: 42, rank: 25000 },
    { value: 46, rank: 30000 },
    { value: 52, rank: 35000 },
  ],
  // Counter-strafe good shots %
  counterStrafe: [
    { value: 60, rank: 2000 },
    { value: 70, rank: 6000 },
    { value: 78, rank: 10000 },
    { value: 84, rank: 15000 },
    { value: 88, rank: 20000 },
    { value: 91, rank: 25000 },
    { value: 94, rank: 30000 },
    { value: 97, rank: 35000 },
  ],
  // Opening duel success %
  openingDuel: [
    { value: 30, rank: 2000 },
    { value: 35, rank: 6000 },
    { value: 40, rank: 10000 },
    { value: 45, rank: 15000 },
    { value: 50, rank: 20000 },
    { value: 55, rank: 25000 },
    { value: 60, rank: 30000 },
    { value: 65, rank: 35000 },
  ],
  // Trade kill success %
  trade: [
    { value: 30, rank: 2000 },
    { value: 35, rank: 6000 },
    { value: 40, rank: 10000 },
    { value: 45, rank: 14000 },
    { value: 50, rank: 18000 },
    { value: 55, rank: 23000 },
    { value: 60, rank: 28000 },
    { value: 68, rank: 35000 },
  ],
  // Flashbangs leading to kills (avg)
  flashKill: [
    { value: 1, rank: 2000 },
    { value: 2, rank: 6000 },
    { value: 3, rank: 10000 },
    { value: 4, rank: 15000 },
    { value: 5, rank: 20000 },
    { value: 6.5, rank: 25000 },
    { value: 8, rank: 30000 },
    { value: 10, rank: 35000 },
  ],
  // Enemies flashed per flashbang
  enemiesFlashed: [
    { value: 0.2, rank: 2000 },
    { value: 0.35, rank: 6000 },
    { value: 0.45, rank: 10000 },
    { value: 0.55, rank: 15000 },
    { value: 0.7, rank: 20000 },
    { value: 0.9, rank: 25000 },
    { value: 1.1, rank: 30000 },
    { value: 1.4, rank: 35000 },
  ],
  // Teammates flashed per flashbang (lower is better)
  teammatesFlashed: [
    { value: 0.05, rank: 35000 },
    { value: 0.1, rank: 30000 },
    { value: 0.15, rank: 25000 },
    { value: 0.2, rank: 20000 },
    { value: 0.3, rank: 15000 },
    { value: 0.4, rank: 10000 },
    { value: 0.55, rank: 6000 },
    { value: 0.8, rank: 2000 },
  ],
  // HE damage to enemies per nade
  heDamage: [
    { value: 2, rank: 2000 },
    { value: 4, rank: 6000 },
    { value: 6, rank: 10000 },
    { value: 8, rank: 15000 },
    { value: 10, rank: 20000 },
    { value: 14, rank: 25000 },
    { value: 18, rank: 30000 },
    { value: 24, rank: 35000 },
  ],
  // Unused utility $ on death (lower is better)
  utilityDeath: [
    { value: 50, rank: 35000 },
    { value: 100, rank: 30000 },
    { value: 150, rank: 25000 },
    { value: 200, rank: 20000 },
    { value: 250, rank: 15000 },
    { value: 300, rank: 10000 },
    { value: 350, rank: 6000 },
    { value: 450, rank: 2000 },
  ],
};

function interpolateRank(points: RankPoint[], value: number): number {
  if (points.length === 0) return 0;
  if (!Number.isFinite(value) || value <= points[0].value) return points[0].rank;
  const last = points[points.length - 1];
  if (value >= last.value) return last.rank;

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (value >= a.value && value <= b.value) {
      const span = b.value - a.value;
      const t = span === 0 ? 0 : (value - a.value) / span;
      return a.rank + t * (b.rank - a.rank);
    }
  }
  return last.rank;
}

/**
 * Estimate Premier rating from a Leetify skill score.
 * Rounds to nearest 250 (CS2Tracker display convention).
 */
export function skillLikePremier(
  skill: SkillLikeKey,
  value: number | null | undefined,
): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const points = SKILL_TO_PREMIER[skill];
  if (!points?.length) return null;
  const raw = interpolateRank(points, value);
  const rounded = Math.round(raw / 250) * 250;
  return rounded > 0 ? rounded : null;
}

/** Convert our stored opening (×100 display) back to Leetify raw. */
export function openingRawFromDisplay(
  opening: number | null | undefined,
): number | null {
  if (opening == null || !Number.isFinite(opening)) return null;
  return Math.abs(opening) > 0.2 ? opening / 100 : opening;
}

/** Convert our stored clutch percent back to 0–1 ratio. */
export function clutchRawFromDisplay(
  clutch: number | null | undefined,
): number | null {
  if (clutch == null || !Number.isFinite(clutch)) return null;
  return clutch > 1 ? clutch / 100 : clutch;
}

export const SKILL_LIKE_LABELS: Record<
  SkillLikeKey,
  { title: string; like: string }
> = {
  aim: { title: "Aim", like: "Aims like" },
  positioning: { title: "Positioning", like: "Positions like" },
  utility: { title: "Utility", like: "Utility like" },
  opening: { title: "Opening", like: "Duels like" },
  clutch: { title: "Clutch", like: "Clutches like" },
  hs: { title: "HS%", like: "HS like" },
  preaim: { title: "Crosshair placement", like: "Places like" },
  ttd: { title: "Time to DMG", like: "Reacts like" },
  kd: { title: "K/D", like: "K/D like" },
  spotted: { title: "Enemy spotted acc.", like: "Shoots like" },
  spray: { title: "Spray accuracy", like: "Sprays like" },
  counterStrafe: { title: "Counter-strafe", like: "Strafes like" },
  openingDuel: { title: "Opening duels", like: "Opens like" },
  trade: { title: "Trade kills", like: "Trades like" },
  flashKill: { title: "Flash → kill", like: "Flashes like" },
  enemiesFlashed: { title: "Enemies/flash", like: "Blinds like" },
  teammatesFlashed: { title: "Team flashed/FB", like: "Teamflash like" },
  heDamage: { title: "HE dmg / nade", like: "HEs like" },
  utilityDeath: { title: "Util on death", like: "Buys like" },
};
