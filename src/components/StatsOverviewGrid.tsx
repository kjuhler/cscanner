"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  formatDecimal,
  formatHours,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import {
  aggregateMatchRows,
  filterMatchesByCount,
} from "@/lib/leetify/windowStats";
import { skillLikeTopPercent } from "@/lib/leetify/skillLike";
import {
  classifyCombatMetrics,
  severityById,
  severityLabel,
  severityTextClass,
  severityBorderClass,
  type MetricFlagId,
  type MetricSeverity,
} from "@/lib/risk/metricFlags";
import type {
  BannedFriendsStats,
  CsapiStats,
  FaceitPlayer,
  FaceitStats,
  LeetifyMatchPlayerRow,
  LeetifyProfile,
  LeetifyWindowStats,
  SteamCs2Stats,
} from "@/lib/types";

type Mode = "matches30" | "matches90" | "custom";

type Props = {
  csapi: CsapiStats | null;
  leetify: LeetifyProfile | null;
  leetifyMatchRows?: LeetifyMatchPlayerRow[] | null;
  faceitPlayer: FaceitPlayer | null;
  faceitStats: FaceitStats | null;
  cs2: SteamCs2Stats | null;
  playtimeHours?: number | null;
  bannedFriends?: BannedFriendsStats | null;
  embedded?: boolean;
};

type Metric = {
  label: string;
  flagId?: MetricFlagId;
  value: ReactNode;
  topPercent?: number | null;
  faceitValue?: ReactNode;
};

const FACEIT_LOGO_URL = "https://www.faceit.com/favicon.ico";

function dash(): string {
  return "—";
}

/** Convert 0–1 ratio to percent for display helpers that expect 0–100. */
function ratioToPct(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  return n <= 1 ? n * 100 : n;
}

function formatMs(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return dash();
  return `${Math.round(n)}ms`;
}

