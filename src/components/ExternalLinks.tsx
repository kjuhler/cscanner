import { steamId64ToAccountId } from "@/lib/scope";

type Props = {
  steamId: string;
  faceitUrl?: string | null;
  scopeUrl?: string | null;
};

function defaultScopeUrl(steamId64: string): string {
  const accountId = steamId64ToAccountId(steamId64);
  return accountId != null
    ? `https://app.scope.gg/profile/${accountId}`
    : "https://app.scope.gg/";
}

export function ExternalLinks({ steamId, faceitUrl, scopeUrl }: Props) {
  const links = [
    {
      label: "Steam",
      href: `https://steamcommunity.com/profiles/${steamId}`,
    },
    faceitUrl ? { label: "FACEIT", href: faceitUrl } : null,
    {
      label: "Leetify",
      href: `https://leetify.com/app/profile/${steamId}`,
    },
    {
      label: "CSStats",
      href: `https://csstats.gg/player/${steamId}`,
    },
    {
      label: "Scope.gg",
      href: scopeUrl ?? defaultScopeUrl(steamId),
    },
  ].filter(Boolean) as Array<{ label: string; href: string }>;

  return (
    <section className="border border-[var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border)] px-5 py-3">
        <h2 className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
          Open on other trackers
        </h2>
      </div>
      <div className="flex flex-wrap gap-2 p-5">
        {links.map((link) => (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="border border-[var(--border)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--foreground)] transition hover:border-[var(--amber)] hover:text-[var(--amber)]"
          >
            {link.label}
          </a>
        ))}
      </div>
    </section>
  );
}
