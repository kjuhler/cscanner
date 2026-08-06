import {
  formatDecimal,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import type {
  CompositeMetric,
  CsapiStats,
  CsrepProfile,
  CsstatProfile,
  FaceitPlayer,
  FaceitStats,
  LeetifyProfile,
  LeetifyWindows,
  PlayerAggregate,
  SteamCs2Stats,
  SteamExtras,
  SteamProfile,
  TrustAssessment,
} from "@/lib/types";

type Props = {
  data: Pick<
    PlayerAggregate,
    | "steamId"
    | "steam"
    | "steamExtras"
    | "cs2"
    | "faceit"
    | "leetify"
    | "leetifyWindows"
    | "scope"
    | "csstat"
    | "csapi"
    | "csrep"
    | "composite"
    | "trust"
  >;
  csrepConfigured: boolean;
};

function CompositeRow({
  label,
  metric,
  format,
}: {
  label: string;
  metric: CompositeMetric | null;
  format: "pct" | "num" | "ms" | "elo";
}) {
  if (!metric) return null;
  let value = String(metric.value);
  if (format === "pct") value = `${formatDecimal(metric.value, 1)}%`;
  else if (format === "ms") value = `${Math.round(metric.value)} ms`;
  else if (format === "elo") value = formatNumber(metric.value) ?? "—";

  return (
    <tr className="border-t border-[var(--border)]">
      <td className="px-4 py-2 text-sm text-[var(--foreground)]">{label}</td>
      <td className="px-4 py-2 font-mono text-sm tabular-nums text-[var(--foreground)]">
        {value}
      </td>
      <td className="px-4 py-2 text-xs text-[var(--muted)]">
        {metric.sources.join(" + ")}
      </td>
    </tr>
  );
}

function SourceSection({
  title,
  status,
  href,
  rows,
}: {
  title: string;
  status: "live" | "empty" | "needs_key";
  href?: string | null;
  rows: Array<{ label: string; value: string }>;
}) {
  const statusLabel =
    status === "live" ? "Live" : status === "needs_key" ? "Needs key" : "No data";

  return (
    <section className="border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-baseline gap-2">
          <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-wide text-[var(--foreground)]">
            {title}
          </h3>
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            {statusLabel}
          </span>
        </div>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--amber)] hover:underline"
          >
            Open →
          </a>
        ) : null}
      </div>
      {rows.length > 0 ? (
        <dl className="grid gap-2 px-4 py-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => (
            <div key={row.label}>
              <dt className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
                {row.label}
              </dt>
              <dd className="mt-0.5 font-mono text-sm tabular-nums text-[var(--foreground)]">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="px-4 py-3 text-sm text-[var(--muted)]">No fields loaded.</p>
      )}
    </section>
  );
}

function steamRows(
  steam: SteamProfile | null,
  extras: SteamExtras,
  cs2: SteamCs2Stats | null,
): Array<{ label: string; value: string }> {
  if (!steam) return [];
  return [
    { label: "Account age", value: `${formatNumber(steam.accountAgeDays) ?? "—"} days` },
    { label: "CS2 hours", value: formatNumber(extras.cs2PlaytimeHours) ?? "—" },
    { label: "Steam level", value: formatNumber(extras.steamLevel) ?? "—" },
    { label: "K/D", value: formatDecimal(cs2?.kd) },
    { label: "HS%", value: formatPercent(cs2?.hsPercent) },
    { label: "Win rate", value: formatPercent(cs2?.winRate) },
  ];
}

function faceitRows(
  player: FaceitPlayer | null,
  stats: FaceitStats | null,
): Array<{ label: string; value: string }> {
  if (!player && !stats) return [];
  return [
    { label: "ELO", value: formatNumber(player?.elo) ?? "—" },
    { label: "Level", value: formatNumber(player?.skillLevel) ?? "—" },
    { label: "Matches", value: formatNumber(stats?.matches) ?? "—" },
    { label: "K/D", value: formatDecimal(stats?.kd) },
    { label: "HS%", value: formatPercent(stats?.hsPercent) },
    { label: "Win rate", value: formatPercent(stats?.winRate) },
  ];
}

function leetifyRows(
  leetify: LeetifyProfile | null,
  windows: LeetifyWindows | null,
): Array<{ label: string; value: string }> {
  if (!leetify) return [];
  const w = windows?.last30;
  return [
    { label: "Premier", value: formatNumber(leetify.premier ?? leetify.premierRecent) ?? "—" },
    { label: "Aim", value: formatDecimal(leetify.aim) },
    { label: "TTD (30)", value: w?.timeToDamageMs != null ? `${Math.round(w.timeToDamageMs)} ms` : "—" },
    { label: "Preaim (30)", value: formatDecimal(w?.preaim) },
    { label: "K/D (30)", value: formatDecimal(w?.kd) },
    { label: "Win rate (30)", value: formatPercent(w?.winRate) },
  ];
}

function csstatRows(csstat: CsstatProfile | null): Array<{ label: string; value: string }> {
  if (!csstat) return [];
  const L = csstat.leetify;
  return [
    { label: "Aim", value: formatDecimal(L?.aim?.value) },
    { label: "TTD", value: L?.timeToDamageMs?.value != null ? `${Math.round(L.timeToDamageMs.value)} ms` : "—" },
    { label: "Preaim", value: formatDecimal(L?.preaim?.value) },
    { label: "FACEIT ELO", value: formatNumber(csstat.faceit?.elo) ?? "—" },
    { label: "Filled gaps", value: String(csstat.filledFields.length) },
  ];
}

