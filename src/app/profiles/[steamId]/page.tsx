import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BannedFriendsPanel } from "@/components/BannedFriendsPanel";
import { BansPanel } from "@/components/BansPanel";
import { CompetitiveRanksPanel } from "@/components/CompetitiveRanksPanel";
import { ExternalLinks } from "@/components/ExternalLinks";
import {
  MapStatsTable,
  faceitMapsToRows,
  steamMapWinsToRows,
} from "@/components/MapStatsTable";
import { LeetifyMapsPanel } from "@/components/LeetifyMapsPanel";
import { LeetifyMatchHistory } from "@/components/LeetifyMatchHistory";
import { LeetifyTeammatesPanel } from "@/components/LeetifyTeammatesPanel";
import { MatchHistory } from "@/components/MatchHistory";
import { PlayerHeader } from "@/components/PlayerHeader";
import { PremierPanel } from "@/components/PremierPanel";
import { SeasonRanksPanel } from "@/components/SeasonRanksPanel";
import { SiteHeader } from "@/components/SiteHeader";
import { StatsGrid } from "@/components/StatsGrid";
import { TrackerSources } from "@/components/TrackerSources";
import {
  formatDecimal,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import { aggregatePlayer } from "@/lib/player/aggregate";
import { buildTrackerSources } from "@/lib/sources";
import { isSteamId64 } from "@/lib/steam";

type PageProps = {
  params: Promise<{ steamId: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { steamId } = await params;
  return {
    title: steamId,
    description: `CS2 stats and cheat risk signals for Steam ID ${steamId}`,
  };
}

export default async function ProfilePage({ params }: PageProps) {
  const { steamId } = await params;

  if (!isSteamId64(steamId)) {
    notFound();
  }

  const data = await aggregatePlayer(steamId);

  if (!data.steam) {
    return (
      <>
        <SiteHeader showSearch />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
          <div className="border border-[var(--border)] bg-[var(--surface)] px-5 py-10 text-center">
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold uppercase tracking-wide">
              Player not found
            </h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Steam did not return a profile for{" "}
              <span className="font-mono text-[var(--foreground)]">
                {steamId}
              </span>
              .
            </p>
            {data.errors.length > 0 ? (
              <ul className="mx-auto mt-4 max-w-md space-y-1 text-left text-xs text-[var(--danger)]">
                {data.errors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </main>
      </>
    );
  }

  const faceit = data.faceit;
  const last = data.cs2?.lastMatch;

  return (
    <>
      <SiteHeader showSearch />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-8">
        <PlayerHeader
          steam={data.steam}
          extras={data.steamExtras}
          steamId={steamId}
          bannedFriends={data.bans.friends}
          stackStats={data.leetify?.stackStats ?? null}
          risk={data.risk}
        />

        <PremierPanel
          steamId={steamId}
          leetify={data.leetify}
          faceitPlayer={faceit.player}
          kd={data.cs2?.kd ?? faceit.stats?.kd ?? null}
        />

        <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
          <SeasonRanksPanel
            cs2={data.leetify?.seasonRanksCs2 ?? []}
            csgo={data.leetify?.csgoRanks ?? null}
          />
          <CompetitiveRanksPanel ranks={data.leetify?.competitive ?? []} />
        </div>

        <LeetifyMapsPanel maps={data.leetify?.mapStats ?? []} />

        <BansPanel bans={data.bans} />

        <BannedFriendsPanel friends={data.bans.friends} />

        <div className="grid gap-4 lg:grid-cols-2">
          <StatsGrid
            title="Steam CS2 lifetime"
            emptyMessage="Steam CS2 stats are private or unavailable for this profile."
            items={[
              { label: "K/D", value: formatDecimal(data.cs2?.kd) },
              { label: "HS%", value: formatPercent(data.cs2?.hsPercent) },
              { label: "Kills", value: formatNumber(data.cs2?.kills) },
              { label: "Win rate", value: formatPercent(data.cs2?.winRate) },
              { label: "Accuracy", value: formatPercent(data.cs2?.accuracy) },
              { label: "Wins", value: formatNumber(data.cs2?.wins) },
              {
                label: "Rounds",
                value: formatNumber(data.cs2?.roundsPlayed),
              },
              { label: "Deaths", value: formatNumber(data.cs2?.deaths) },
            ]}
          />

          <StatsGrid
            title="FACEIT stats"
            emptyMessage={
              faceit.player
                ? "FACEIT stats could not be loaded."
                : "No FACEIT CS2 profile linked to this Steam ID."
            }
            items={[
              {
                label: "ELO",
                value: formatNumber(
                  faceit.player?.elo ?? data.leetify?.faceitElo ?? null,
                ),
              },
              {
                label: "Level",
                value:
                  faceit.player?.skillLevel != null
                    ? String(faceit.player.skillLevel)
                    : data.leetify?.faceitLevel != null
                      ? String(data.leetify.faceitLevel)
                      : "—",
              },
              {
                label: "Matches",
                value: formatNumber(faceit.stats?.matches ?? null),
              },
              {
                label: "K/D",
                value: formatDecimal(faceit.stats?.kd ?? null),
              },
              {
                label: "HS%",
                value: formatPercent(faceit.stats?.hsPercent ?? null),
              },
              {
                label: "Win rate",
                value: formatPercent(faceit.stats?.winRate ?? null),
              },
              {
                label: "Wins",
                value: formatNumber(faceit.stats?.wins ?? null),
              },
              {
                label: "ADR",
                value: formatDecimal(faceit.stats?.averageAdr ?? null, 1),
              },
            ]}
            footer={
              faceit.player ? (
                <a
                  href={faceit.player.faceitUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--amber)] hover:underline"
                >
                  View FACEIT profile → {faceit.player.nickname}
                </a>
              ) : null
            }
          />
        </div>

        {last ? (
          <StatsGrid
            title="Steam last match"
            items={[
              { label: "K/D", value: formatDecimal(last.kd) },
              { label: "Kills", value: formatNumber(last.kills) },
              { label: "Deaths", value: formatNumber(last.deaths) },
              { label: "MVPs", value: formatNumber(last.mvps) },
              { label: "Damage", value: formatNumber(last.damage) },
              { label: "Rounds", value: formatNumber(last.rounds) },
              {
                label: "Score",
                value: formatNumber(last.contributionScore),
              },
              { label: "—", value: "—" },
            ]}
          />
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <MapStatsTable
            title="FACEIT stats by map"
            rows={faceitMapsToRows(faceit.maps)}
            emptyMessage="FACEIT map breakdown unavailable (needs FACEIT API key + linked profile)."
          />

          <MapStatsTable
            title="Steam map wins"
            rows={steamMapWinsToRows(data.cs2?.mapWins ?? [])}
            emptyMessage="Steam map win totals unavailable (private profile or no data)."
          />
        </div>

        <LeetifyMatchHistory matches={data.leetify?.recentMatches ?? []} />

        <MatchHistory matches={faceit.matches} />

        <LeetifyTeammatesPanel teammates={data.leetify?.teammates ?? []} />

        <TrackerSources
          sources={buildTrackerSources({
            steamId,
            hasSteamStats: Boolean(
              data.cs2 && !data.cs2.privateOrUnavailable,
            ),
            faceitConfigured: Boolean(process.env.FACEIT_API_KEY),
            faceitFound: Boolean(faceit.player),
            faceitUrl: faceit.player?.faceitUrl ?? null,
            leetifyFound: Boolean(data.leetify),
            leetifyUrl: data.leetify?.profileUrl ?? null,
            scopeFound: Boolean(data.scope),
            scopeUrl: data.scope?.profileUrl ?? null,
          })}
        />

        <ExternalLinks
          steamId={steamId}
          faceitUrl={faceit.player?.faceitUrl}
          scopeUrl={data.scope?.profileUrl}
        />

        {data.errors.length > 0 ? (
          <details className="border border-[var(--border)] bg-[var(--surface)] px-5 py-3 text-xs text-[var(--muted)]">
            <summary className="cursor-pointer text-[var(--foreground)]">
              Partial data warnings ({data.errors.length})
            </summary>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              {data.errors.map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          </details>
        ) : null}
      </main>
    </>
  );
}
