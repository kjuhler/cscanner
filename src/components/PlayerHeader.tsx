import {
  formatAccountAge,
  formatNumber,
} from "@/lib/format";
import { RankIcon } from "@/components/RankIcon";
import type {
  SteamExtras,
  SteamProfile,
} from "@/lib/types";

export type ProfileTab =
  | "overview"
  | "matches"
  | "maps"
  | "weapons"
  | "inventory"
  | "sources"
  | "banned-friends";

type Props = {
  steam: SteamProfile;
  extras: SteamExtras;
  activeTab?: ProfileTab;
  premierRating?: number | null;
  faceitLevel?: number | null;
  faceitElo?: number | null;
};

export function PlayerHeader({
  steam,
  extras,
  activeTab = "overview",
  premierRating,
  faceitLevel,
  faceitElo,
}: Props) {
  const presenceLabel = "Offline";
  const faceitEloLabel = faceitElo != null ? `${formatNumber(faceitElo)} ELO` : "No ELO";
  const tabs = [
    { label: "Overview", key: "overview" as const, href: "?tab=overview" },
    { label: "Matches", key: "matches" as const, href: "?tab=matches" },
    { label: "Maps", key: "maps" as const, href: "?tab=maps" },
    { label: "Weapons", key: "weapons" as const, href: "?tab=weapons" },
    {
      label: "Banned friends",
      key: "banned-friends" as const,
      href: "?tab=banned-friends",
    },
    { label: "Sources", key: "sources" as const, href: "?tab=sources" },
    { label: "Inventory", key: "inventory" as const, href: "?tab=inventory" },
  ] as const;

  return (
    <header className="relative overflow-hidden border border-[var(--border)] bg-[var(--surface)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 10% 0%, rgba(232,168,56,0.18), transparent 55%), linear-gradient(135deg, rgba(255,255,255,0.03), transparent 40%)",
        }}
      />
      <div className="relative p-4 sm:p-5">
        <div className="flex items-start gap-4">
          <div className="relative shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={steam.avatarFullUrl}
              alt=""
              width={88}
              height={88}
              className="h-[5.5rem] w-[5.5rem] border border-[var(--border)] object-cover"
            />
            {extras.steamLevel != null ? (
              <span
                className="absolute top-0 right-0 z-10 grid h-7 w-7 translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-[#182028] bg-[#f0bc5a] font-[family-name:var(--font-display)] text-[11px] font-extrabold text-[#1a2027] shadow-[0_2px_8px_rgba(0,0,0,0.45)]"
                title={`Steam level ${extras.steamLevel}`}
              >
                {extras.steamLevel}
              </span>
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">
              {steam.personaName}
            </h1>
            {steam.profilePrivate ? (
              <p className="mt-1 text-xs text-[var(--warn)]">
                Profile is private — some stats may be unavailable.
              </p>
            ) : null}

            <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
              <div>
                <Tag>STATUS</Tag>
                <p className="mt-0.5 font-[family-name:var(--font-display)] text-xl font-semibold leading-none text-[var(--foreground)]">
                  {presenceLabel}
                </p>
              </div>

              <div>
                <Tag>ACCOUNT AGE</Tag>
                <p className="mt-0.5 font-[family-name:var(--font-display)] text-xl font-semibold leading-none text-[var(--foreground)]">
                  {formatAccountAge(steam.accountAgeDays)}
                </p>
              </div>

              <div>
                <Tag>PREMIER</Tag>
                <div className="mt-1">
                  <RankIcon kind="premier" rating={premierRating} size="md" />
                </div>
              </div>

              <div>
                <Tag>FACEIT</Tag>
                <div className="mt-0.5">
                  <p className="inline-flex items-center gap-1.5 font-[family-name:var(--font-display)] text-xl font-semibold leading-none text-[var(--foreground)]">
                    <RankIcon kind="faceit" level={faceitLevel} size={22} />
                    {faceitEloLabel}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <nav
        aria-label="Profile sections"
        className="relative border-t border-[var(--border)] bg-[#121a20]"
      >
        <ul className="flex flex-wrap items-center gap-x-1 px-1.5 sm:px-2">
          {tabs.map((tab) => {
            const active = tab.key === activeTab;
            return (
              <li key={tab.label}>
                <a
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={
                    active
                      ? "border-b-2 border-[#24f7b6] px-3 py-2 text-sm font-semibold text-[var(--foreground)]"
                      : "border-b-2 border-transparent px-3 py-2 text-sm font-semibold text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
                  }
                >
                  {tab.label}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}

function Tag({ children }: { children: string }) {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8ea0b4]">
      {children}
    </span>
  );
}
