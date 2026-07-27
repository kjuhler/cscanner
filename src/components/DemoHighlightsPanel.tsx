"use client";

import { useMemo, useState } from "react";
import type { CoachingHighlight } from "@/lib/demo";

type Props = {
  highlights: CoachingHighlight[];
  focusPlayerId?: string | null;
  onWatch: (highlight: CoachingHighlight) => void;
};

type Tab = "executes" | "impact" | "extra";

function matchesFocus(h: CoachingHighlight, focusPlayerId: string | null): boolean {
  if (!focusPlayerId || focusPlayerId === "all") return true;
  return (
    h.focusSteamId === focusPlayerId ||
    h.actorSteamIds.includes(focusPlayerId)
  );
}

function HighlightRow({
  highlight,
  onWatch,
  tone,
}: {
  highlight: CoachingHighlight;
  onWatch: (h: CoachingHighlight) => void;
  tone?: "good" | "bad" | "neutral";
}) {
  const badgeClass =
    tone === "good"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
      : tone === "bad"
        ? "border-[var(--warn)]/40 bg-[var(--warn)]/10 text-[var(--warn)]"
        : "border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--muted)]";

  return (
    <li className="flex flex-col gap-2 border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badgeClass}`}
          >
            R{highlight.round}
          </span>
          <p className="text-sm font-medium text-[var(--foreground)]">
            {highlight.title}
          </p>
        </div>
        <p className="mt-1 text-xs text-[var(--muted)]">{highlight.detail}</p>
        {(() => {
          if (!highlight.tags?.includes("plant_timing")) return null;
          const match = highlight.title.match(/plant @ \+([\d.]+)s/);
          return match ? (
            <p className="mt-0.5 text-[10px] uppercase tracking-wide text-[var(--amber)]">
              +{match[1]}s from freeze
            </p>
          ) : null;
        })()}
      </div>
      <button
        type="button"
        onClick={() => onWatch(highlight)}
        className="shrink-0 border border-[var(--amber)]/40 bg-[var(--amber)]/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--amber-bright)] hover:bg-[var(--amber)]/20"
      >
        Watch
      </button>
    </li>
  );
}

