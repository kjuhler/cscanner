import type {
  CompositeMetric,
  CompositeScores,
  CsrepProfile,
  CsstatProfile,
  FaceitPlayer,
  FaceitStats,
  LeetifyProfile,
  LeetifyWindows,
  SteamCs2Stats,
  TrustAssessment,
} from "@/lib/types";

type SourceLabel =
  | "cscanner"
  | "csrep"
  | "steam"
  | "faceit"
  | "leetify"
  | "csstat"
  | "scope";

function avg(values: Array<{ source: SourceLabel; value: number }>): CompositeMetric | null {
  if (values.length < 2) return null;
  const sum = values.reduce((a, v) => a + v.value, 0);
  return {
    value: Math.round((sum / values.length) * 10) / 10,
    sources: values.map((v) => v.source),
  };
}

function pushIf(
  out: Array<{ source: SourceLabel; value: number }>,
  source: SourceLabel,
  value: number | null | undefined,
) {
  if (value != null && Number.isFinite(value)) out.push({ source, value });
}

export function compositeScores(args: {
  trust: TrustAssessment;
  csrep: CsrepProfile | null;
  cs2: SteamCs2Stats | null;
  faceitPlayer: FaceitPlayer | null;
  faceitStats: FaceitStats | null;
  leetify: LeetifyProfile | null;
  leetifyWindows: LeetifyWindows | null;
  csstat: CsstatProfile | null;
}): CompositeScores {
  const w30 = args.leetifyWindows?.last30;
  const csrepM = args.csrep?.stats?.metrics ?? args.csrep?.metrics;
  const csstatL = args.csstat?.leetify;

  const trustValues: Array<{ source: SourceLabel; value: number }> = [];
  if (args.trust.score != null) {
    trustValues.push({ source: "cscanner", value: args.trust.score });
  }
  if (args.csrep?.trustRating != null) {
    trustValues.push({ source: "csrep", value: args.csrep.trustRating });
  }

  const kdValues: Array<{ source: SourceLabel; value: number }> = [];
  pushIf(kdValues, "steam", args.cs2?.kd);
  pushIf(kdValues, "faceit", args.faceitStats?.kd);
  pushIf(kdValues, "leetify", w30?.kd);
  pushIf(kdValues, "csstat", csstatL?.kd?.value);
  pushIf(kdValues, "csrep", csrepM?.kd.value);

  const hsValues: Array<{ source: SourceLabel; value: number }> = [];
  pushIf(hsValues, "steam", args.cs2?.hsPercent);
  pushIf(hsValues, "faceit", args.faceitStats?.hsPercent);
  pushIf(hsValues, "leetify", w30?.hsPercent ?? args.leetify?.hsPercent);
  pushIf(hsValues, "csrep", csrepM?.headAccuracy.value);

  const winValues: Array<{ source: SourceLabel; value: number }> = [];
  pushIf(winValues, "faceit", args.faceitStats?.winRate);
  pushIf(winValues, "leetify", w30?.winRate ?? args.leetify?.winrate);
  pushIf(winValues, "csstat", csstatL?.winRate?.value);

  const aimValues: Array<{ source: SourceLabel; value: number }> = [];
  pushIf(aimValues, "leetify", args.leetify?.aim);
  pushIf(aimValues, "csstat", csstatL?.aim?.value);

  const eloValues: Array<{ source: SourceLabel; value: number }> = [];
  pushIf(eloValues, "faceit", args.faceitPlayer?.elo);
  pushIf(eloValues, "csrep", args.csrep?.faceitElo);
  pushIf(eloValues, "leetify", args.leetify?.faceitElo);

  const ttdValues: Array<{ source: SourceLabel; value: number }> = [];
  pushIf(ttdValues, "leetify", w30?.timeToDamageMs ?? args.leetify?.timeToDamageMs);
  pushIf(ttdValues, "csstat", csstatL?.timeToDamageMs?.value);
  pushIf(ttdValues, "csrep", csrepM?.timeToDamageMs.value);

  const preaimValues: Array<{ source: SourceLabel; value: number }> = [];
  pushIf(preaimValues, "leetify", w30?.preaim ?? args.leetify?.preaim);
  pushIf(preaimValues, "csstat", csstatL?.preaim?.value);
  pushIf(preaimValues, "csrep", csrepM?.preaimDeg.value);

  return {
    trust: avg(trustValues),
    kd: avg(kdValues),
    hsPercent: avg(hsValues),
    winRate: avg(winValues),
    aim: avg(aimValues),
    faceitElo: avg(eloValues),
    timeToDamageMs: avg(ttdValues),
    preaim: avg(preaimValues),
  };
}

/** Primary overview trust: composite when ≥2 sources, else cscanner trust. */
export function compositeTrustScore(
  composite: CompositeScores,
  trust: TrustAssessment,
): number | null {
  if (composite.trust?.value != null) return composite.trust.value;
  return trust.score;
}
