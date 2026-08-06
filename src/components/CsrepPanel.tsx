import {
  formatDecimal,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import type { CsrepMetric, CsrepProfile } from "@/lib/types";

type Props = {
  csrep: CsrepProfile | null;
  configured: boolean;
};

function MetricCell({
  label,
  metric,
  kind,
}: {
  label: string;
  metric: CsrepMetric;
  kind: "num" | "pct" | "ms" | "deg";
}) {
  let value = "—";
  if (metric.value != null) {
    if (kind === "pct") value = formatPercent(metric.value);
    else if (kind === "ms") value = `${Math.round(metric.value)} ms`;
    else if (kind === "deg") value = `${formatDecimal(metric.value, 1)}°`;
    else value = formatDecimal(metric.value, 2);
  }

  return (
    <div className="bg-[var(--surface)] px-4 py-4">
      <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--foreground)]">
        {value}
      </p>
      {metric.delta != null || metric.verdict ? (
        <p className="mt-0.5 text-[11px] text-[var(--muted)]">
          {metric.delta != null ? (
            <span
              className={
                metric.delta > 0
                  ? "text-[var(--danger)]"
                  : metric.delta < 0
                    ? "text-[var(--ok)]"
                    : undefined
              }
            >
              {metric.delta > 0 ? "+" : ""}
              {formatDecimal(metric.delta, 2)}
            </span>
          ) : null}
          {metric.delta != null && metric.verdict ? " · " : null}
          {metric.verdict}
        </p>
      ) : null}
    </div>
  );
}

export function CsrepPanel({ csrep, configured }: Props) {
  if (!configured) {
    return (
      <section className="border border-[var(--border)] bg-[var(--surface)]">
        <div className="border-b border-[var(--border)] px-5 py-3">
          <h2 className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            CSRep
          </h2>
        </div>
        <p className="px-5 py-6 text-sm text-[var(--muted)]">
          Add{" "}
          <span className="font-mono text-[var(--foreground)]">CSREP_API_KEY</span>{" "}
          (and optional <span className="font-mono">CSREP_API_KEY_ID</span>) to load
          trust and stats from CSRep.
        </p>
      </section>
    );
  }

  if (!csrep) {
    return (
      <section className="border border-[var(--border)] bg-[var(--surface)]">
        <div className="border-b border-[var(--border)] px-5 py-3">
          <h2 className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            CSRep
          </h2>
        </div>
        <p className="px-5 py-6 text-sm text-[var(--muted)]">
          No CSRep profile returned for this Steam ID.
        </p>
      </section>
    );
  }

  const m = csrep.stats?.metrics ?? csrep.metrics;
  const windowLabel =
    csrep.stats?.sampleLabel ??
    (csrep.stats?.matchCount != null
      ? `Last ${formatNumber(csrep.stats.matchCount)} matches`
      : "Stats window");

  return (
    <section className="border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            CSRep
          </h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {windowLabel}
            {csrep.name ? ` · ${csrep.name}` : ""}
          </p>
        </div>
        <a
          href={csrep.profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--amber)] hover:underline"
        >
          Open on CSRep →
        </a>
      </div>

      <div className="grid gap-3 px-5 py-4 sm:grid-cols-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            Trust
          </p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-3xl font-bold tabular-nums text-[var(--foreground)]">
            {csrep.trustRating != null ? `${Math.round(csrep.trustRating)}%` : "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            Anomalies
          </p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-3xl font-bold tabular-nums text-[var(--foreground)]">
            {csrep.anomalies != null ? formatPercent(csrep.anomalies) : "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            SBA
          </p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-3xl font-bold tabular-nums text-[var(--foreground)]">
            {csrep.sba != null
              ? formatPercent(csrep.sba)
              : csrep.sbaDelta != null
                ? `${csrep.sbaDelta > 0 ? "+" : ""}${formatDecimal(csrep.sbaDelta, 1)}`
                : "—"}
          </p>
        </div>
      </div>

      <div className="grid gap-px border-t border-[var(--border)] bg-[var(--border)] sm:grid-cols-2 lg:grid-cols-3">
        <MetricCell label="Time to damage" metric={m.timeToDamageMs} kind="ms" />
        <MetricCell label="Reaction time" metric={m.reactionMs} kind="ms" />
        <MetricCell label="Preaim" metric={m.preaimDeg} kind="deg" />
        <MetricCell label="Crosshair" metric={m.crosshairDeg} kind="deg" />
        <MetricCell label="K/D" metric={m.kd} kind="num" />
        <MetricCell label="ADR" metric={m.adr} kind="num" />
        <MetricCell label="Aim accuracy" metric={m.aimAccuracy} kind="pct" />
        <MetricCell label="Head accuracy" metric={m.headAccuracy} kind="pct" />
        <MetricCell label="HLTV 2.0" metric={m.hltvRating} kind="num" />
        <MetricCell label="KAST" metric={m.kast} kind="pct" />
        <MetricCell label="Wallbang %" metric={m.wallbangPct} kind="pct" />
        <MetricCell label="Smoke kill %" metric={m.smokeKillPct} kind="pct" />
      </div>
    </section>
  );
}
