import type { ReactNode } from "react";

type StatItem = {
  label: string;
  value: string;
};

type Props = {
  title: string;
  items: StatItem[];
  footer?: ReactNode;
  emptyMessage?: string;
};

export function StatsGrid({ title, items, footer, emptyMessage }: Props) {
  const hasValues = items.some((item) => item.value !== "—");

  return (
    <section className="border border-[var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border)] px-5 py-3">
        <h2 className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
          {title}
        </h2>
      </div>
      {!hasValues && emptyMessage ? (
        <p className="px-5 py-6 text-sm text-[var(--muted)]">{emptyMessage}</p>
      ) : (
        <div className="grid grid-cols-2 gap-px bg-[var(--border)] sm:grid-cols-4">
          {items.map((item) => (
            <div key={item.label} className="bg-[var(--surface)] px-4 py-4">
              <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
                {item.label}
              </p>
              <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--foreground)]">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      )}
      {footer ? (
        <div className="border-t border-[var(--border)] px-5 py-3">{footer}</div>
      ) : null}
    </section>
  );
}
