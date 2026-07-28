"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  formatDecimal,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import {
  aggregateMatchRows,
  filterMatchesByCount,
} from "@/lib/leetify/windowStats";
import type {
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
};

type Metric = {
  label: string;
  value: string;
};

function dash(): string {
  return "—";
}

export function StatsOverviewGrid({
  leetify,
  leetifyMatchRows,
  faceitStats,
  cs2,
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

  const ttd =
    windowStats?.timeToDamageMs ?? leetify?.timeToDamageMs ?? null;
  const crosshair =
    windowStats?.crosshairPlacement ?? leetify?.preaim ?? null;
  const preaim = windowStats?.preaim ?? leetify?.preaim ?? null;
  const kd = windowStats?.kd ?? cs2?.kd ?? faceitStats?.kd ?? null;
  const adr = windowStats?.adr ?? faceitStats?.averageAdr ?? null;
  const aimAccuracy = windowStats?.accuracy ?? null;
  const headAccuracy =
    windowStats?.hsPercent ??
    leetify?.hsPercent ??
    faceitStats?.hsPercent ??
    cs2?.hsPercent ??
    null;

  const metrics: Metric[] = [
    {
      label: "Time to Damage",
      value: ttd != null ? `${ttd}ms` : dash(),
    },
    {
      label: "Reaction Time",
      value:
        windowStats?.reactionTimeMs != null
          ? `${windowStats.reactionTimeMs}ms`
          : ttd != null
            ? `${ttd}ms`
            : dash(),
    },
    {
      label: "Crosshair Placement",
      value: crosshair != null ? `${formatDecimal(crosshair)}°` : dash(),
    },
    {
      label: "Preaim",
      value: preaim != null ? `${formatDecimal(preaim)}°` : dash(),
    },
    {
      label: "K/D Ratio",
      value: formatDecimal(kd),
    },
    {
      label: "ADR",
      value: formatDecimal(adr, 1),
    },
    {
      label: "Aim Accuracy",
      value: formatPercent(aimAccuracy),
    },
    {
      label: "Head Accuracy",
      value: formatPercent(headAccuracy),
    },
    {
      label: "Wallbang Kill %",
      value: formatPercent(windowStats?.wallbangKillPercent ?? null),
    },
    {
      label: "Smoke Kill %",
      value: formatPercent(windowStats?.smokeKillPercent ?? null),
    },
    {
      label: "HLTV Rating 2.0",
      value: formatDecimal(windowStats?.hltvRating ?? null),
    },
    {
      label: "KAST",
      value: formatPercent(windowStats?.kast ?? null),
    },
  ];

  const sample = windowStats?.sampleSize ?? null;

  return (
    <section className="border border-[var(--border)] bg-[var(--surface)] p-5">
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
            </p>
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
