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
import type {
  BannedFriendsStats,
  FaceitPlayer,
  FaceitStats,
  LeetifyMatchPlayerRow,
  LeetifyProfile,
  LeetifyWindowStats,
  SteamCs2Stats,
} from "@/lib/types";

type Mode = "matches30" | "matches90" | "custom";

type Props = {
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
  value: ReactNode;
  topPercent?: number | null;
  faceitValue?: ReactNode;
};

const FACEIT_LOGO_URL = "https://www.faceit.com/favicon.ico";

function dash(): string {
  return "—";
}

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, n));
}

function avgFromRows(
  rows: LeetifyMatchPlayerRow[],
  pick: (r: LeetifyMatchPlayerRow) => number | null,
): number | null {
  let sum = 0;
  let n = 0;
  for (const row of rows) {
    const v = pick(row);
    if (v == null || Number.isNaN(v)) continue;
    sum += v;
    n += 1;
  }
  return n > 0 ? sum / n : null;
}

type ProxySet = {
  aim: number | null;
  positioning: number | null;
  utility: number | null;
};

function computeProxySet(rows: LeetifyMatchPlayerRow[]): ProxySet {
  if (rows.length === 0) return { aim: null, positioning: null, utility: null };

  const acc = avgFromRows(rows, (r) =>
    r.accuracyRaw != null ? r.accuracyRaw * 100 : null,
  );
  const hs = avgFromRows(rows, (r) =>
    r.shotsHit > 0 ? (r.hsKills / r.shotsHit) * 100 : null,
  );
  const spray = avgFromRows(rows, (r) =>
    r.sprayAccuracyRaw != null ? r.sprayAccuracyRaw * 100 : null,
  );
  const counter = avgFromRows(rows, (r) =>
    r.counterStrafeRatioRaw != null ? r.counterStrafeRatioRaw * 100 : null,
  );
  const aimParts = [acc, hs, spray, counter].filter(
    (v): v is number => v != null && Number.isFinite(v),
  );
  const aim =
    aimParts.length > 0
      ? clampPct(aimParts.reduce((s, v) => s + v, 0) / aimParts.length)
      : null;

  const preaim = avgFromRows(rows, (r) => r.preaim);
  const ttd = avgFromRows(rows, (r) => r.timeToDamageMs);
  const spotted = avgFromRows(rows, (r) =>
    r.accuracyEnemySpottedRaw != null ? r.accuracyEnemySpottedRaw * 100 : null,
  );
  const preaimScore = preaim != null ? clampPct(((20 - preaim) / 15) * 100) : null;
  const ttdScore = ttd != null ? clampPct(((800 - ttd) / 400) * 100) : null;
  const posParts = [preaimScore, ttdScore, spotted].filter(
    (v): v is number => v != null && Number.isFinite(v),
  );
  const positioning =
    posParts.length > 0
      ? clampPct(posParts.reduce((s, v) => s + v, 0) / posParts.length)
      : null;

  const he = avgFromRows(rows, (r) => r.heDamagePerNade);
  const flash = avgFromRows(rows, (r) => r.flashLeadingToKill);
  const trade = avgFromRows(rows, (r) =>
    r.tradeKillSuccessRaw != null ? r.tradeKillSuccessRaw * 100 : null,
  );
  const utilDeath = avgFromRows(rows, (r) => r.utilityOnDeathAvg);
  const heScore = he != null ? clampPct((he / 24) * 100) : null;
  const flashScore = flash != null ? clampPct((flash / 10) * 100) : null;
  const utilDeathScore =
    utilDeath != null ? clampPct(((450 - utilDeath) / 400) * 100) : null;
  const utilParts = [heScore, flashScore, trade, utilDeathScore].filter(
    (v): v is number => v != null && Number.isFinite(v),
  );
  const utility =
    utilParts.length > 0
      ? clampPct(utilParts.reduce((s, v) => s + v, 0) / utilParts.length)
      : null;

  return { aim, positioning, utility };
}

