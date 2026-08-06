import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BannedFriendsPanel } from "@/components/BannedFriendsPanel";
import { BansPanel } from "@/components/BansPanel";
import { CompetitiveRanksPanel } from "@/components/CompetitiveRanksPanel";
import { CsrepPanel } from "@/components/CsrepPanel";
import { CsstatPanel } from "@/components/CsstatPanel";
import { ExternalLinks } from "@/components/ExternalLinks";
import {
  MapStatsTable,
  faceitMapsToRows,
  steamMapWinsToRows,
} from "@/components/MapStatsTable";
import { LeetifyMapsPanel } from "@/components/LeetifyMapsPanel";
import { LeetifyMatchHistory } from "@/components/LeetifyMatchHistory";
import { LeetifyTeammatesPanel } from "@/components/LeetifyTeammatesPanel";
import { PlayerHeader, type ProfileTab } from "@/components/PlayerHeader";
import { PremierPanel } from "@/components/PremierPanel";
import { SeasonRanksPanel } from "@/components/SeasonRanksPanel";
import { SiteHeader } from "@/components/SiteHeader";
import { SourcesBreakdownPanel } from "@/components/SourcesBreakdownPanel";
import { StatsGrid } from "@/components/StatsGrid";
import { StatsOverviewGrid } from "@/components/StatsOverviewGrid";
import { TrackerSources } from "@/components/TrackerSources";
import { TrustScorePanel } from "@/components/TrustScorePanel";
import {
  formatDecimal,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import { aggregatePlayer } from "@/lib/player/aggregate";
import { compositeTrustScore } from "@/lib/player/composite";
import { isCsapiConfigured } from "@/lib/csapi";
import { isCsrepConfigured } from "@/lib/csrep";
import { isFaceitConfigured } from "@/lib/faceit";
import { buildTrackerSources } from "@/lib/sources";
import { isSteamId64 } from "@/lib/steam";

type PageProps = {
  params: Promise<{ steamId: string }>;
  searchParams: Promise<{ tab?: string }>;
};


export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { steamId } = await params;
  return {
    title: steamId,
    description: `CS2 trust score and stats for Steam ID ${steamId}`,
  };
}