function csapiRows(csapi: CsapiStats | null): Array<{ label: string; value: string }> {
  if (!csapi) return [];
  const pct = (n: number | null) =>
    n == null ? "—" : formatPercent(n <= 1 ? n * 100 : n);
  return [
    {
      label: "TTD",
      value:
        csapi.timeToDamageMs != null
          ? `${Math.round(csapi.timeToDamageMs)} ms`
          : "—",
    },
    {
      label: "Reaction",
      value:
        csapi.reactionTimeMs != null
          ? `${Math.round(csapi.reactionTimeMs)} ms`
          : "—",
    },
    { label: "Preaim", value: formatDecimal(csapi.preaim) },
    { label: "Crosshair", value: formatDecimal(csapi.crosshairPlacement) },
    { label: "K/D", value: formatDecimal(csapi.kd) },
    { label: "ADR", value: formatDecimal(csapi.adr, 1) },
    { label: "Accuracy", value: pct(csapi.accuracy) },
    { label: "Head Acc", value: pct(csapi.accuracyHead) },
    { label: "HLTV 2.0", value: formatDecimal(csapi.hltvRating2) },
    { label: "KAST", value: pct(csapi.kast) },
  ];
}

function csrepRows(csrep: CsrepProfile | null): Array<{ label: string; value: string }> {
  if (!csrep) return [];
  const m = csrep.stats?.metrics ?? csrep.metrics;
  return [
    { label: "Trust", value: csrep.trustRating != null ? `${Math.round(csrep.trustRating)}%` : "—" },
    { label: "Premier", value: formatNumber(csrep.premierElo) ?? "—" },
    { label: "CS2 hours", value: formatNumber(csrep.cs2Hours) ?? "—" },
    { label: "TTD", value: m.timeToDamageMs.value != null ? `${Math.round(m.timeToDamageMs.value)} ms` : "—" },
    { label: "K/D", value: formatDecimal(m.kd.value) },
    { label: "Stats window", value: csrep.stats?.matchCount != null ? String(csrep.stats.matchCount) : "—" },
  ];
}

export function SourcesBreakdownPanel({ data, csrepConfigured }: Props) {
  const composite = data.composite;
  const trust: TrustAssessment = data.trust;

  return (
    <div className="space-y-4">
      <section className="border border-[var(--border)] bg-[var(--surface)]">
        <div className="border-b border-[var(--border)] px-4 py-3">
          <h2 className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            Composite (≥2 sources)
          </h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Averages overlapping metrics across live APIs. Trust uses cscanner +
            CSRep when both are available.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
                <th className="px-4 py-2 font-semibold">Metric</th>
                <th className="px-4 py-2 font-semibold">Value</th>
                <th className="px-4 py-2 font-semibold">Sources</th>
              </tr>
            </thead>
            <tbody>
              <CompositeRow label="Trust" metric={composite.trust} format="pct" />
              <CompositeRow label="K/D" metric={composite.kd} format="num" />
              <CompositeRow label="HS%" metric={composite.hsPercent} format="pct" />
              <CompositeRow label="Win rate" metric={composite.winRate} format="pct" />
              <CompositeRow label="Aim" metric={composite.aim} format="num" />
              <CompositeRow label="FACEIT ELO" metric={composite.faceitElo} format="elo" />
              <CompositeRow label="TTD" metric={composite.timeToDamageMs} format="ms" />
              <CompositeRow label="Preaim" metric={composite.preaim} format="num" />
            </tbody>
          </table>
        </div>
        <p className="border-t border-[var(--border)] px-4 py-3 text-xs text-[var(--muted)]">
          cscanner trust alone:{" "}
          {trust.score != null ? `${trust.score}% (${trust.level})` : "—"}
        </p>
      </section>

      <SourceSection
        title="Steam"
        status={data.cs2 && !data.cs2.privateOrUnavailable ? "live" : "empty"}
        href={`https://steamcommunity.com/profiles/${data.steamId}`}
        rows={steamRows(data.steam, data.steamExtras, data.cs2)}
      />

      <SourceSection
        title="FACEIT"
        status={data.faceit.player ? "live" : "empty"}
        href={data.faceit.player?.faceitUrl}
        rows={faceitRows(data.faceit.player, data.faceit.stats)}
      />

      <SourceSection
        title="csapi"
        status={data.csapi ? "live" : "empty"}
        href={data.csapi?.profileUrl}
        rows={csapiRows(data.csapi)}
      />

      <SourceSection
        title="Leetify"
        status={data.leetify ? "live" : "empty"}
        href={data.leetify?.profileUrl}
        rows={leetifyRows(data.leetify, data.leetifyWindows)}
      />

      <SourceSection
        title="Scope.gg"
        status={data.scope ? "live" : "empty"}
        href={data.scope?.profileUrl}
        rows={
          data.scope
            ? [{ label: "Filled fields", value: data.scope.filledFields.join(", ") || "—" }]
            : []
        }
      />

      <SourceSection
        title="csst.at"
        status={data.csstat ? "live" : "empty"}
        href={data.csstat?.profileUrl}
        rows={csstatRows(data.csstat)}
      />

      <SourceSection
        title="CSRep"
        status={
          !csrepConfigured
            ? "needs_key"
            : data.csrep
              ? "live"
              : "empty"
        }
        href={data.csrep?.profileUrl}
        rows={csrepRows(data.csrep)}
      />
    </div>
  );
}