export function DemoHighlightsPanel({
  highlights,
  focusPlayerId = null,
  onWatch,
}: Props) {
  const [tab, setTab] = useState<Tab>("executes");

  const filtered = useMemo(
    () => highlights.filter((h) => matchesFocus(h, focusPlayerId ?? null)),
    [highlights, focusPlayerId],
  );

  const goodExecutes = useMemo(
    () => filtered.filter((h) => h.kind === "execute_good"),
    [filtered],
  );
  const badExecutes = useMemo(
    () => filtered.filter((h) => h.kind === "execute_bad"),
    [filtered],
  );

  const groupExecutes = (items: CoachingHighlight[]) => {
    const a = items.filter((h) => h.tags?.includes("a_site"));
    const b = items.filter((h) => h.tags?.includes("b_site"));
    const other = items.filter(
      (h) => !h.tags?.includes("a_site") && !h.tags?.includes("b_site"),
    );
    return { a, b, other };
  };

  const goodGroups = useMemo(() => groupExecutes(goodExecutes), [goodExecutes]);
  const badGroups = useMemo(() => groupExecutes(badExecutes), [badExecutes]);
  const impactPlays = useMemo(
    () =>
      filtered
        .filter((h) => h.kind === "impact_play")
        .sort((a, b) => b.score - a.score)
        .slice(0, 20),
    [filtered],
  );
  const flashChains = useMemo(
    () => filtered.filter((h) => h.kind === "flash_chain"),
    [filtered],
  );
  const trades = useMemo(
    () => filtered.filter((h) => h.kind === "trade").slice(0, 15),
    [filtered],
  );

  if (highlights.length === 0) return null;

  return (
    <section className="space-y-4 border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-[0.18em] text-[var(--amber)]">
            Coaching highlights
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Jump to key executes and impact plays in the radar replay.
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {(
            [
              ["executes", "Executes"],
              ["impact", "Impact"],
              ["extra", "More"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] ${
                tab === id
                  ? "border border-[var(--amber)]/50 bg-[var(--amber)]/15 text-[var(--amber-bright)]"
                  : "border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "executes" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-400">
              Good executes ({goodExecutes.length})
            </h4>
            {goodExecutes.length === 0 ? (
              <p className="mt-2 text-xs text-[var(--muted)]">
                No site executes or flash follow-ups found.
              </p>
            ) : (
              <div className="mt-2 space-y-4">
                {goodGroups.a.length > 0 ? (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                      A site
                    </p>
                    <ul className="mt-1 space-y-2">
                      {goodGroups.a.map((h) => (
                        <HighlightRow
                          key={h.id}
                          highlight={h}
                          onWatch={onWatch}
                          tone="good"
                        />
                      ))}
                    </ul>
                  </div>
                ) : null}
                {goodGroups.b.length > 0 ? (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                      B site
                    </p>
                    <ul className="mt-1 space-y-2">
                      {goodGroups.b.map((h) => (
                        <HighlightRow
                          key={h.id}
                          highlight={h}
                          onWatch={onWatch}
                          tone="good"
                        />
                      ))}
                    </ul>
                  </div>
                ) : null}
                {goodGroups.other.length > 0 ? (
                  <ul className="space-y-2">
                    {goodGroups.other.map((h) => (
                      <HighlightRow
                        key={h.id}
                        highlight={h}
                        onWatch={onWatch}
                        tone="good"
                      />
                    ))}
                  </ul>
                ) : null}
              </div>
            )}
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--warn)]">
              Failed executes ({badExecutes.length})
            </h4>
            {badExecutes.length === 0 ? (
              <p className="mt-2 text-xs text-[var(--muted)]">
                No wasted or no-follow-up flashes flagged.
              </p>
            ) : (
              <div className="mt-2 space-y-4">
                {badGroups.a.length > 0 ? (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                      A site
                    </p>
                    <ul className="mt-1 space-y-2">
                      {badGroups.a.map((h) => (
                        <HighlightRow
                          key={h.id}
                          highlight={h}
                          onWatch={onWatch}
                          tone="bad"
                        />
                      ))}
                    </ul>
                  </div>
                ) : null}
                {badGroups.b.length > 0 ? (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                      B site
                    </p>
                    <ul className="mt-1 space-y-2">
                      {badGroups.b.map((h) => (
                        <HighlightRow
                          key={h.id}
                          highlight={h}
                          onWatch={onWatch}
                          tone="bad"
                        />
                      ))}
                    </ul>
                  </div>
                ) : null}
                {badGroups.other.length > 0 ? (
                  <ul className="space-y-2">
                    {badGroups.other.map((h) => (
                      <HighlightRow
                        key={h.id}
                        highlight={h}
                        onWatch={onWatch}
                        tone="bad"
                      />
                    ))}
                  </ul>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {tab === "impact" ? (
        <ul className="space-y-2">
          {impactPlays.length === 0 ? (
            <li className="text-xs text-[var(--muted)]">
              No high-impact plays detected for this filter.
            </li>
          ) : (
            impactPlays.map((h) => (
              <HighlightRow
                key={h.id}
                highlight={h}
                onWatch={onWatch}
                tone="neutral"
              />
            ))
          )}
        </ul>
      ) : null}

      {tab === "extra" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--amber)]">
              Flash → kill ({flashChains.length})
            </h4>
            <ul className="mt-2 space-y-2">
              {flashChains.length === 0 ? (
                <li className="text-xs text-[var(--muted)]">
                  No direct flash-to-kill chains found.
                </li>
              ) : (
                flashChains.map((h) => (
                  <HighlightRow
                    key={h.id}
                    highlight={h}
                    onWatch={onWatch}
                    tone="good"
                  />
                ))
              )}
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              Missed trades ({trades.length})
            </h4>
            <ul className="mt-2 space-y-2">
              {trades.length === 0 ? (
                <li className="text-xs text-[var(--muted)]">
                  No obvious missed trades in this match.
                </li>
              ) : (
                trades.map((h) => (
                  <HighlightRow
                    key={h.id}
                    highlight={h}
                    onWatch={onWatch}
                    tone="bad"
                  />
                ))
              )}
            </ul>
          </div>
        </div>
      ) : null}
    </section>
  );
}
