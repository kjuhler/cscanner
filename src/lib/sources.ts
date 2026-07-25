import { steamId64ToAccountId } from "@/lib/scope";

export type TrackerSourceStatus = "live" | "empty" | "link" | "needs_key";

export type TrackerSource = {
  id: string;
  name: string;
  status: TrackerSourceStatus;
  detail: string;
  href: string | null;
};

type BuildArgs = {
  steamId: string;
  hasSteamStats: boolean;
  faceitConfigured: boolean;
  faceitFound: boolean;
  faceitUrl: string | null;
  leetifyFound: boolean;
  leetifyUrl: string | null;
  scopeFound: boolean;
  scopeUrl: string | null;
};

function scopeProfileHref(steamId64: string, scopeUrl: string | null): string {
  if (scopeUrl) return scopeUrl;
  const accountId = steamId64ToAccountId(steamId64);
  return accountId != null
    ? `https://app.scope.gg/profile/${accountId}`
    : `https://app.scope.gg/`;
}

export function buildTrackerSources(args: BuildArgs): TrackerSource[] {
  return [
    {
      id: "steam",
      name: "Steam",
      status: args.hasSteamStats ? "live" : "empty",
      detail: args.hasSteamStats
        ? "Lifetime K/D, HS%, last match, map wins"
        : "Profile private or no CS2 stats",
      href: `https://steamcommunity.com/profiles/${args.steamId}`,
    },
    {
      id: "faceit",
      name: "FACEIT",
      status: !args.faceitConfigured
        ? "needs_key"
        : args.faceitFound
          ? "live"
          : "empty",
      detail: !args.faceitConfigured
        ? "Add FACEIT_API_KEY to load ELO, HS%, matches"
        : args.faceitFound
          ? "ELO, K/D, HS%, win rate, map stats, recent matches"
          : "No FACEIT CS2 profile linked",
      href:
        args.faceitUrl ||
        `https://www.faceit.com/en/search/players/${args.steamId}`,
    },
    {
      id: "leetify",
      name: "Leetify",
      status: args.leetifyFound ? "live" : "empty",
      detail: args.leetifyFound
        ? "Premier, aim/utility ratings, recent form"
        : "No Leetify website or API profile found",
      href:
        args.leetifyUrl ||
        `https://leetify.com/app/profile/${args.steamId}`,
    },
    {
      id: "csstats",
      name: "CSStats",
      status: "link",
      detail: "No public API — open their MM/demo-based tracker",
      href: `https://csstats.gg/player/${args.steamId}`,
    },
    {
      id: "scope",
      name: "Scope.gg",
      status: args.scopeFound ? "live" : "empty",
      detail: args.scopeFound
        ? "Aim fallback: time to damage, HS%, spotted accuracy"
        : "No Scope ratings found for this Steam ID",
      href: scopeProfileHref(args.steamId, args.scopeUrl),
    },
  ];
}
