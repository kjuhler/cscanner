import Link from "next/link";
import { formatDecimal, formatPercent } from "@/lib/format";
import { formatPremier } from "@/lib/ranks";
import type { LeetifyTeammate } from "@/lib/types";
import { RankIcon } from "@/components/RankIcon";

type Props = {
  teammates: LeetifyTeammate[];
};

function Rating({ value }: { value: number | null }) {
  if (value == null) {
    return <span className="text-[var(--muted)]">—</span>;
  }
  const positive = value >= 0;
  return (
    <span
      className={
        positive ? "text-[var(--ok)]" : "text-[var(--danger)]"
      }
    >
      {positive ? "+" : ""}
      {formatDecimal(value)}
    </span>
  );
}

export function LeetifyTeammatesPanel({ teammates }: Props) {
  if (teammates.length === 0) return null;

  const bannedCount = teammates.filter((t) => t.isBanned).length;
  const sorted = [...teammates].sort((a, b) => {
    if (a.isBanned !== b.isBanned) return a.isBanned ? -1 : 1;
    return b.matchesTogether - a.matchesTogether;
  });

  return (
    <section className="border border-[var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border)] px-5 py-3">
        <h2 className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
          Teammates
        </h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Most played with · Leetify
          {bannedCount > 0 ? (
            <span className="ml-2 text-[var(--danger)]">
              · {bannedCount} banned
            </span>
          ) : null}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
              <th className="px-5 py-2.5 font-semibold">Player</th>
              <th className="px-3 py-2.5 font-semibold">Status</th>
              <th className="px-3 py-2.5 font-semibold">Matches</th>
              <th className="px-3 py-2.5 font-semibold">WR</th>
              <th className="px-3 py-2.5 font-semibold">You</th>
              <th className="px-3 py-2.5 font-semibold">Them</th>
              <th className="px-5 py-2.5 font-semibold">Rank</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {sorted.map((t) => (
              <tr
                key={t.steamId}
                className={
                  t.isBanned
                    ? "bg-[var(--danger)]/5 hover:bg-[var(--danger)]/10"
                    : "hover:bg-[var(--bg-elevated)]/40"
                }
              >
                <td className="px-5 py-3">
                  <Link
                    href={`/profiles/${t.steamId}`}
                    className="flex items-center gap-3"
                  >
                    {t.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={t.avatarUrl}
                        alt=""
                        width={32}
                        height={32}
                        className={`h-8 w-8 shrink-0 object-cover ${
                          t.isBanned ? "opacity-60 grayscale" : ""
                        }`}
                      />
                    ) : (
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center bg-[var(--bg-elevated)] text-[10px] text-[var(--muted)]">
                        —
                      </span>
                    )}
                    <span className="block truncate font-medium text-[var(--foreground)] hover:underline">
                      {t.name}
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-3">
                  {t.isBanned ? (
                    <span className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--danger)]">
                      Banned
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--muted)]">OK</span>
                  )}
                </td>
                <td className="px-3 py-3 font-mono tabular-nums text-[var(--foreground)]">
                  {t.matchesTogether}
                </td>
                <td className="px-3 py-3 font-mono tabular-nums text-[var(--foreground)]">
                  {formatPercent(t.winRateTogether)}
                </td>
                <td className="px-3 py-3 font-mono tabular-nums">
                  <Rating value={t.playerRating} />
                </td>
                <td className="px-3 py-3 font-mono tabular-nums">
                  <Rating value={t.teammateRating} />
                </td>
                <td className="px-5 py-3">
                  {t.premierRating != null ? (
                    <div className="flex items-center gap-2">
                      <RankIcon
                        kind="premier"
                        rating={t.premierRating}
                        size="sm"
                      />
                      <span className="font-mono text-xs text-[var(--muted)]">
                        {formatPremier(t.premierRating)}
                      </span>
                    </div>
                  ) : t.competitiveRank != null ? (
                    <RankIcon
                      kind="competitive"
                      rank={t.competitiveRank}
                      size={56}
                    />
                  ) : (
                    <span className="text-[var(--muted)]">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
