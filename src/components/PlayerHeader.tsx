import {
  formatAccountAge,
  formatHours,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import type {
  BannedFriendsStats,
  LeetifyStackStats,
  RiskAssessment,
  SteamExtras,
  SteamProfile,
} from "@/lib/types";
import { RiskScoreTooltip } from "@/components/RiskScoreTooltip";

type Props = {
  steam: SteamProfile;
  extras: SteamExtras;
  steamId: string;
  bannedFriends: BannedFriendsStats;
  stackStats?: LeetifyStackStats | null;
  risk: RiskAssessment;
};

export function PlayerHeader({
  steam,
  extras,
  steamId,
  bannedFriends,
  stackStats,
  risk,
}: Props) {
  return (
    <header className="relative border border-[var(--border)] bg-[var(--surface)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 10% 0%, rgba(232,168,56,0.18), transparent 55%), linear-gradient(135deg, rgba(255,255,255,0.03), transparent 40%)",
        }}
      />
      <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:gap-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={steam.avatarFullUrl}
          alt=""
          width={96}
          height={96}
          className="h-24 w-24 border border-[var(--border)] object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="font-[family-name:var(--font-display)] text-xs font-semibold uppercase tracking-[0.2em] text-[var(--amber)]">
            Profile Check
          </p>
          <h1 className="mt-1 truncate font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
            {steam.personaName}
          </h1>
          <p className="mt-1 font-mono text-xs text-[var(--muted)]">{steamId}</p>
          {steam.profilePrivate ? (
            <p className="mt-2 text-xs text-[var(--warn)]">
              Profile is private — some stats may be unavailable.
            </p>
          ) : null}
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          <Meta label="Account age" value={formatAccountAge(steam.accountAgeDays)} />
          <Meta label="Playtime" value={formatHours(extras.cs2PlaytimeHours)} />
          <Meta
            label="Level"
            value={extras.steamLevel != null ? String(extras.steamLevel) : "—"}
          />
          <Meta
            label="Banned friends"
            value={bannedFriendsLabel(bannedFriends)}
            href={
              (bannedFriends.steam?.players.length ?? 0) > 0
                ? "#banned-friends"
                : undefined
            }
          />
        </dl>
      </div>

      <RiskAndStackRow risk={risk} stackStats={stackStats ?? null} />
    </header>
  );
}

function RiskAndStackRow({
  risk,
  stackStats,
}: {
  risk: RiskAssessment;
  stackStats: LeetifyStackStats | null;
}) {
  const segments = stackStats
    ? [
        {
          key: "solo",
          label: "Solo",
          percent: stackStats.soloPercent,
          fill: "bg-[var(--foreground)]",
        },
        {
          key: "mid",
          label: "2–4",
          percent: stackStats.stack2to4Percent,
          fill: "bg-[var(--muted)]",
        },
        {
          key: "five",
          label: "5 stack",
          percent: stackStats.stack5Percent,
          fill: "bg-[var(--border)]",
        },
      ]
    : [];

  return (
    <div className="relative z-20 flex flex-col gap-3 border-t border-[var(--border)] px-5 py-3 lg:flex-row lg:items-center lg:gap-6">
      <div className="flex shrink-0 items-baseline gap-2.5">
        <p className="whitespace-nowrap text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
          Cheating risk
        </p>
        <RiskScoreTooltip risk={risk} />
      </div>

      {stackStats ? (
        <div className="min-w-0 flex-1 border-t border-[var(--border)] pt-3 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {segments.map((seg) => (
              <div key={seg.key} className="flex items-baseline gap-1.5">
                <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
                  {seg.label}
                </span>
                <span className="font-[family-name:var(--font-display)] text-sm font-semibold tabular-nums text-[var(--foreground)]">
                  {formatPercent(seg.percent)}
                </span>
              </div>
            ))}
            <span className="ml-auto text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
              {formatNumber(stackStats.sampleSize)} games
            </span>
          </div>
          <div className="mt-1.5 flex h-1 overflow-hidden bg-[var(--bg-elevated)]">
            {segments.map((seg) =>
              seg.percent > 0 ? (
                <div
                  key={seg.key}
                  className={`h-full ${seg.fill}`}
                  style={{ width: `${Math.max(seg.percent, 0)}%` }}
                  title={`${seg.label}: ${formatPercent(seg.percent)}`}
                />
              ) : null,
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function bannedFriendsLabel(friends: BannedFriendsStats): string {
  if (friends.friendCount == null) return "—";
  const banned = friends.steam?.banned ?? 0;
  return `${formatNumber(banned)} / ${formatNumber(friends.friendCount)}`;
}

function Meta({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
        {label}
      </dt>
      <dd className="mt-0.5 font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--foreground)]">
        {href ? (
          <a
            href={href}
            className="text-[var(--amber)] underline-offset-4 hover:underline"
          >
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