export default async function ProfilePage({ params, searchParams }: PageProps) {
  const { steamId } = await params;
  const resolvedSearchParams = await searchParams;

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
  const rowByMatchId = new Map(
    (data.leetifyMatchRows ?? [])
      .filter((r) => r.matchId)
      .map((r) => [r.matchId as string, r]),
  );
  const leetifyMatchesForHistory = (data.leetify?.recentMatches ?? []).map((m) => {
    const row = rowByMatchId.get(m.id);
    if (!row) return m;
    return {
      ...m,
      kills: m.kills ?? row.kills,
      deaths: m.deaths ?? row.deaths,
      kd: m.kd ?? (row.deaths > 0 ? Math.round((row.kills / row.deaths) * 100) / 100 : row.kills),
    };
  });
  const tabParam = resolvedSearchParams.tab;
  const activeTab: ProfileTab =
    tabParam === "matches" ||
    tabParam === "maps" ||
    tabParam === "weapons" ||
    tabParam === "banned-friends" ||
    tabParam === "inventory" ||
    tabParam === "sources"
      ? tabParam
      : "overview";

  const headlineTrust = compositeTrustScore(data.composite, data.trust);
  const csrepConfigured = isCsrepConfigured();
  const csapiConfigured = isCsapiConfigured();

  return (
    <>
      <SiteHeader showSearch />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-8">
        <PlayerHeader
          steam={data.steam}
          extras={data.steamExtras}
          activeTab={activeTab}
          premierRating={data.leetify?.premier ?? data.leetify?.premierRecent ?? null}
          faceitLevel={faceit.player?.skillLevel ?? data.leetify?.faceitLevel ?? null}
          faceitElo={faceit.player?.elo ?? data.leetify?.faceitElo ?? null}
        />

        {activeTab === "overview" ? (
          <>
            <section className="border border-[var(--border)] bg-[var(--surface)]">
              <div className="grid lg:grid-cols-[minmax(14rem,18rem)_1fr] lg:items-start lg:divide-x lg:divide-[var(--border)]">
                <TrustScorePanel
                  trust={data.trust}
                  bans={data.bans}
                  displayScore={headlineTrust}
                  embedded
                />
                <StatsOverviewGrid
                  csapi={data.csapi}
                  leetify={data.leetify}
                  leetifyMatchRows={data.leetifyMatchRows}
                  faceitPlayer={faceit.player}
                  faceitStats={faceit.stats}
                  cs2={data.cs2}
                  playtimeHours={data.steamExtras.cs2PlaytimeHours}
                  bannedFriends={data.bans.friends}
                  embedded
                />
              </div>
            </section>

            <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
              <SeasonRanksPanel
                cs2={data.leetify?.seasonRanksCs2 ?? []}
                csgo={data.leetify?.csgoRanks ?? null}
              />
              <CompetitiveRanksPanel ranks={data.leetify?.competitive ?? []} />
            </div>

            <BansPanel bans={data.bans} />

            <CsstatPanel csstat={data.csstat} />

            <CsrepPanel csrep={data.csrep} configured={csrepConfigured} />

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

            <LeetifyTeammatesPanel teammates={data.leetify?.teammates ?? []} />
          </>
        ) : null}

        {activeTab === "matches" ? (
          <section className="space-y-4">
            <LeetifyMatchHistory
              matches={leetifyMatchesForHistory}
              steamId={steamId}
              faceitLevel={faceit.player?.skillLevel ?? data.leetify?.faceitLevel ?? null}
            />
          </section>
        ) : null}

        {activeTab === "maps" ? (
          <section className="space-y-4">
            <CompetitiveRanksPanel ranks={data.leetify?.competitive ?? []} />
            <LeetifyMapsPanel maps={data.leetify?.mapStats ?? []} />
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
          </section>
        ) : null}

        {activeTab === "weapons" ? (
          <PremierPanel
            steamId={steamId}
            leetify={data.leetify}
            faceitPlayer={faceit.player}
            kd={data.cs2?.kd ?? faceit.stats?.kd ?? null}
          />
        ) : null}

        {activeTab === "sources" ? (
          <section className="space-y-4">
            <TrackerSources
              sources={buildTrackerSources({
                steamId,
                hasSteamStats: Boolean(
                  data.cs2 && !data.cs2.privateOrUnavailable,
                ),
                faceitConfigured: isFaceitConfigured(),
                faceitFound: Boolean(faceit.player),
                faceitUrl: faceit.player?.faceitUrl ?? null,
                leetifyFound: Boolean(data.leetify),
                leetifyUrl: data.leetify?.profileUrl ?? null,
                scopeFound: Boolean(data.scope),
                scopeUrl: data.scope?.profileUrl ?? null,
                csstatFound: Boolean(data.csstat),
                csstatUrl: data.csstat?.profileUrl ?? null,
                csapiFound: Boolean(data.csapi),
                csapiUrl: data.csapi?.profileUrl ?? null,
                csapiConfigured,
                csrepConfigured,
                csrepFound: Boolean(data.csrep),
                csrepUrl: data.csrep?.profileUrl ?? null,
              })}
            />
            <SourcesBreakdownPanel data={data} csrepConfigured={csrepConfigured} />
          </section>
        ) : null}

        {activeTab === "inventory" ? (
          <section className="space-y-4">
            <TrackerSources
              sources={buildTrackerSources({
                steamId,
                hasSteamStats: Boolean(
                  data.cs2 && !data.cs2.privateOrUnavailable,
                ),
                faceitConfigured: isFaceitConfigured(),
                faceitFound: Boolean(faceit.player),
                faceitUrl: faceit.player?.faceitUrl ?? null,
                leetifyFound: Boolean(data.leetify),
                leetifyUrl: data.leetify?.profileUrl ?? null,
                scopeFound: Boolean(data.scope),
                scopeUrl: data.scope?.profileUrl ?? null,
                csstatFound: Boolean(data.csstat),
                csstatUrl: data.csstat?.profileUrl ?? null,
                csapiFound: Boolean(data.csapi),
                csapiUrl: data.csapi?.profileUrl ?? null,
                csapiConfigured,
                csrepConfigured,
                csrepFound: Boolean(data.csrep),
                csrepUrl: data.csrep?.profileUrl ?? null,
              })}
            />
            <ExternalLinks
              steamId={steamId}
              faceitUrl={faceit.player?.faceitUrl}
              scopeUrl={data.scope?.profileUrl}
            />
          </section>
        ) : null}

        {activeTab === "banned-friends" ? (
          <section className="space-y-4">
            <BannedFriendsPanel friends={data.bans.friends} />
          </section>
        ) : null}

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
