import Link from "next/link";
import { formatNumber } from "@/lib/format";
import type { BannedFriend, BannedFriendsStats } from "@/lib/types";

type Props = {
  friends: BannedFriendsStats;
};

function banLabels(friend: BannedFriend): string {
  const parts: string[] = [];
  if (friend.vacBanned || friend.numberOfVacBans > 0) {
    parts.push(
      friend.numberOfVacBans > 1
        ? `VAC ×${friend.numberOfVacBans}`
        : "VAC",
    );
  }
  if (friend.numberOfGameBans > 0) {
    parts.push(
      friend.numberOfGameBans > 1
        ? `Game ×${friend.numberOfGameBans}`
        : "Game ban",
    );
  }
  return parts.join(" · ") || "Banned";
}

export function BannedFriendsPanel({ friends }: Props) {
  const players = friends.steam?.players ?? [];
  if (friends.friendCount == null) return null;
  if (!friends.steam || players.length === 0) return null;

  return (
    <section
      id="banned-friends"
      className="scroll-mt-6 border border-[var(--border)] bg-[var(--surface)]"
    >
      <div className="border-b border-[var(--border)] px-5 py-3">
        <h2 className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
          Banned friends
        </h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          {formatNumber(players.length)} of {formatNumber(friends.friendCount)}{" "}
          Steam friends with VAC or game bans
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
              <th className="px-5 py-2.5 font-semibold">Friend</th>
              <th className="px-3 py-2.5 font-semibold">Bans</th>
              <th className="px-5 py-2.5 font-semibold">Last ban</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {players.map((friend) => (
              <tr
                key={friend.steamId}
                className="bg-[var(--danger)]/5 hover:bg-[var(--danger)]/10"
              >
                <td className="px-5 py-3">
                  <Link
                    href={`/profiles/${friend.steamId}`}
                    className="flex items-center gap-3"
                  >
                    {friend.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={friend.avatarUrl}
                        alt=""
                        width={32}
                        height={32}
                        className="h-8 w-8 shrink-0 object-cover opacity-70 grayscale"
                      />
                    ) : (
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center bg-[var(--bg-elevated)] text-[10px] text-[var(--muted)]">
                        —
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-[var(--foreground)] hover:underline">
                        {friend.name}
                      </span>
                      <span className="block font-mono text-[10px] text-[var(--muted)]">
                        {friend.steamId}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-3 font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--danger)]">
                  {banLabels(friend)}
                </td>
                <td className="px-5 py-3 font-mono text-xs tabular-nums text-[var(--muted)]">
                  {friend.daysSinceLastBan}d ago
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
