import { mapDisplayName } from "@/lib/maps";
import type { CompetitiveMapRank } from "@/lib/types";
import { MapIcon } from "@/components/MapIcon";
import { RankIcon } from "@/components/RankIcon";

type Props = {
  ranks: CompetitiveMapRank[];
};

export function CompetitiveRanksPanel({ ranks }: Props) {
  if (ranks.length === 0) {
    return (
      <section className="h-full border border-[var(--border)] bg-[var(--surface)]">
        <div className="border-b border-[var(--border)] px-5 py-3">
          <h2 className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            Competitive ranks by map
          </h2>
        </div>
        <p className="px-5 py-5 text-sm text-[var(--muted)]">
          No competitive map ranks found.
        </p>
      </section>
    );
  }

  return (
    <section className="h-full border border-[var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border)] px-5 py-3">
        <h2 className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
          Competitive ranks by map
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-px bg-[var(--border)] sm:grid-cols-3">
        {ranks.map((entry) => (
          <div
            key={entry.map}
            className="flex flex-col items-center gap-2 bg-[var(--surface)] px-3 py-3"
          >
            <p className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              {mapDisplayName(entry.map)}
            </p>
            <div className="flex items-center gap-2">
              <MapIcon map={entry.map} size={28} />
              <RankIcon kind="competitive" rank={entry.rank} size={72} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
