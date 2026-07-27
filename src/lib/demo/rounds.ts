import { num, roundOf, tickOf } from "./helpers";
import type { ParsedDemo } from "./types";

export type RoundScore = {
  round: number;
  ctScore: number;
  tScore: number;
  tick: number;
};

/** Running scores at each round end (1-indexed round number). */
export function buildRoundScores(demo: ParsedDemo): RoundScore[] {
  const rows = [...demo.roundEnds]
    .map((row) => ({
      round: roundOf(row),
      ctScore: num(row, "ct_score", "CT_Score", "score_ct"),
      tScore: num(row, "t_score", "T_Score", "score_t"),
      tick: tickOf(row),
    }))
    .filter((r) => r.round > 0)
    .sort((a, b) => a.round - b.round);

  if (rows.length === 0) return [];

  let ct = 0;
  let t = 0;
  const out: RoundScore[] = [];
  for (const row of rows) {
    if (row.ctScore > 0 || row.tScore > 0) {
      ct = row.ctScore;
      t = row.tScore;
    } else {
      const winner = num(
        demo.roundEnds.find((r) => roundOf(r) === row.round) ?? {},
        "winner",
      );
      if (winner === 3) ct += 1;
      else if (winner === 2) t += 1;
    }
    out.push({ round: row.round, ctScore: ct, tScore: t, tick: row.tick });
  }
  return out;
}

export function scoreAtRoundStart(
  roundScores: RoundScore[],
  round: number,
): { ct: number; t: number } {
  const prev = roundScores.filter((r) => r.round < round).at(-1);
  return { ct: prev?.ctScore ?? 0, t: prev?.tScore ?? 0 };
}

export function isPressureRound(
  team: number,
  round: number,
  roundScores: RoundScore[],
  deficit = 3,
): boolean {
  if (team !== 2 && team !== 3) return false;
  const { ct, t } = scoreAtRoundStart(roundScores, round);
  const my = team === 3 ? ct : t;
  const their = team === 3 ? t : ct;
  return their - my >= deficit;
}

export function roundStartTick(demo: ParsedDemo, round: number): number {
  const row = demo.roundStarts.find((r) => roundOf(r) === round);
  return row ? tickOf(row) : 0;
}

export function roundFreezeEndTick(demo: ParsedDemo, round: number): number {
  const row = demo.roundFreezeEnds.find((r) => roundOf(r) === round);
  return row ? tickOf(row) : 0;
}
