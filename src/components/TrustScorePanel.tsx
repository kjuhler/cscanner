import type { PlayerBans, TrustAssessment, TrustLevel } from "@/lib/types";
import { TrustScoreTooltip } from "@/components/TrustScoreTooltip";

type Props = {
  trust: TrustAssessment;
  bans: PlayerBans;
  embedded?: boolean;
  /** When set (e.g. composite trust), shown as the headline score. */
  displayScore?: number | null;
};

/** Trust palette: green (≥75) → yellow → light red → dark red. */
function trustColor(score: number | null): string {
  if (score == null) return "var(--muted)";
  if (score >= 75) return "var(--trust-good)";
  if (score >= 55) return "var(--trust-elevated)";
  if (score >= 35) return "var(--trust-suspicious)";
  return "var(--trust-insane)";
}

function trustBand(score: number | null): {
  color: string;
  bg: string;
  panelBg: string;
  track: string;
} {
  if (score == null) {
    return {
      color: "var(--muted)",
      bg: "rgba(139,150,163,0.12)",
      panelBg:
        "radial-gradient(ellipse 120% 80% at 20% 0%, rgba(139,150,163,0.08), transparent 55%), linear-gradient(180deg, rgba(17,26,31,0.95) 0%, rgba(17,26,31,0.78) 100%)",
      track: "rgba(139,150,163,0.25)",
    };
  }
  if (score >= 75) {
    return {
      color: "var(--trust-good)",
      bg: "rgba(61,186,122,0.16)",
      panelBg:
        "radial-gradient(ellipse 120% 80% at 20% 0%, rgba(61,186,122,0.18), transparent 55%), linear-gradient(180deg, rgba(14,36,28,0.95) 0%, rgba(17,26,31,0.85) 100%)",
      track: "rgba(61,186,122,0.28)",
    };
  }
  if (score >= 55) {
    return {
      color: "var(--trust-elevated)",
      bg: "rgba(240,210,74,0.16)",
      panelBg:
        "radial-gradient(ellipse 120% 80% at 20% 0%, rgba(240,210,74,0.16), transparent 55%), linear-gradient(180deg, rgba(40,34,14,0.95) 0%, rgba(17,26,31,0.85) 100%)",
      track: "rgba(240,210,74,0.28)",
    };
  }
  if (score >= 35) {
    return {
      color: "var(--trust-suspicious)",
      bg: "rgba(255,122,110,0.16)",
      panelBg:
        "radial-gradient(ellipse 120% 80% at 20% 0%, rgba(255,122,110,0.16), transparent 55%), linear-gradient(180deg, rgba(42,22,20,0.95) 0%, rgba(17,26,31,0.85) 100%)",
      track: "rgba(255,122,110,0.28)",
    };
  }
  return {
    color: "var(--trust-insane)",
    bg: "rgba(196,30,30,0.2)",
    panelBg:
      "radial-gradient(ellipse 120% 80% at 20% 0%, rgba(196,30,30,0.22), transparent 55%), linear-gradient(180deg, rgba(42,12,12,0.95) 0%, rgba(17,26,31,0.85) 100%)",
    track: "rgba(196,30,30,0.32)",
  };
}

function levelLabel(level: TrustLevel): string {
  if (level === "unknown") return "Unknown";
  return level.charAt(0).toUpperCase() + level.slice(1);
}

const PILLARS: Array<{
  key: keyof NonNullable<TrustAssessment["pillars"]>;
  label: string;
}> = [
  { key: "statistical", label: "Statistical Signals" },
  { key: "accountFlags", label: "Account History" },
  { key: "anomalies", label: "Pattern Irregularities" },
];

function levelFromScore(score: number | null): TrustLevel {
  if (score == null) return "unknown";
  if (score >= 90) return "excellent";
  if (score >= 75) return "good";
  if (score >= 55) return "fair";
  if (score >= 35) return "poor";
  return "critical";
}

