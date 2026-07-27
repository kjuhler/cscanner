"use client";

import type { CoachingTip } from "@/lib/demo/coaching";

const AREA_LABEL: Record<CoachingTip["area"], string> = {
  aim: "Aim",
  utility: "Utility",
  economy: "Economy",
  teamplay: "Teamplay",
  positioning: "Positioning",
};

const PRIORITY_CLASS: Record<CoachingTip["priority"], string> = {
  high: "text-[var(--danger)]",
  medium: "text-[var(--warn)]",
  low: "text-[var(--muted)]",
};

type Props = {
  playerName: string;
  tips: CoachingTip[];
};

export function PlayerCoachingPanel({ playerName, tips }: Props) {
  if (tips.length === 0) return null;

  return (
    <section className="space-y-3 border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
      <div>
        <p className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-[0.18em] text-[var(--amber)]">
          What to work on
        </p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Improvement focus for {playerName} based on this demo
          {tips.length > 1 ? ` (top ${tips.length})` : ""}.
        </p>
      </div>
      <ol className="space-y-3">
        {tips.map((tip, i) => (
          <li
            key={`${tip.area}-${tip.title}-${i}`}
            className="border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-3"
          >
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em]">
              <span className="text-[var(--foreground)]">{AREA_LABEL[tip.area]}</span>
              <span className={PRIORITY_CLASS[tip.priority]}>{tip.priority}</span>
            </div>
            <p className="mt-1 text-sm font-medium text-[var(--foreground)]">
              {tip.title}
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">{tip.detail}</p>
            <p className="mt-2 text-xs text-[var(--foreground)]/90">
              <span className="font-semibold uppercase tracking-[0.08em] text-[var(--amber)]">
                Train:
              </span>{" "}
              {tip.practice}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
