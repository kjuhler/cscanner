"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { TrustAssessment, TrustLevel } from "@/lib/types";

function trustColor(score: number | null): string {
  if (score == null) return "var(--muted)";
  if (score >= 75) return "var(--trust-good)";
  if (score >= 55) return "var(--trust-elevated)";
  if (score >= 35) return "var(--trust-suspicious)";
  return "var(--trust-insane)";
}

function levelLabel(level: TrustLevel): string {
  if (level === "unknown") return "unknown";
  return level;
}

type Props = {
  trust: TrustAssessment;
  compact?: boolean;
};

export function TrustScoreTooltip({ trust, compact = false }: Props) {
  const color = trustColor(trust.score);
  const tooltipId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);

  const flags =
    trust.redFlags.length > 0
      ? trust.redFlags
      : trust.signals.filter((s) => s.contribution > 0).slice(0, 4);

  function clearCloseTimer() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  function openNow() {
    clearCloseTimer();
    setOpen(true);
  }

  function scheduleClose() {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setOpen(false), 200);
  }

  useEffect(() => {
    function onDocPointer(e: MouseEvent | KeyboardEvent) {
      if (e instanceof KeyboardEvent && e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (
        e instanceof MouseEvent &&
        rootRef.current &&
        !rootRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocPointer);
    document.addEventListener("keydown", onDocPointer);
    return () => {
      document.removeEventListener("mousedown", onDocPointer);
      document.removeEventListener("keydown", onDocPointer);
      clearCloseTimer();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={openNow}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        className={
          compact
            ? "grid h-5 w-5 place-items-center rounded-full border border-[var(--border)] text-[10px] font-semibold text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
            : "cursor-help font-[family-name:var(--font-display)] text-2xl font-bold leading-none tabular-nums underline decoration-dotted decoration-[var(--muted)] underline-offset-4"
        }
        style={compact ? undefined : { color }}
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
        onFocus={openNow}
        onClick={() => setOpen((v) => !v)}
        aria-label={compact ? "Open trust score details" : undefined}
      >
        {compact ? "?" : trust.score == null ? "—" : `${trust.score}%`}
      </button>

      {open ? (
        <div
          id={tooltipId}
          role="tooltip"
          className="absolute left-1/2 top-[calc(100%+0.5rem)] z-40 w-[min(22rem,calc(100vw-2.5rem))] -translate-x-1/2 border border-[var(--border)] bg-[var(--surface)] p-3 shadow-lg"
          onMouseEnter={openNow}
          onMouseLeave={scheduleClose}
        >
          <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
            Trust breakdown
          </p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-sm font-semibold text-[var(--foreground)]">
            {trust.score == null
              ? "Not enough data"
              : `${trust.score}% · ${levelLabel(trust.level)} · confidence ${trust.confidence}`}
          </p>

          {trust.pillars ? (
            <ul className="mt-2 space-y-1 text-xs text-[var(--muted)]">
              <li>Statistical Signals: {trust.pillars.statistical}</li>
              <li>Account History: {trust.pillars.accountFlags}</li>
              <li>Pattern Irregularities: {trust.pillars.anomalies}</li>
              {trust.accountBonus > 0 ? (
                <li className="text-[var(--ok)]">
                  Trust Bonus: +{trust.accountBonus}%
                </li>
              ) : null}
            </ul>
          ) : null}

          {flags.length > 0 ? (
            <div className="mt-2.5">
              <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--danger)]">
                Concerns
              </p>
              <ul className="mt-1 max-h-48 space-y-1.5 overflow-y-auto">
                {flags.map((f) => (
                  <li
                    key={f.id}
                    className="text-xs leading-snug text-[var(--foreground)]"
                  >
                    <span className="font-medium">{f.label}</span>
                    {f.contribution > 0 ? (
                      <span className="text-[var(--amber)]">
                        {" "}
                        −{f.contribution}
                      </span>
                    ) : null}
                    <span className="mt-0.5 block text-[var(--muted)]">
                      {f.detail}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-2.5 text-xs text-[var(--muted)]">
              No elevated public signals.
            </p>
          )}

          {trust.protective.length > 0 ? (
            <div className="mt-2.5 border-t border-[var(--border)] pt-2.5">
              <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--ok)]">
                Supports trust
              </p>
              <ul className="mt-1 space-y-1.5">
                {trust.protective.map((p) => (
                  <li
                    key={p.id}
                    className="text-xs leading-snug text-[var(--foreground)]"
                  >
                    <span className="font-medium">{p.label}</span>
                    <span className="mt-0.5 block text-[var(--muted)]">
                      {p.detail}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="mt-2.5 border-t border-[var(--border)] pt-2 text-[10px] leading-relaxed text-[var(--muted)]">
            {trust.disclaimer}
          </p>
          <p className="mt-1 text-[10px] text-[var(--muted)]">
            Click % to pin · Esc to close
          </p>
        </div>
      ) : null}
    </div>
  );
}
