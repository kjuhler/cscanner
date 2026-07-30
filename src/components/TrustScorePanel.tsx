import type { PlayerBans, TrustAssessment, TrustLevel } from "@/lib/types";
import { TrustScoreTooltip } from "@/components/TrustScoreTooltip";

type Props = {
  trust: TrustAssessment;
  bans: PlayerBans;
  embedded?: boolean;
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
  { key: "statistical", label: "Statistical Signals" },
  { key: "accountFlags", label: "Account History" },
  { key: "anomalies", label: "Pattern Irregularities" },
];

export function TrustScorePanel({ trust, bans, embedded = false }: Props) {
  const score = trust.score;
  const color = trustColor(score);
  const pillars = trust.pillars;
  const bandLabel = levelLabel(trust.level).toUpperCase();

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
          : "border border-[#123e36] bg-[#111a1f] p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.25)]"
      }
      style={
        embedded
          ? {
              background:
                "radial-gradient(ellipse 120% 80% at 20% 0%, rgba(36,247,182,0.08), transparent 55%), linear-gradient(180deg, rgba(17,26,31,0.95) 0%, rgba(17,26,31,0.78) 100%)",
            }
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7fa8a0]">
          Trust Score
        </p>
        <TrustScoreTooltip trust={trust} compact />
      </div>

      <div className="mt-3 text-center">
        <p
          className="font-[family-name:var(--font-display)] text-6xl font-semibold leading-none tabular-nums"
          style={{ color: score == null ? "var(--muted)" : "#1dffb6" }}
        >
          {score == null ? "—" : score}
          <span className="ml-1 text-4xl align-top">%</span>
        </p>
        <p className="mt-3 inline-flex items-center justify-center rounded-sm bg-[#0f3c34] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#65ffcb]">
          {bandLabel}
        </p>
      </div>

      <div className="my-4 h-1 rounded-full bg-[#153830]">
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${clampPct(score ?? 0)}%`,
            background: "#24f7b6",
          }}
        />
      </div>

      <div className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7fa8a0]">
          Breakdown
        </p>

        {pillars
          ? PILLARS.map((p) => (
              <PillarBar
                key={p.key}
                label={p.label}
                value={pillars[p.key]}
                color="#24f7b6"
                muted={false}
              />
            ))
          : (
            <p className="text-sm text-[var(--muted)]">
              Not enough public data for pillar breakdown.
            </p>
          )}

        {trust.accountBonus > 0 ? (
          <div className="border-t border-[#20433c] pt-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-[#a8cbc4]">+ Trust Bonus</span>
              <span className="font-[family-name:var(--font-display)] font-semibold tabular-nums text-[#24f7b6]">
                +{trust.accountBonus}%
              </span>
            </div>
          </div>
        ) : null}

        <div className="border-t border-[#20433c] pt-2">
          <p className="text-[10px] uppercase tracking-[0.14em] text-[#7fa8a0]">
            Risk Indicators
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <FlagChip label="VAC bans" count={vac} />
            <FlagChip label="Game bans" count={game} />
            <FlagChip label="FACEIT flags" count={faceit} />
            <FlagChip label="Platform flags" count={platform} />
          </div>
          {!accountFlagsSignal ? (
            <p className="mt-2 text-xs text-[#7fa8a0]">No risk indicators detected.</p>
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
  muted,
}: {
  label: string;
  value: number;
  color: string;
  muted: boolean;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-sm text-[#d2ebe3]">
          {label}
        </span>
        <span className="font-[family-name:var(--font-display)] text-base font-semibold tabular-nums text-[#24f7b6]">
          {value}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#173a33]">
        <div
          className="h-full transition-[width]"
          style={{
            width: `${clampPct(value)}%`,
            background: muted ? "var(--muted)" : color,
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
          ? "rounded-sm border border-[#1d4a40] bg-[#102922] px-2 py-1 text-[#8fd6bd]"
          : "rounded-sm border border-[#5a2a2a] bg-[#2a1818] px-2 py-1 font-semibold text-[#ff8076]"
      }
    >
      {label}: {count}
    </span>
  );
}

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, n));
}