function normalizeProxyToModel(
  modelValue: number | null,
  faceitProxy: number | null,
  overallProxy: number | null,
): number | null {
  if (
    modelValue == null ||
    faceitProxy == null ||
    overallProxy == null ||
    overallProxy <= 0
  ) {
    return null;
  }
  const scaled = modelValue * (faceitProxy / overallProxy);
  return clampPct(scaled);
}

export function StatsOverviewGrid({
  leetify,
  leetifyMatchRows,
  faceitPlayer,
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
  const faceitRows = useMemo(
    () => rows.filter((r) => (r.source ?? "").toLowerCase() === "faceit"),
    [rows],
  );
  const hasFaceitRows = faceitRows.length > 0;
  const faceitWindowRows = useMemo(() => {
    if (faceitRows.length === 0) return [];
    if (mode === "custom") return filterMatchesByCount(faceitRows, customCount);
    if (mode === "matches90") return filterMatchesByCount(faceitRows, 90);
    return filterMatchesByCount(faceitRows, 30);
  }, [mode, faceitRows, customCount]);
  const faceitWindowStats: LeetifyWindowStats | null = useMemo(() => {
    if (faceitWindowRows.length === 0) return null;
    return aggregateMatchRows(faceitWindowRows);
  }, [faceitWindowRows]);

  const ttd =
    windowStats?.timeToDamageMs ?? leetify?.timeToDamageMs ?? null;
  const crosshair =
    windowStats?.crosshairPlacement ?? leetify?.preaim ?? null;
  const preaim = windowStats?.preaim ?? leetify?.preaim ?? null;
  const kd = windowStats?.kd ?? cs2?.kd ?? faceitStats?.kd ?? null;
  const adr = windowStats?.adr ?? faceitStats?.averageAdr ?? null;
  const aim = leetify?.aim ?? null;
  const positioning = leetify?.positioning ?? null;
  const utility = leetify?.utility ?? null;
  const sprayAccuracy = windowStats?.sprayAccuracy ?? leetify?.sprayAccuracy ?? null;
  const winRate =
    windowStats?.winRate ??
    leetify?.winrate ??
    faceitStats?.winRate ??
    cs2?.winRate ??
    null;
  const aimAccuracy = windowStats?.accuracy ?? null;
  const headAccuracy =
    windowStats?.hsPercent ??
    leetify?.hsPercent ??
    faceitStats?.hsPercent ??
    cs2?.hsPercent ??
    null;
  const bannedFriendsValue =
    bannedFriends?.friendCount == null
      ? dash()
      : `${formatNumber(bannedFriends.steam?.banned ?? 0)} / ${formatNumber(bannedFriends.friendCount)}`;
  const overallProxy = useMemo(() => computeProxySet(rows), [rows]);
  const faceitProxy = useMemo(
    () => computeProxySet(faceitWindowRows),
    [faceitWindowRows],
  );
  const faceitAimComparable = normalizeProxyToModel(
    aim,
    faceitProxy.aim,
    overallProxy.aim,
  );
  const faceitPositioningComparable = normalizeProxyToModel(
    positioning,
    faceitProxy.positioning,
    overallProxy.positioning,
  );
  const faceitUtilityComparable = normalizeProxyToModel(
    utility,
    faceitProxy.utility,
    overallProxy.utility,
  );

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
      value: ttd != null ? `${ttd}ms` : dash(),
      topPercent: skillLikeTopPercent("ttd", ttd),
      faceitValue:
        faceitWindowStats?.timeToDamageMs != null
          ? faceitSub(`${faceitWindowStats.timeToDamageMs}ms`)
          : undefined,
    },
    {
      label: "Preaim",
      value: preaim != null ? `${formatDecimal(preaim)}°` : dash(),
      topPercent: skillLikeTopPercent("preaim", preaim),
      faceitValue:
        faceitWindowStats?.preaim != null
          ? faceitSub(`${formatDecimal(faceitWindowStats.preaim)}°`)
          : undefined,
    },
    {
      label: "K/D Ratio",
      value: formatDecimal(kd),
      topPercent: skillLikeTopPercent("kd", kd),
      faceitValue:
        faceitWindowStats?.kd != null
          ? faceitSub(formatDecimal(faceitWindowStats.kd))
          : faceitStats?.kd != null
            ? faceitSub(formatDecimal(faceitStats.kd))
            : undefined,
    },
    {
      label: "ADR",
      value: formatDecimal(adr, 1),
      faceitValue:
        faceitWindowStats?.adr != null
          ? faceitSub(formatDecimal(faceitWindowStats.adr, 1))
          : faceitStats?.averageAdr != null
            ? faceitSub(formatDecimal(faceitStats.averageAdr, 1))
            : undefined,
    },
    {
      label: "Aim",
      value: formatDecimal(aim),
      topPercent: skillLikeTopPercent("aim", aim),
      faceitValue:
        faceitAimComparable != null
          ? faceitSub(formatDecimal(faceitAimComparable))
          : undefined,
    },
    {
      label: "Positioning",
      value: formatDecimal(positioning),
      topPercent: skillLikeTopPercent("positioning", positioning),
      faceitValue:
        faceitPositioningComparable != null
          ? faceitSub(formatDecimal(faceitPositioningComparable))
          : undefined,
    },
    {
      label: "Utility",
      value: formatDecimal(utility),
      topPercent: skillLikeTopPercent("utility", utility),
      faceitValue:
        faceitUtilityComparable != null
          ? faceitSub(formatDecimal(faceitUtilityComparable))
          : undefined,
    },
    {
      label: "Spray Accuracy",
      value: formatPercent(sprayAccuracy),
      topPercent: skillLikeTopPercent("spray", sprayAccuracy),
      faceitValue:
        faceitWindowStats?.sprayAccuracy != null
          ? faceitSub(formatPercent(faceitWindowStats.sprayAccuracy))
          : undefined,
    },
    {
      label: "Win rate",
      value: formatPercent(winRate),
      faceitValue:
        faceitWindowStats?.winRate != null
          ? faceitSub(formatPercent(faceitWindowStats.winRate))
          : faceitStats?.winRate != null
            ? faceitSub(formatPercent(faceitStats.winRate))
            : undefined,
    },
    {
      label: "Aim Accuracy",
      value: formatPercent(aimAccuracy),
      faceitValue:
        faceitWindowStats?.accuracy != null
          ? faceitSub(formatPercent(faceitWindowStats.accuracy))
          : undefined,
    },
    {
      label: "Head Accuracy",
      value: formatPercent(headAccuracy),
      topPercent: skillLikeTopPercent("hs", headAccuracy),
      faceitValue:
        faceitWindowStats?.hsPercent != null
          ? faceitSub(formatPercent(faceitWindowStats.hsPercent))
          : faceitStats?.hsPercent != null
            ? faceitSub(formatPercent(faceitStats.hsPercent))
            : undefined,
    },
    {
      label: "HLTV Rating 2.0",
      value: formatDecimal(windowStats?.hltvRating ?? null),
      faceitValue:
        faceitWindowStats?.hltvRating != null
          ? faceitSub(formatDecimal(faceitWindowStats.hltvRating))
          : undefined,
    },
    {
      label: "KAST",
      value: formatPercent(windowStats?.kast ?? null),
      faceitValue:
        faceitWindowStats?.kast != null
          ? faceitSub(formatPercent(faceitWindowStats.kast))
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

  const sample = windowStats?.sampleSize ?? null;

  return (
    <section className={embedded ? "bg-transparent p-5" : "border border-[var(--border)] bg-[var(--surface)] p-5"}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-[0.16em] text-[var(--foreground)]">
            Stats Overview
          </h2>
          {sample != null ? (
            <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
              Based on {formatNumber(sample)} matches · Leetify
            </p>
          ) : (
            <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
              Lifetime · Leetify / FACEIT / Steam
            </p>
          )}
        </div>

        {hasRows ? (
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
        {metrics.map((m) => (
          <div
            key={m.label}
            className="border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-3"
          >
            <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">
              {m.label}
            </p>
            <p className="mt-1 font-[family-name:var(--font-display)] text-xl font-bold tabular-nums text-[var(--foreground)]">
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
        ))}
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
