"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { RiskAssessment } from "@/lib/types";

function scoreColor(score: number | null): string {
  if (score == null) return "var(--muted)";
  if (score >= 60) return "var(--danger)";
  if (score >= 30) return "var(--warn)";
  return "var(--ok)";
}

type Props = {
  risk: RiskAssessment;
};

export function RiskScoreTooltip({ risk }: Props) {
  const color = scoreColor(risk.score);
  const tooltipId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);

  const flags =
    risk.redFlags.length > 0
      ? risk.redFlags
      : risk.signals.filter((s) => s.contribution > 0).slice(0, 4);

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
        className="cursor-help font-[family-name:var(--font-display)] text-xl font-bold leading-none tabular-nums underline decoration-dotted decoration-[var(--muted)] underline-offset-4"
        style={{ color }}
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
        onFocus={openNow}
        onClick={() => setOpen((v) => !v)}
      >
        {risk.score == null ? "—" : `${risk.score}%`}
      </button>

      {open ? (
        <div
          id={tooltipId}
          role="tooltip"
          className="absolute left-0 top-[calc(100%+0.35rem)] z-40 w-[min(22rem,calc(100vw-2.5rem))] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-lg"
          onMouseEnter={openNow}
          onMouseLeave={scheduleClose}
        >
          <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
            Risk breakdown
          </p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-sm font-semibold text-[var(--foreground)]">
            {risk.score == null
              ? "Not enough data"
              : `${risk.score}% · ${risk.level} · confidence ${risk.confidence}`}
          </p>

          {flags.length > 0 ? (
            <div className="mt-2.5">
              <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--danger)]">
                Red flags
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
                        +{f.contribution}
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

          {risk.protective.length > 0 ? (
            <div className="mt-2.5 border-t border-[var(--border)] pt-2.5">
              <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--ok)]">
                Pulls safer
              </p>
              <ul className="mt-1 space-y-1.5">
                {risk.protective.map((p) => (
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
            {risk.disclaimer}
          </p>
          <p className="mt-1 text-[10px] text-[var(--muted)]">
            Click % to pin · Esc to close
          </p>
        </div>
      ) : null}
    </div>
  );
}
