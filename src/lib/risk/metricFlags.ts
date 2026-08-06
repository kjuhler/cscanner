/**
 * CSRep-style severity bands for combat metrics.
 * Higher output (KD, accuracy, wallbang…) → worse when extreme.
 * Lower TTD / preaim / reaction / crosshair → worse when extreme.
 */

import type {
  MetricFlag,
  MetricFlagId,
  MetricSeverity,
} from "@/lib/types";

export type { MetricFlag, MetricFlagId, MetricSeverity };

/** Thresholds: [elevated, suspicious, insane]. */
type Band = [number, number, number];

const HIGH: Record<
  Extract<
    MetricFlagId,
    | "kd"
    | "adr"
    | "aimAccuracy"
    | "headAccuracy"
    | "wallbang"
    | "smoke"
    | "hltv"
    | "kast"
    | "winRate"
  >,
  Band
> = {
  // Cookie sample: KD ~7, aim/head ~54%, wallbang ~90%, KAST ~94% → insane
  kd: [1.55, 2.1, 2.8],
  adr: [92, 105, 120],
  aimAccuracy: [28, 38, 48],
  headAccuracy: [32, 42, 50],
  wallbang: [6, 15, 30],
  smoke: [8, 15, 25],
  hltv: [1.35, 1.55, 1.85],
  kast: [78, 85, 90],
  winRate: [62, 72, 85],
};

const LOW: Record<
  Extract<MetricFlagId, "ttd" | "reaction" | "crosshair" | "preaim">,
  Band
> = {
  ttd: [380, 320, 280],
  reaction: [340, 290, 250],
  crosshair: [6.5, 5.0, 3.8],
  preaim: [7.5, 5.5, 4.0],
};

const LABELS: Record<MetricFlagId, string> = {
  kd: "K/D Ratio",
  adr: "ADR",
  aimAccuracy: "Aim Accuracy",
  headAccuracy: "Head Accuracy",
  wallbang: "Wallbang %",
  smoke: "Smoke Kill %",
  hltv: "HLTV Rating 2.0",
  kast: "KAST",
  winRate: "Win rate",
  ttd: "Time to Damage",
  reaction: "Reaction Time",
  crosshair: "Crosshair Placement",
  preaim: "Preaim",
};

const CONTRIBUTION: Record<MetricSeverity, number> = {
  normal: 0,
  elevated: 6,
  suspicious: 14,
  insane: 26,
};

function classifyHigh(value: number, [elev, sus, insane]: Band): MetricSeverity {
  if (value >= insane) return "insane";
  if (value >= sus) return "suspicious";
  if (value >= elev) return "elevated";
  return "normal";
}

function classifyLow(value: number, [elev, sus, insane]: Band): MetricSeverity {
  if (value <= insane) return "insane";
  if (value <= sus) return "suspicious";
  if (value <= elev) return "elevated";
  return "normal";
}

function makeFlag(
  id: MetricFlagId,
  value: number,
  severity: MetricSeverity,
  detail: string,
): MetricFlag {
  return {
    id,
    label: LABELS[id],
    value,
    severity,
    contribution: CONTRIBUTION[severity],
    detail,
  };
}

export type CombatMetricInput = {
  kd?: number | null;
  adr?: number | null;
  /** 0–100 */
  aimAccuracy?: number | null;
  /** 0–100 */
  headAccuracy?: number | null;
  /** 0–100 */
  wallbang?: number | null;
  /** 0–100 */
  smoke?: number | null;
  hltv?: number | null;
  /** 0–100 */
  kast?: number | null;
  /** 0–100 */
  winRate?: number | null;
  ttdMs?: number | null;
  reactionMs?: number | null;
  crosshairDeg?: number | null;
  preaimDeg?: number | null;
};

function pushHigh(
  out: MetricFlag[],
  id: keyof typeof HIGH,
  value: number | null | undefined,
  format: (n: number) => string,
) {
  if (value == null || !Number.isFinite(value)) return;
  const severity = classifyHigh(value, HIGH[id]);
  out.push(
    makeFlag(id, value, severity, `${LABELS[id]} ${format(value)} is ${severity}.`),
  );
}

function pushLow(
  out: MetricFlag[],
  id: keyof typeof LOW,
  value: number | null | undefined,
  format: (n: number) => string,
) {
  if (value == null || !Number.isFinite(value)) return;
  const severity = classifyLow(value, LOW[id]);
  out.push(
    makeFlag(id, value, severity, `${LABELS[id]} ${format(value)} is ${severity}.`),
  );
}

/** Classify combat metrics into normal / elevated / suspicious / insane. */
export function classifyCombatMetrics(input: CombatMetricInput): MetricFlag[] {
  const out: MetricFlag[] = [];

  pushHigh(out, "kd", input.kd, (n) => n.toFixed(2));
  pushHigh(out, "adr", input.adr, (n) => n.toFixed(1));
  pushHigh(out, "aimAccuracy", input.aimAccuracy, (n) => `${n.toFixed(1)}%`);
  pushHigh(out, "headAccuracy", input.headAccuracy, (n) => `${n.toFixed(1)}%`);
  pushHigh(out, "wallbang", input.wallbang, (n) => `${n.toFixed(1)}%`);
  pushHigh(out, "smoke", input.smoke, (n) => `${n.toFixed(1)}%`);
  pushHigh(out, "hltv", input.hltv, (n) => n.toFixed(2));
  pushHigh(out, "kast", input.kast, (n) => `${n.toFixed(1)}%`);
  pushHigh(out, "winRate", input.winRate, (n) => `${n.toFixed(1)}%`);
  pushLow(out, "ttd", input.ttdMs, (n) => `${Math.round(n)}ms`);
  pushLow(out, "reaction", input.reactionMs, (n) => `${Math.round(n)}ms`);
  pushLow(out, "crosshair", input.crosshairDeg, (n) => `${n.toFixed(2)}°`);
  pushLow(out, "preaim", input.preaimDeg, (n) => `${n.toFixed(2)}°`);

  return out;
}

export function severityById(
  flags: MetricFlag[],
): Partial<Record<MetricFlagId, MetricSeverity>> {
  const map: Partial<Record<MetricFlagId, MetricSeverity>> = {};
  for (const f of flags) map[f.id] = f.severity;
  return map;
}

export function countSeverity(
  flags: MetricFlag[],
  severity: MetricSeverity,
): number {
  return flags.filter((f) => f.severity === severity).length;
}

/** English UI labels for severity bands. */
export function severityLabel(severity: MetricSeverity): string {
  switch (severity) {
    case "elevated":
      return "High";
    case "suspicious":
      return "Sus";
    case "insane":
      return "Insane";
    default:
      return "Normal";
  }
}

/** normal=white, elevated=yellow, suspicious=light red, insane=dark red */
export function severityTextClass(severity: MetricSeverity | null | undefined): string {
  if (severity === "insane") return "text-[var(--metric-insane)]";
  if (severity === "suspicious") return "text-[var(--metric-suspicious)]";
  if (severity === "elevated") return "text-[var(--metric-elevated)]";
  return "text-[var(--metric-normal)]";
}

export function severityBorderClass(severity: MetricSeverity | null | undefined): string {
  if (severity === "insane") return "border-[var(--metric-insane)]/45";
  if (severity === "suspicious") return "border-[var(--metric-suspicious)]/40";
  if (severity === "elevated") return "border-[var(--metric-elevated)]/40";
  return "border-[var(--border)]";
}
