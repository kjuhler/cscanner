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
  csstatFound: boolean;
  csstatUrl: string | null;
  csapiFound: boolean;
  csapiUrl: string | null;
  csapiConfigured: boolean;
  csrepConfigured: boolean;
  csrepFound: boolean;
  csrepUrl: string | null;
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
        ? "Add FACEIT_API_KEY or API_PROXY_* to load ELO, HS%, matches"
        : args.faceitFound
          ? "ELO, K/D, HS%, win rate, map stats, recent matches"
          : "No FACEIT CS2 profile linked",
      href:
        args.faceitUrl ||
        `https://www.faceit.com/en/search/players/${args.steamId}`,
    },
    {
      id: "csapi",
      name: "csapi",
      status: !args.csapiConfigured
        ? "needs_key"
        : args.csapiFound
          ? "live"
          : "empty",
      detail: !args.csapiConfigured
        ? "Add CSAPI_API_KEY to load TTD / preaim / K/D window"
        : args.csapiFound
          ? "TTD, reaction, preaim, K/D, ADR, HLTV, KAST"
          : "No csapi.kju.dk stats for this Steam ID",
      href: args.csapiUrl || `https://csapi.kju.dk/${args.steamId}`,
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
      id: "csstat",
      name: "csst.at",
      status: args.csstatFound ? "live" : "empty",
      detail: args.csstatFound
        ? "Steam / FACEIT / Leetify / GC snapshot via HTMX fragments"
        : "No csst.at fragments available (Cloudflare or empty profile)",
      href:
        args.csstatUrl || `https://csst.at/profile/${args.steamId}`,
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
    {
      id: "csrep",
      name: "CSRep",
      status: !args.csrepConfigured
        ? "needs_key"
        : args.csrepFound
          ? "live"
          : "empty",
      detail: !args.csrepConfigured
        ? "Add CSREP_API_KEY or API proxy to load trust + stats window"
        : args.csrepFound
          ? "Trust rating, SBA metrics, match stats window"
          : "No CSRep profile returned",
      href: args.csrepUrl || `https://csrep.gg/player/${args.steamId}`,
    },
  ];
}
