"use client";

import { useState } from "react";
import { formatMatchDate } from "@/lib/format";
import { mapDisplayName } from "@/lib/maps";
import type { FaceitMatch } from "@/lib/types";
import { MapIcon } from "@/components/MapIcon";

type Props = {
  matches: FaceitMatch[];
  faceitLevel?: number | null;
};

export function MatchHistory({ matches, faceitLevel = null }: Props) {
  const PAGE_SIZE = 12;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const visibleMatches = matches.slice(0, visibleCount);
  const canShowMore = visibleCount < matches.length;
  const canShowLess = visibleCount > PAGE_SIZE;

  return (
    <section className="border border-[var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border)] px-5 py-3">
        <h2 className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
          Recent matches
        </h2>
      </div>

      {matches.length === 0 ? (
        <p className="px-5 py-6 text-sm text-[var(--muted)]">
          No FACEIT match history available.
        </p>
      ) : (
        <>
          <ul className="divide-y divide-[var(--border)]">
          {visibleMatches.map((match) => (
            <li key={match.matchId}>
              <a
                href={match.faceitUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 transition hover:bg-white/[0.03]"
              >
                <div className="flex items-center gap-3">
                  <MapIcon map={match.map} size={28} />
                  <span
                    className={
                      match.result === "win"
                        ? "font-[family-name:var(--font-display)] text-xs font-bold uppercase tracking-wider text-[var(--ok)]"
                        : match.result === "loss"
                          ? "font-[family-name:var(--font-display)] text-xs font-bold uppercase tracking-wider text-[var(--danger)]"
                          : "font-[family-name:var(--font-display)] text-xs font-bold uppercase tracking-wider text-[var(--muted)]"
                    }
                  >
                    {match.result === "unknown" ? "—" : match.result}
                  </span>
                  <div>
                    <p className="text-sm text-[var(--foreground)]">
                      {match.map
                        ? mapDisplayName(match.map)
                        : match.gameMode || "FACEIT match"}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {formatMatchDate(match.finishedAt)}
                      {match.score ? ` · ${match.score}` : ""}
                    </p>
                  </div>
                </div>
                <span className="font-mono text-xs text-[var(--muted)]">
                  {faceitLevel != null ? `L${faceitLevel}` : "L—"}
                  {match.elo != null ? ` · ELO ${match.elo}` : ""}
                </span>
              </a>
            </li>
          ))}
          </ul>
          <div className="flex items-center justify-between border-t border-[var(--border)] px-5 py-3">
            <p className="text-xs text-[var(--muted)]">
              Showing {visibleMatches.length} of {matches.length}
            </p>
            <div className="flex items-center gap-2">
              {canShowLess ? (
                <button
                  type="button"
                  onClick={() => setVisibleCount(PAGE_SIZE)}
                  className="border border-[var(--border)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
                >
                  Show less
                </button>
              ) : null}
              {canShowMore ? (
                <button
                  type="button"
                  onClick={() => setVisibleCount((v) => Math.min(matches.length, v + PAGE_SIZE))}
                  className="border border-[var(--border)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--foreground)] transition-colors hover:border-[var(--amber)]"
                >
                  Show more
                </button>
              ) : null}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
