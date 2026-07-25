import { formatDecimal, formatPercent } from "@/lib/format";
import { mapDisplayName } from "@/lib/maps";
import type { LeetifyMapStats } from "@/lib/types";
import { MapIcon } from "@/components/MapIcon";

type Props = {
  maps: LeetifyMapStats[];
};

function RatingBar({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  const v = value ?? 0;
  const pct = Math.min(100, Math.abs(v) * 12);
  const positive = v >= 0;

  return (
    <div className="grid grid-cols-[4.5rem_1fr_2.75rem] items-center gap-2">
      <span className="truncate text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">
        {label}
      </span>
      <div className="relative h-1.5 overflow-hidden bg-[var(--border)]">
        <div
          className="absolute inset-y-0 left-1/2 w-px bg-[var(--muted)]/40"
          aria-hidden
        />
        <div
          className={`absolute inset-y-0 ${
            positive
              ? "left-1/2 bg-[var(--ok)]"
              : "right-1/2 bg-[var(--danger)]"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={`text-right font-mono text-[11px] tabular-nums ${
          value == null
            ? "text-[var(--muted)]"
            : positive
              ? "text-[var(--ok)]"
              : "text-[var(--danger)]"
        }`}
      >
        {value == null
          ? "—"
          : `${positive ? "+" : ""}${formatDecimal(value)}`}
      </span>
    </div>
  );
}

function WinRing({ winRate }: { winRate: number | null }) {
  const dim = 56;
  const stroke = 4;
  const radius = (dim - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const fill = winRate == null ? 0 : Math.max(0, Math.min(100, winRate));
  const offset = circumference - (fill / 100) * circumference;
  const accent =
    winRate == null
      ? "var(--muted)"
      : winRate >= 50
        ? "var(--ok)"
        : "var(--danger)";

  return (
    <div className="relative shrink-0" style={{ width: dim, height: dim }}>
      <svg
        width={dim}
        height={dim}
        viewBox={`0 0 ${dim} ${dim}`}
        className="-rotate-90"
        aria-hidden
      >
        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
        />
        {winRate != null ? (
          <circle
            cx={dim / 2}
            cy={dim / 2}
            r={radius}
            fill="none"
            stroke={accent}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        ) : null}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-[family-name:var(--font-display)] text-sm font-semibold tabular-nums text-[var(--foreground)]">
          {winRate != null ? Math.round(winRate) : "—"}
        </span>
        <span className="text-[9px] uppercase tracking-wider text-[var(--muted)]">
          %
        </span>
      </div>
    </div>
  );
}

export function LeetifyMapsPanel({ maps }: Props) {
  if (maps.length === 0) return null;

  return (
    <section className="border border-[var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border)] px-5 py-3">
        <h2 className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
          Maps
        </h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Last 100 matches · Leetify
        </p>
      </div>
      <div className="grid gap-px bg-[var(--border)] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {maps.map((m) => (
          <article
            key={m.map}
            className="bg-[var(--surface)] px-4 py-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <MapIcon map={m.map} size={36} />
                <div className="min-w-0">
                  <p className="truncate font-[family-name:var(--font-display)] text-sm font-semibold text-[var(--foreground)]">
                    {mapDisplayName(m.map)}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">
                    {m.matches} match{m.matches === 1 ? "" : "es"}
                  </p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">
                    Win rate {formatPercent(m.winRate)}
                  </p>
                </div>
              </div>
              <WinRing winRate={m.winRate} />
            </div>
            <div className="mt-4 space-y-2">
              <RatingBar label="Leetify" value={m.leetifyRating} />
              <RatingBar label="T" value={m.tRating} />
              <RatingBar label="CT" value={m.ctRating} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
