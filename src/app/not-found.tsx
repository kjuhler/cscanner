import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

export default function NotFound() {
  return (
    <>
      <SiteHeader showSearch />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold uppercase tracking-wide">
          Not found
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          That Steam ID looks invalid or the page does not exist.
        </p>
        <Link
          href="/"
          className="mt-6 bg-[var(--amber)] px-5 py-2.5 font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-[0.12em] text-[var(--ink)]"
        >
          Back home
        </Link>
      </main>
    </>
  );
}