export function TrustScorePanel({
  trust,
  bans,
  embedded = false,
  displayScore,
}: Props) {
  const score = displayScore ?? trust.score;
  const band = trustBand(score);
  const pillars = trust.pillars;
  const bandLabel = levelLabel(
    displayScore != null ? levelFromScore(displayScore) : trust.level,
  ).toUpperCase();

  const vac =
    bans.steam?.vacBanned || (bans.steam?.numberOfVacBans ?? 0) > 0
      ? bans.steam?.numberOfVacBans ?? 1
      : 0;
  const game = bans.steam?.numberOfGameBans ?? 0;
  const faceit = bans.faceit.length;
  const platform = bans.leetify.length;
  const accountFlagsSignal = vac > 0 || game > 0 || faceit > 0 || platform > 0;

  return (
    <section
      className={
        embedded
          ? "p-4"
          : "border border-[var(--border)] bg-[var(--surface)] p-4"
      }
      style={{ background: band.panelBg }}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
          Trust Score
        </p>
        <TrustScoreTooltip trust={trust} compact />
      </div>

      <div className="mt-3 text-center">
        <p
          className="font-[family-name:var(--font-display)] text-6xl font-semibold leading-none tabular-nums"
          style={{ color: band.color }}
        >
          {score == null ? "—" : score}
          <span className="ml-1 text-4xl align-top">%</span>
        </p>
        <p
          className="mt-3 inline-flex items-center justify-center rounded-sm px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]"
          style={{ background: band.bg, color: band.color }}
        >
          {bandLabel}
        </p>
      </div>

      <div
        className="my-4 h-1 rounded-full"
        style={{ background: band.track }}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${clampPct(score ?? 0)}%`,
            background: band.color,
          }}
        />
      </div>

      <div className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
          Breakdown
        </p>

        {pillars
          ? PILLARS.map((p) => (
              <PillarBar
                key={p.key}
                label={p.label}
                value={pillars[p.key]}
                color={trustColor(pillars[p.key])}
                track={trustBand(pillars[p.key]).track}
              />
            ))
          : (
            <p className="text-sm text-[var(--muted)]">
              Not enough public data for pillar breakdown.
            </p>
          )}

        {trust.accountBonus > 0 ? (
          <div className="border-t border-[var(--border)] pt-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-[var(--muted)]">+ Trust Bonus</span>
              <span
                className="font-[family-name:var(--font-display)] font-semibold tabular-nums"
                style={{ color: "var(--trust-good)" }}
              >
                +{trust.accountBonus}%
              </span>
            </div>
          </div>
        ) : null}

        <div className="border-t border-[var(--border)] pt-2">
          <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
            Risk Indicators
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <FlagChip label="VAC bans" count={vac} />
            <FlagChip label="Game bans" count={game} />
            <FlagChip label="FACEIT flags" count={faceit} />
            <FlagChip label="Platform flags" count={platform} />
          </div>
          {!accountFlagsSignal ? (
            <p className="mt-2 text-xs text-[var(--muted)]">
              No risk indicators detected.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function PillarBar({
  label,
  value,
  color,
  track,
}: {
  label: string;
  value: number;
  color: string;
  track: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-sm text-[var(--foreground)]">{label}</span>
        <span
          className="font-[family-name:var(--font-display)] text-base font-semibold tabular-nums"
          style={{ color }}
        >
          {value}
        </span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full"
        style={{ background: track }}
      >
        <div
          className="h-full transition-[width]"
          style={{
            width: `${clampPct(value)}%`,
            background: color,
          }}
        />
      </div>
    </div>
  );
}

function FlagChip({ label, count }: { label: string; count: number }) {
  const clean = count === 0;
  return (
    <span
      className={
        clean
          ? "rounded-sm border border-[var(--trust-good)]/30 bg-[var(--trust-good)]/10 px-2 py-1 text-[var(--trust-good)]"
          : "rounded-sm border border-[var(--trust-insane)]/40 bg-[var(--trust-insane)]/10 px-2 py-1 font-semibold text-[var(--trust-suspicious)]"
      }
    >
      {label}: {count}
    </span>
  );
}

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, n));
}
