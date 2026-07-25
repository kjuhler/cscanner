"use client";

import { formatPercent } from "@/lib/format";
import { competitiveRankName, formatPremier } from "@/lib/ranks";
import type { Cs2SeasonRank, CsgoRankSummary } from "@/lib/types";
import { RankIcon } from "@/components/RankIcon";

type Props = {
  cs2: Cs2SeasonRank[];
  csgo: CsgoRankSummary | null;
};

function WinRate({ value }: { value: number | null }) {
  if (value == null) return null;
  return (
    <span className="text-xs text-[var(--muted)]">
      {formatPercent(value)} WR
    </span>
  );
}

export function SeasonRanksPanel({ cs2, csgo }: Props) {
  const premierSeasons = cs2.filter(
    (season) => season.premierMax != null || season.premierMin != null,
  );

  if (premierSeasons.length === 0 && !csgo) return null;

  return (
    <section className="group/season relative h-full border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-5 py-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            Season ranks
          </h2>
          <p className="mt-1 text-xs text-[var(--muted)]">CS2 Premier</p>
        </div>
        {csgo ? (
          <span
            className="cursor-default border border-[var(--border)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)] transition group-hover/season:border-[var(--amber)]/50 group-hover/season:text-[var(--amber)]"
            title="Hover panel to see CS:GO ranks"
          >
            Hover: CS:GO
          </span>
        ) : null}
      </div>

      {premierSeasons.length === 0 ? (
        <p className="px-5 py-5 text-sm text-[var(--muted)]">
          No CS2 Premier season ranks found.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {premierSeasons.map((season) => (
            <li
              key={season.seasonNumber}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
            >
              <div className="min-w-0">
                <p className="font-[family-name:var(--font-display)] text-sm font-semibold text-[var(--foreground)]">
                  {season.title}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-[var(--muted)]">
                  <span>{season.matches} matches</span>
                  <WinRate value={season.winRate} />
                </p>
              </div>
              <div className="flex items-center gap-2">
                <RankIcon
                  kind="premier"
                  rating={season.premierMax ?? season.premierMin}
                  size="sm"
                />
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">
                    Premier
                  </p>
                  <p className="font-mono text-xs text-[var(--foreground)]">
                    {formatPremier(season.premierMin)}
                    {" – "}
                    {formatPremier(season.premierMax)}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {csgo ? (
        <div
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[var(--surface)]/95 opacity-0 transition-opacity duration-200 group-hover/season:opacity-100"
          aria-hidden
        >
          <div className="flex flex-wrap items-center justify-center gap-4 px-5 py-4">
            {csgo.rankMax != null ? (
              <RankIcon kind="competitive" rank={csgo.rankMax} size={88} />
            ) : null}
            <div className="text-center sm:text-left">
              <p className="font-[family-name:var(--font-display)] text-xs font-semibold uppercase tracking-[0.14em] text-[var(--amber)]">
                CS:GO Competitive
              </p>
              <p className="mt-1 font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--foreground)]">
                {csgo.rankMax != null
                  ? competitiveRankName(csgo.rankMax)
                  : "—"}
              </p>
              <p className="mt-1 flex flex-wrap items-center justify-center gap-x-2 text-xs text-[var(--muted)] sm:justify-start">
                <span>{csgo.matches} matches</span>
                <WinRate value={csgo.winRate} />
              </p>
              {csgo.rankMin != null &&
              csgo.rankMax != null &&
              csgo.rankMin !== csgo.rankMax ? (
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Low {competitiveRankName(csgo.rankMin)}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
