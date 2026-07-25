import { formatDecimal, formatMatchDate } from "@/lib/format";
import { mapDisplayName } from "@/lib/maps";
import type { LeetifyRecentMatch } from "@/lib/types";
import { MapIcon } from "@/components/MapIcon";
import { RankIcon } from "@/components/RankIcon";

type Props = {
  matches: LeetifyRecentMatch[];
};

function Rating({ value }: { value: number | null }) {
  if (value == null) {
    return <span className="text-[var(--muted)]">—</span>;
  }
  const positive = value >= 0;
  return (
    <span className={positive ? "text-[var(--ok)]" : "text-[var(--danger)]"}>
      {positive ? "+" : ""}
      {formatDecimal(value)}
    </span>
  );
}

function MatchRank({ match }: { match: LeetifyRecentMatch }) {
  if (match.premierRating != null) {
    return (
      <RankIcon kind="premier" rating={match.premierRating} size="sm" />
    );
  }
  if (match.competitiveRank != null) {
    return (
      <RankIcon kind="competitive" rank={match.competitiveRank} size={56} />
    );
  }
  if (match.csgoRank != null) {
    return <RankIcon kind="competitive" rank={match.csgoRank} size={56} />;
  }
  return (
    <span
      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border)] text-xs text-[var(--muted)]"
      title="Rank unknown"
    >
      ?
    </span>
  );
}

export function LeetifyMatchHistory({ matches }: Props) {
  if (matches.length === 0) return null;

  const bannedCount = matches.filter((m) => m.hasBannedPlayer).length;

  return (
    <section className="border border-[var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border)] px-5 py-3">
        <h2 className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
          Match history
        </h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Leetify
          {bannedCount > 0 ? (
            <span className="ml-2 text-[var(--danger)]">
              · {bannedCount} with banned player
            </span>
          ) : null}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
              <th className="px-5 py-2.5 font-semibold">Map</th>
              <th className="px-3 py-2.5 font-semibold">Score</th>
              <th className="px-3 py-2.5 font-semibold">Rank</th>
              <th className="px-3 py-2.5 font-semibold">Rating</th>
              <th className="px-3 py-2.5 font-semibold">K / D</th>
              <th className="px-3 py-2.5 font-semibold">K/D</th>
              <th className="px-5 py-2.5 font-semibold">Banned</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {matches.map((match) => {
              const finishedUnix = match.finishedAt
                ? Math.floor(new Date(match.finishedAt).getTime() / 1000)
                : null;

              return (
                <tr
                  key={match.id}
                  className={
                    match.hasBannedPlayer
                      ? "bg-[var(--danger)]/5 hover:bg-[var(--danger)]/10"
                      : "hover:bg-[var(--bg-elevated)]/40"
                  }
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <MapIcon map={match.map} size={28} />
                      <div className="min-w-0">
                        <p className="truncate text-[var(--foreground)]">
                          {mapDisplayName(match.map)}
                        </p>
                        <p className="text-[11px] text-[var(--muted)]">
                          {formatMatchDate(finishedUnix)}
                          {match.source ? ` · ${match.source}` : ""}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={
                        match.outcome === "win"
                          ? "font-mono tabular-nums text-[var(--ok)]"
                          : match.outcome === "loss"
                            ? "font-mono tabular-nums text-[var(--danger)]"
                            : "font-mono tabular-nums text-[var(--muted)]"
                      }
                    >
                      {match.score ?? "—"}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <MatchRank match={match} />
                  </td>
                  <td className="px-3 py-3 font-mono tabular-nums">
                    <Rating value={match.leetifyRating} />
                  </td>
                  <td className="px-3 py-3 font-mono tabular-nums text-[var(--foreground)]">
                    {match.kills != null || match.deaths != null
                      ? `${match.kills ?? "—"} / ${match.deaths ?? "—"}`
                      : "—"}
                  </td>
                  <td className="px-3 py-3 font-mono tabular-nums text-[var(--foreground)]">
                    {match.kd != null ? formatDecimal(match.kd) : "—"}
                  </td>
                  <td className="px-5 py-3">
                    {match.hasBannedPlayer ? (
                      <span
                        className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--danger)]"
                        title="Leetify marked a banned player in this lobby"
                      >
                        Yes
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--muted)]">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
