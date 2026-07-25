import type { PlayerBans } from "@/lib/types";

type Props = {
  bans: PlayerBans;
};

function yesNo(value: boolean): string {
  return value ? "Yes" : "No";
}

export function BansPanel({ bans }: Props) {
  const steam = bans.steam;
  const friends = bans.friends;
  const steamFriends = friends.steam;
  const faceitFriends = friends.faceit;

  const hasOwnBan =
    (steam &&
      (steam.vacBanned ||
        steam.numberOfVacBans > 0 ||
        steam.numberOfGameBans > 0 ||
        steam.communityBanned ||
        (steam.economyBan && steam.economyBan !== "none"))) ||
    bans.faceit.length > 0 ||
    bans.leetify.length > 0;

  const hasFriendBans =
    (steamFriends != null && steamFriends.banned > 0) ||
    (faceitFriends != null && faceitFriends.banned > 0);

  return (
    <section className="border border-[var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border)] px-5 py-3">
        <h2 className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
          Bans
        </h2>
      </div>

      <div className="grid gap-px bg-[var(--border)] sm:grid-cols-2 lg:grid-cols-4">
        <BanStat
          label="VAC"
          value={steam ? yesNo(steam.vacBanned || steam.numberOfVacBans > 0) : "—"}
          alert={Boolean(steam?.vacBanned || (steam && steam.numberOfVacBans > 0))}
        />
        <BanStat
          label="Game bans"
          value={steam ? String(steam.numberOfGameBans) : "—"}
          alert={Boolean(steam && steam.numberOfGameBans > 0)}
        />
        <BanStat
          label="Community"
          value={steam ? yesNo(steam.communityBanned) : "—"}
          alert={Boolean(steam?.communityBanned)}
        />
        <BanStat
          label="Economy"
          value={steam?.economyBan ?? "—"}
          alert={Boolean(steam && steam.economyBan !== "none")}
        />
      </div>

      <div className="grid gap-px border-t border-[var(--border)] bg-[var(--border)] sm:grid-cols-2">
        <BanStat
          label="Banned friends (CS2 / Steam)"
          value={
            friends.friendCount == null
              ? "Private"
              : steamFriends
                ? `${steamFriends.banned} / ${friends.friendCount}`
                : "—"
          }
          alert={Boolean(steamFriends && steamFriends.banned > 0)}
          hint={
            steamFriends
              ? `${steamFriends.vacBanned} VAC · ${steamFriends.gameBanned} game ban`
              : friends.friendCount == null
                ? "Friends list is private"
                : undefined
          }
          href={
            steamFriends && steamFriends.players.length > 0
              ? "#banned-friends"
              : undefined
          }
        />
        <BanStat
          label="Banned friends (FACEIT)"
          value={
            friends.friendCount == null
              ? "Private"
              : faceitFriends
                ? `${faceitFriends.banned} / ${faceitFriends.withFaceit}`
                : "—"
          }
          alert={Boolean(faceitFriends && faceitFriends.banned > 0)}
          hint={
            faceitFriends
              ? `Among ${faceitFriends.withFaceit} friends with FACEIT (sampled ${faceitFriends.sampled})`
              : friends.friendCount == null
                ? "Friends list is private"
                : "Requires FACEIT API key · samples up to 40 friends"
          }
        />
      </div>

      {steam && (steam.vacBanned || steam.numberOfGameBans > 0) ? (
        <p className="border-t border-[var(--border)] px-5 py-3 text-xs text-[var(--danger)]">
          Last Steam ban: {steam.daysSinceLastBan} day(s) ago · VAC count:{" "}
          {steam.numberOfVacBans} · Game bans: {steam.numberOfGameBans}
        </p>
      ) : null}

      {bans.faceit.length > 0 ? (
        <div className="border-t border-[var(--border)] px-5 py-3">
          <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
            FACEIT bans
          </p>
          <ul className="mt-2 space-y-1 text-sm text-[var(--foreground)]">
            {bans.faceit.map((ban, i) => (
              <li key={`${ban.type}-${ban.startsAt}-${i}`}>
                <span className="text-[var(--danger)]">{ban.type}</span>
                {ban.reason ? ` — ${ban.reason}` : ""}
                {ban.endsAt ? (
                  <span className="text-xs text-[var(--muted)]">
                    {" "}
                    (ends {ban.endsAt.slice(0, 10)})
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {bans.leetify.length > 0 ? (
        <div className="border-t border-[var(--border)] px-5 py-3">
          <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
            Platform bans (Leetify)
          </p>
          <ul className="mt-2 space-y-1 text-sm text-[var(--foreground)]">
            {bans.leetify.map((ban, i) => (
              <li key={`${ban.platform}-${i}`}>
                <span className="text-[var(--danger)]">{ban.platform}</span>
                {ban.reason ? ` — ${ban.reason}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!hasOwnBan && !hasFriendBans ? (
        <p className="border-t border-[var(--border)] px-5 py-3 text-sm text-[var(--ok)]">
          No VAC, game, community, FACEIT, or reported platform bans found.
        </p>
      ) : null}
    </section>
  );
}

function BanStat({
  label,
  value,
  alert,
  hint,
  href,
}: {
  label: string;
  value: string;
  alert: boolean;
  hint?: string;
  href?: string;
}) {
  const valueClass = `mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight ${
    alert ? "text-[var(--danger)]" : "text-[var(--foreground)]"
  }`;

  return (
    <div className="bg-[var(--surface)] px-4 py-4">
      <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
        {label}
      </p>
      {href ? (
        <a href={href} className={`${valueClass} underline-offset-4 hover:underline`}>
          {value}
        </a>
      ) : (
        <p className={valueClass}>{value}</p>
      )}
      {hint ? (
        <p className="mt-1 text-[11px] text-[var(--muted)]">{hint}</p>
      ) : null}
    </div>
  );
}
