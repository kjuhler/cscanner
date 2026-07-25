import type { TrackerSource } from "@/lib/sources";

type Props = {
  sources: TrackerSource[];
};

const STATUS_LABEL: Record<TrackerSource["status"], string> = {
  live: "Live",
  empty: "No data",
  link: "Open site",
  needs_key: "Needs key",
};

const STATUS_CLASS: Record<TrackerSource["status"], string> = {
  live: "text-[var(--ok)]",
  empty: "text-[var(--muted)]",
  link: "text-[var(--amber)]",
  needs_key: "text-[var(--warn)]",
};

export function TrackerSources({ sources }: Props) {
  return (
    <section className="border border-[var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border)] px-5 py-3">
        <h2 className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
          Tracker sources
        </h2>
      </div>
      <ul className="divide-y divide-[var(--border)]">
        {sources.map((source) => (
          <li
            key={source.id}
            className="flex flex-wrap items-start justify-between gap-3 px-5 py-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-wide text-[var(--foreground)]">
                  {source.name}
                </span>
                <span
                  className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${STATUS_CLASS[source.status]}`}
                >
                  {STATUS_LABEL[source.status]}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-[var(--muted)]">{source.detail}</p>
            </div>
            {source.href ? (
              <a
                href={source.href}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--amber)] hover:underline"
              >
                Open →
              </a>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="border-t border-[var(--border)] px-5 py-3 text-xs text-[var(--muted)]">
        Profile Check aggregates public Steam, FACEIT, and Leetify data in one place.
        Scope.gg and CSStats do not offer public APIs, so we deep-link their
        profiles like other multi-source trackers.
      </p>
    </section>
  );
}