export function StatsOverviewGrid({
  csapi,
  leetify,
  leetifyMatchRows,
  faceitPlayer: _faceitPlayer,
  faceitStats,
  cs2,
  playtimeHours,
  bannedFriends,
  embedded = false,
}: Props) {
  const rows = leetifyMatchRows ?? [];
  const hasRows = rows.length > 0;

  const [mode, setMode] = useState<Mode>("matches30");
  const [matchCountInput, setMatchCountInput] = useState("36");
  const maxMatches = Math.max(1, rows.length);
  const customCount = Math.max(
    1,
    Math.min(maxMatches, Number.parseInt(matchCountInput, 10) || 36),
  );

  const windowStats: LeetifyWindowStats | null = useMemo(() => {
    if (!hasRows) return null;
    if (mode === "custom") {
      return aggregateMatchRows(filterMatchesByCount(rows, customCount));
    }
    if (mode === "matches90") {
      return aggregateMatchRows(filterMatchesByCount(rows, 90));
    }
    return aggregateMatchRows(filterMatchesByCount(rows, 30));
  }, [hasRows, mode, rows, customCount]);

  const ttd = csapi?.timeToDamageMs ?? windowStats?.timeToDamageMs ?? leetify?.timeToDamageMs ?? null;
  const reaction = csapi?.reactionTimeMs ?? windowStats?.reactionTimeMs ?? null;
  const crosshair =
    csapi?.crosshairPlacement ??
    windowStats?.crosshairPlacement ??
    leetify?.preaim ??
    null;
  const preaim = csapi?.preaim ?? windowStats?.preaim ?? leetify?.preaim ?? null;
  const kd = csapi?.kd ?? windowStats?.kd ?? cs2?.kd ?? faceitStats?.kd ?? null;
  const adr = csapi?.adr ?? windowStats?.adr ?? faceitStats?.averageAdr ?? null;
  const aimAccuracy =
    ratioToPct(csapi?.accuracy) ?? windowStats?.accuracy ?? null;
  const headAccuracy =
    ratioToPct(csapi?.accuracyHead) ??
    windowStats?.hsPercent ??
    leetify?.hsPercent ??
    faceitStats?.hsPercent ??
    cs2?.hsPercent ??
    null;
  const wallbang =
    ratioToPct(csapi?.wallbangKillPercent) ??
    windowStats?.wallbangKillPercent ??
    null;
  const smoke =
    ratioToPct(csapi?.smokeKillPercent) ??
    windowStats?.smokeKillPercent ??
    null;
  const hltv =
    csapi?.hltvRating2 ?? windowStats?.hltvRating ?? null;
  const kast = ratioToPct(csapi?.kast) ?? windowStats?.kast ?? null;
  const winRate =
    windowStats?.winRate ??
    leetify?.winrate ??
    faceitStats?.winRate ??
    cs2?.winRate ??
    null;

  const bannedFriendsValue =
    bannedFriends?.friendCount == null
      ? dash()
      : `${formatNumber(bannedFriends.steam?.banned ?? 0)} / ${formatNumber(bannedFriends.friendCount)}`;

  function faceitSub(value: string): ReactNode {
    return (
      <span className="inline-flex items-center gap-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={FACEIT_LOGO_URL}
          alt=""
          aria-hidden
          className="h-3.5 w-3.5 rounded-[2px] object-contain"
        />
        <span>{value}</span>
      </span>
    );
  }

  const metrics: Metric[] = [
    {
      label: "Time to Damage",
      flagId: "ttd",
      value: formatMs(ttd),
      topPercent: skillLikeTopPercent("ttd", ttd),
    },
    {
      label: "Reaction Time",
      flagId: "reaction",
      value: formatMs(reaction),
    },
    {
      label: "Crosshair Placement",
      flagId: "crosshair",
      value: crosshair != null ? `${formatDecimal(crosshair)}°` : dash(),
    },
    {
      label: "Preaim",
      flagId: "preaim",
      value: preaim != null ? `${formatDecimal(preaim)}°` : dash(),
      topPercent: skillLikeTopPercent("preaim", preaim),
    },
    {
      label: "K/D Ratio",
      flagId: "kd",
      value: formatDecimal(kd),
      topPercent: skillLikeTopPercent("kd", kd),
      faceitValue:
        faceitStats?.kd != null
          ? faceitSub(formatDecimal(faceitStats.kd))
          : undefined,
    },
    {
      label: "ADR",
      flagId: "adr",
      value: formatDecimal(adr, 1),
      faceitValue:
        faceitStats?.averageAdr != null
          ? faceitSub(formatDecimal(faceitStats.averageAdr, 1))
          : undefined,
    },
    {
      label: "Aim Accuracy",
      flagId: "aimAccuracy",
      value: formatPercent(aimAccuracy),
    },
    {
      label: "Head Accuracy",
      flagId: "headAccuracy",
      value: formatPercent(headAccuracy),
      topPercent: skillLikeTopPercent("hs", headAccuracy),
      faceitValue:
        faceitStats?.hsPercent != null
          ? faceitSub(formatPercent(faceitStats.hsPercent))
          : undefined,
    },
    {
      label: "Wallbang %",
      flagId: "wallbang",
      value: formatPercent(wallbang),
    },
    {
      label: "Smoke Kill %",
      flagId: "smoke",
      value: formatPercent(smoke),
    },
    {
      label: "HLTV Rating 2.0",
      flagId: "hltv",
      value: formatDecimal(hltv),
    },
    {
      label: "KAST",
      flagId: "kast",
      value: formatPercent(kast),
    },
    {
      label: "Win rate",
      flagId: "winRate",
      value: formatPercent(winRate),
      faceitValue:
        faceitStats?.winRate != null
          ? faceitSub(formatPercent(faceitStats.winRate))
          : undefined,
    },
    {
      label: "Playtime",
      value: formatHours(playtimeHours ?? null),
    },
    {
      label: "Banned friends",
      value: bannedFriendsValue,
    },
  ];

  const flags = classifyCombatMetrics({
    kd,
    adr,
    aimAccuracy,
    headAccuracy,
    wallbang,
    smoke,
    hltv,
    kast,
    winRate,
    ttdMs: ttd,
    reactionMs: reaction,
    crosshairDeg: crosshair,
    preaimDeg: preaim,
  });
  const byId = severityById(flags);

  const sourceLabel = csapi
    ? "csapi · FACEIT / Steam"
    : hasRows
      ? "Leetify / FACEIT / Steam"
      : "FACEIT / Steam";

  return (
    <section
      className={
        embedded
          ? "bg-transparent p-5"
          : "border border-[var(--border)] bg-[var(--surface)] p-5"
      }
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-[0.16em] text-[var(--foreground)]">
            Stats Overview
          </h2>
          <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
            {sourceLabel}
          </p>
        </div>

        {hasRows && !csapi ? (
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="flex border border-[var(--border)]"
              role="group"
              aria-label="Match window"
            >
              <WindowButton
                active={mode === "matches30"}
                onClick={() => setMode("matches30")}
              >
                Last 30
              </WindowButton>
              <WindowButton
                active={mode === "matches90"}
                onClick={() => setMode("matches90")}
              >
                Last 90
              </WindowButton>
              <WindowButton
                active={mode === "custom"}
                onClick={() => setMode("custom")}
              >
                Custom
              </WindowButton>
            </div>
            {mode === "custom" ? (
              <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">
                Last
                <input
                  type="number"
                  min={1}
                  max={maxMatches}
                  value={matchCountInput}
                  onChange={(e) => setMatchCountInput(e.target.value)}
                  className="w-14 border border-[var(--border)] bg-[var(--bg-elevated)] px-1.5 py-1 font-[family-name:var(--font-display)] text-sm font-semibold tabular-nums text-[var(--foreground)] outline-none focus:border-[var(--amber)]"
                />
                matches
              </label>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {metrics.map((m) => {
          const severity: MetricSeverity | undefined = m.flagId
            ? byId[m.flagId]
            : undefined;
          const flagged =
            severity === "elevated" ||
            severity === "suspicious" ||
            severity === "insane";
          return (
            <div
              key={m.label}
              className={`bg-[var(--bg-elevated)] px-3 py-3 border ${severityBorderClass(severity)}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">
                  {m.label}
                </p>
                {flagged && severity ? (
                  <span
                    className={`inline-flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${severityTextClass(severity)}`}
                    title={severityLabel(severity)}
                  >
                    <span aria-hidden>▲</span>
                    {severityLabel(severity)}
                  </span>
                ) : null}
              </div>
              <p
                className={`mt-1 font-[family-name:var(--font-display)] text-xl font-bold tabular-nums ${severityTextClass(severity)}`}
              >
                {m.value}
                {m.topPercent != null ? (
                  <span className="ml-1.5 align-middle font-sans text-[11px] font-medium normal-case tracking-normal text-[var(--muted)]">
                    (top {m.topPercent}%)
                  </span>
                ) : null}
              </p>
              {m.faceitValue ? (
                <p className="mt-1 text-[10px] tracking-[0.06em] text-[var(--muted)]">
                  {m.faceitValue}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function WindowButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={
        active
          ? "bg-[var(--amber)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--bg)]"
          : "px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-40"
      }
    >
      {children}
    </button>
  );
}
