import Link from "next/link";
import { SearchForm } from "@/components/SearchForm";

export function SiteHeader({ showSearch = false }: { showSearch?: boolean }) {
  return (
    <div className="border-b border-[var(--border)] bg-[var(--bg-elevated)]/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="font-[family-name:var(--font-display)] text-lg font-bold uppercase tracking-[0.14em] text-[var(--foreground)]"
          >
            <span className="text-[var(--amber)]">Profile</span> Check
          </Link>
          <nav className="flex items-center gap-4 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            <Link
              href="/demo"
              className="hover:text-[var(--amber)]"
            >
              Demo
            </Link>
          </nav>
        </div>
        {showSearch ? (
          <div className="w-full sm:max-w-md">
            <SearchForm compact />
          </div>
        ) : null}
      </div>
    </div>
  );
}
