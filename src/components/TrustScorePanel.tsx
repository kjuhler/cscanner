import type { PlayerBans, TrustAssessment, TrustLevel } from "@/lib/types";
import { TrustScoreTooltip } from "@/components/TrustScoreTooltip";

type Props = {
  trust: TrustAssessment;
  bans: PlayerBans;
};

function trustColor(score: number | null): string {
  if (score == null) return "var(--muted)";
  if (score >= 90) return "var(--ok)";
  if (score >= 75) return "var(--ok)";
  if (score >= 55) return "var(--amber)";
  if (score >= 35) return "var(--warn)";
  return "var(--danger)";
}

function levelLabel(level: TrustLevel): string {
  if (level === "unknown") return "Unknown";
  return level.charAt(0).toUpperCase() + level.slice(1);
}

const PILLARS: Array<{
  key: keyof NonNullable<TrustAssessment["pillars"]>;
  label: string;
}> = [
  { key: "statistical", label: "Statistical Trust" },
  { key: "accountFlags", label: "Account Flags" },
  { key: "anomalies", label: "Anomalies" },
];

export function TrustScorePanel({ trust, bans }: Props) {
  const score = trust.score;
  const color = trustColor(score);
  const pillars = trust.pillars;
  const ring = score == null ? 0 : Math.max(0, Math.min(100, score));

  const vac =
    bans.steam?.vacBanned || (bans.steam?.numberOfVacBans ?? 0) > 0
      ? bans.steam?.numberOfVacBans ?? 1
      : 0;
  const game = bans.steam?.numberOfGameBans ?? 0;
  const faceit = bans.faceit.length;
  const platform = bans.leetify.length;

  return (
    <section className="border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
        <div className="flex shrink-0 flex-col items-center gap-2">
          <div
            className="relative grid h-28 w-28 place-items-center rounded-full"
            style={{
              background: `conic-gradient(${color} ${ring * 3.6}deg, var(--border) 0)`,
            }}
            aria-hidden
          >
            <div className="grid h-[5.25rem] w-[5.25rem] place-items-center rounded-full bg-[var(--surface)]">
              <div className="text-center">
                <TrustScoreTooltip trust={trust} />
                <p
                  className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
                  style={{ color }}
                >
                  {levelLabel(trust.level)}
                </p>
              </div>
            </div>
          </div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
            Trust Score
          </p>
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          {pillars
            ? PILLARS.map((p) => (
                <PillarBar
                  key={p.key}
                  label={p.label}
                  value={pillars[p.key]}
                  color={trustColor(pillars[p.key])}
                />
              ))
            : (
              <p className="text-sm text-[var(--muted)]">
                Not enough public data for pillar breakdown.
              </p>
            )}

          {trust.accountBonus > 0 ? (
            <p className="text-xs text-[var(--ok)]">
              Account Bonus{" "}
              <span className="font-[family-name:var(--font-display)] font-semibold tabular-nums">
                +{trust.accountBonus}%
              </span>
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3 pt-1 text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">
            <FlagChip label="VAC" count={vac} />
            <FlagChip label="Game bans" count={game} />
            <FlagChip label="FACEIT" count={faceit} />
            <FlagChip label="Platform" count={platform} />
          </div>
        </div>
      </div>
    </section>
  );
}

function PillarBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
          {label}
        </span>
        <span className="font-[family-name:var(--font-display)] text-sm font-semibold tabular-nums text-[var(--foreground)]">
          {value}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden bg-[var(--border)]">
        <div
          className="h-full transition-[width]"
          style={{ width: `${clampPct(value)}%`, background: color }}
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
          ? "text-[var(--ok)]"
          : "font-semibold text-[var(--danger)]"
      }
    >
      {count} {label}
    </span>
  );
}

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, n));
}
