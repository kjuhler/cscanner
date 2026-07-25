import { formatDecimal, formatNumber, formatPercent } from "@/lib/format";
import { mapDisplayName } from "@/lib/maps";
import type { FaceitMapStats, SteamMapWins } from "@/lib/types";
import { MapIcon } from "@/components/MapIcon";

type MapRow = {
  map: string;
  matches?: string;
  winRate?: string;
  kd?: string;
  hsPercent?: string;
  wins?: string;
  rank?: string;
};

type Props = {
  title: string;
  rows: MapRow[];
  emptyMessage: string;
};

export function MapStatsTable({ title, rows, emptyMessage }: Props) {
  return (
    <section className="border border-[var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border)] px-5 py-3">
        <h2 className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
          {title}
        </h2>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-6 text-sm text-[var(--muted)]">{emptyMessage}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="border-b border-[var(--border)] text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
              <tr>
                <th className="px-5 py-2 font-medium">Map</th>
                {rows[0].matches != null ? (
                  <th className="px-3 py-2 font-medium">Matches</th>
                ) : null}
                {rows[0].wins != null ? (
                  <th className="px-3 py-2 font-medium">Wins</th>
                ) : null}
                {rows[0].winRate != null ? (
                  <th className="px-3 py-2 font-medium">Win %</th>
                ) : null}
                {rows[0].kd != null ? (
                  <th className="px-3 py-2 font-medium">K/D</th>
                ) : null}
                {rows[0].hsPercent != null ? (
                  <th className="px-3 py-2 font-medium">HS%</th>
                ) : null}
                {rows[0].rank != null ? (
                  <th className="px-3 py-2 font-medium">Rank</th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rows.map((row) => (
                <tr key={row.map}>
                  <td className="px-5 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <MapIcon map={row.map} size={26} />
                      <span className="font-[family-name:var(--font-display)] font-semibold uppercase tracking-wide">
                        {mapDisplayName(row.map)}
                      </span>
                    </div>
                  </td>
                  {row.matches != null ? (
                    <td className="px-3 py-2.5 font-mono text-xs text-[var(--muted)]">
                      {row.matches}
                    </td>
                  ) : null}
                  {row.wins != null ? (
                    <td className="px-3 py-2.5 font-mono text-xs text-[var(--muted)]">
                      {row.wins}
                    </td>
                  ) : null}
                  {row.winRate != null ? (
                    <td className="px-3 py-2.5 font-mono text-xs text-[var(--muted)]">
                      {row.winRate}
                    </td>
                  ) : null}
                  {row.kd != null ? (
                    <td className="px-3 py-2.5 font-mono text-xs text-[var(--muted)]">
                      {row.kd}
                    </td>
                  ) : null}
                  {row.hsPercent != null ? (
                    <td className="px-3 py-2.5 font-mono text-xs text-[var(--amber)]">
                      {row.hsPercent}
                    </td>
                  ) : null}
                  {row.rank != null ? (
                    <td className="px-3 py-2.5 text-xs text-[var(--foreground)]">
                      {row.rank}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function faceitMapsToRows(maps: FaceitMapStats[]) {
  return maps.map((m) => ({
    map: m.map,
    matches: formatNumber(m.matches),
    winRate: formatPercent(m.winRate),
    kd: formatDecimal(m.kd),
    hsPercent: formatPercent(m.hsPercent),
  }));
}

export function steamMapWinsToRows(maps: SteamMapWins[]) {
  return maps.map((m) => ({
    map: m.map,
    wins: formatNumber(m.wins),
  }));
}
