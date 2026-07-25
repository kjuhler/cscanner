import Link from "next/link";
import { SearchForm } from "@/components/SearchForm";
import { SiteHeader } from "@/components/SiteHeader";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className="relative flex flex-1 flex-col">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "linear-gradient(rgba(42,51,61,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(42,51,61,0.5) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage:
              "radial-gradient(ellipse 70% 60% at 50% 30%, black, transparent)",
          }}
        />

        <section className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-16 sm:py-24">
          <p className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-[0.28em] text-[var(--amber)]">
            Profile Check
          </p>
          <h1 className="mt-3 max-w-xl font-[family-name:var(--font-display)] text-4xl font-bold leading-[1.05] tracking-tight text-[var(--foreground)] sm:text-6xl">
            CS2 stats tracker &amp; cheating signals
          </h1>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-[var(--muted)] sm:text-lg">
            Look up any player by Steam ID or profile URL. Check cheating
            signals, K/D, win rate, headshot %, Premier, FACEIT ELO, Leetify
            performance, and recent matches — then jump to CSStats or Scope.gg
            when you need their tools.
          </p>

          <div className="mt-8">
            <SearchForm />
          </div>

          <ul className="mt-6 grid gap-2 text-xs text-[var(--muted)] sm:grid-cols-2">
            <li>
              Paste a Steam URL, vanity, or SteamID64
            </li>
            <li>
              Swap{" "}
              <span className="text-[var(--foreground)]">.com → .name</span> on
              any Steam profile URL
            </li>
            <li>Live: Steam · FACEIT · Leetify</li>
            <li>Deep links: CSStats · Scope.gg</li>
          </ul>

          <p className="mt-6 text-xs text-[var(--muted)]">
            Example:{" "}
            <Link
              href="/profiles/76561197991294686"
              className="text-[var(--amber)] underline-offset-2 hover:underline"
            >
              steamcommunity.name/profiles/76561197991294686
            </Link>
          </p>
        </section>
      </main>
    </>
  );
}
