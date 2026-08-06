import * as cheerio from "cheerio";
import type {
  CsstatFaceitSection,
  CsstatGameCoordinatorSection,
  CsstatLeetifySection,
  CsstatProfile,
  CsstatSignal,
  CsstatStat,
  CsstatSteamSection,
} from "@/lib/types";

const CSSTAT_ORIGIN = "https://csst.at";
const FRAGMENT_TIMEOUT_MS = 10_000;

const FRAGMENTS = [
  "steam",
  "faceit",
  "leetify",
  "leetify-extra",
  "game-coordinator",
] as const;

type FragmentId = (typeof FRAGMENTS)[number];

function profileUrl(steamId64: string): string {
  return `${CSSTAT_ORIGIN}/profile/${steamId64}`;
}

function fragmentHeaders(steamId64: string): HeadersInit {
  return {
    Accept: "text/html,*/*",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "HX-Request": "true",
    "HX-Current-URL": profileUrl(steamId64),
    Referer: profileUrl(steamId64),
    Origin: CSSTAT_ORIGIN,
  };
}

function isCloudflareChallenge(html: string): boolean {
  const lower = html.toLowerCase();
  return (
    lower.includes("just a moment") ||
    lower.includes("cf-challenge") ||
    lower.includes("performing security verification") ||
    lower.includes("enable javascript and cookies to continue")
  );
}

function parseNumber(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const cleaned = raw
    .replace(/,/g, "")
    .replace(/[^\d.+-]/g, "")
    .trim();
  if (!cleaned || cleaned === "+" || cleaned === "-" || cleaned === ".") {
    return null;
  }
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseHours(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const match = raw.replace(/,/g, "").match(/([\d.]+)\s*h/i);
  if (match) return parseNumber(match[1] ?? null);
  return parseNumber(raw);
}

function parsePercent(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const match = raw.replace(/,/g, "").match(/([\d.]+)\s*%/);
  if (match) return parseNumber(match[1] ?? null);
  return parseNumber(raw);
}

function signalFromClass(className: string): CsstatSignal {
  if (/\btext-red-500\b/.test(className) || /\btext-red-400\b/.test(className)) {
    return "high";
  }
  if (
    /\btext-orange-500\b/.test(className) ||
    /\btext-orange-400\b/.test(className) ||
    /\btext-amber-500\b/.test(className)
  ) {
    return "elevated";
  }
  if (/\btext-white\b/.test(className) || /\btext-gray/.test(className)) {
    return "normal";
  }
  return null;
}

function normalizeLabel(label: string): string {
  return label
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .replace(/[.:]+$/, "");
}

type LabeledValue = {
  raw: string;
  signal: CsstatSignal;
};

function collectLabeledValues(html: string): Map<string, LabeledValue> {
  const $ = cheerio.load(html);
  const out = new Map<string, LabeledValue>();

  $("p.text-xs, span.text-xs, .text-xs").each((_, el) => {
    const label = normalizeLabel($(el).text());
    if (!label || label.length > 32) return;

    const parent = $(el).parent();
    let raw: string | null = null;
    let signal: CsstatSignal = null;

    parent.find("p, span, button, a").each((__, child) => {
      if (child === el) return;
      const text = $(child).text().replace(/\s+/g, " ").trim();
      if (!text || text === "/" || text === "?" || text === "—") return;
      if (normalizeLabel(text) === label) return;
      const cls = $(child).attr("class") ?? "";
      const childSignal = signalFromClass(cls);
      if (raw == null) {
        raw = text;
        signal = childSignal;
      } else if (childSignal && !signal) {
        signal = childSignal;
      }
    });

    if (raw == null) {
      const siblings = $(el).nextAll().first().text().replace(/\s+/g, " ").trim();
      if (siblings) raw = siblings;
    }

    if (raw) {
      out.set(label, { raw, signal });
    }
  });

  return out;
}

function toStat(entry: LabeledValue | undefined): CsstatStat | null {
  if (!entry) return null;
  return {
    value: parseNumber(entry.raw),
    raw: entry.raw,
    signal: entry.signal,
  };
}

function pick(
  map: Map<string, LabeledValue>,
  ...labels: string[]
): LabeledValue | undefined {
  for (const label of labels) {
    const hit = map.get(normalizeLabel(label));
    if (hit) return hit;
  }
  return undefined;
}

async function fetchFragment(
  steamId64: string,
  fragment: FragmentId,
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FRAGMENT_TIMEOUT_MS);
  try {
    const res = await fetch(`${CSSTAT_ORIGIN}/${steamId64}/${fragment}`, {
      headers: fragmentHeaders(steamId64),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const html = await res.text();
    if (!html || isCloudflareChallenge(html)) return null;
    return html;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function parseSteam(html: string): CsstatSteamSection | null {
  const $ = cheerio.load(html);
  const labels = collectLabeledValues(html);

  const name =
    $("a[href*='steamcommunity.com']")
      .first()
      .text()
      .replace(/\s+/g, " ")
      .trim() || null;

  const friendCode = pick(labels, "CS FRIENDCODE", "FRIENDCODE")?.raw ?? null;
  const registered = pick(labels, "REGISTERED")?.raw ?? null;
  const country = pick(labels, "COUNTRY")?.raw ?? null;
  const games = parseNumber(pick(labels, "GAMES")?.raw);
  const playtimeHours = parseHours(pick(labels, "PLAYTIME")?.raw);
  const cs2PlaytimeHours = parseHours(
    pick(labels, "CS2 PLAYTIME", "CS2 PLAY TIME")?.raw,
  );
  const inventoryValue = pick(labels, "INVENTORY VALUE")?.raw ?? null;

  if (
    !name &&
    !friendCode &&
    games == null &&
    playtimeHours == null &&
    cs2PlaytimeHours == null
  ) {
    return null;
  }

  return {
    name,
    friendCode,
    registered,
    country,
    games,
    playtimeHours,
    cs2PlaytimeHours,
    inventoryValue,
  };
}

function parseFaceit(html: string): CsstatFaceitSection | null {
  const $ = cheerio.load(html);
  const labels = collectLabeledValues(html);
  const text = $.root().text().replace(/\s+/g, " ");

  const banMatch = text.match(/Banned for\s+([^\n]+?)(?:\s+\w{3}\s+\d{1,2},?\s+\d{4})?/i);
  const banReason = banMatch?.[1]?.trim() ?? null;
  const banDateMatch = text.match(
    /Banned for[^.]*?((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4})/i,
  );

  const profileLink = $("a[href*='faceit.com']")
    .filter((_, el) => {
      const href = $(el).attr("href") ?? "";
      return /faceit\.com\/(?:en\/)?players\//i.test(href);
    })
    .first();
  const nickname =
    profileLink.text().replace(/\s+/g, " ").trim() ||
    $("a[href*='faceit.com/en/players']").first().text().trim() ||
    null;
  const profileUrl = profileLink.attr("href") ?? null;

  const levelImg = $("img[src*='faceit_levels']").attr("src") ?? "";
  const levelMatch = levelImg.match(/faceit_levels\/(\d+)/i);

  const section: CsstatFaceitSection = {
    nickname,
    profileUrl,
    banReason,
    banDate: banDateMatch?.[1] ?? null,
    registered: pick(labels, "REGISTERED")?.raw ?? null,
    country: pick(labels, "COUNTRY")?.raw ?? null,
    elo: parseNumber(pick(labels, "ELO")?.raw),
    peakElo: parseNumber(pick(labels, "PEAK ELO")?.raw),
    skillLevel: levelMatch ? parseNumber(levelMatch[1] ?? null) : null,
    winRate: parsePercent(pick(labels, "WINRATE", "WIN RATE")?.raw),
    matches: parseNumber(pick(labels, "MATCHES")?.raw),
    hsPercent: parsePercent(pick(labels, "HS%", "HS")?.raw),
    kd: parseNumber(pick(labels, "KD", "K/D")?.raw),
  };

  if (
    !section.nickname &&
    section.elo == null &&
    section.matches == null &&
    !section.banReason
  ) {
    return null;
  }

  return section;
}

function parseLeetify(html: string): CsstatLeetifySection | null {
  const labels = collectLabeledValues(html);

  const section: CsstatLeetifySection = {
    aim: toStat(pick(labels, "AIM")),
    utility: toStat(pick(labels, "UTILITY")),
    positioning: toStat(pick(labels, "POSITION", "POSITIONING")),
    clutch: toStat(pick(labels, "CLUTCH")),
    opening: toStat(pick(labels, "OPENING")),
    kd: toStat(pick(labels, "KD", "K/D")),
    rating: toStat(pick(labels, "RATING")),
    preaim: toStat(pick(labels, "PREAIM")),
    timeToDamageMs: (() => {
      const entry = pick(labels, "TIME TO DMG", "TIME TO DAMAGE", "TTD");
      if (!entry) return null;
      return {
        value: parseNumber(entry.raw),
        raw: entry.raw,
        signal: entry.signal,
      };
    })(),
    avgHeDamage: toStat(pick(labels, "AVG HE DMG", "AVG HE DAMAGE")),
    peakRating: toStat(pick(labels, "PEAK RATING")),
    winRate: (() => {
      const entry = pick(labels, "WINRATE", "WIN RATE");
      if (!entry) return null;
      return {
        value: parsePercent(entry.raw),
        raw: entry.raw,
        signal: entry.signal,
      };
    })(),
    matches: parseNumber(pick(labels, "MATCHES")?.raw),
    bannedMatesPercent: parsePercent(
      pick(labels, "BANNED MATES", "BANNED TEAMMATES")?.raw,
    ),
  };

  const hasAny = Object.values(section).some((v) => {
    if (v == null) return false;
    if (typeof v === "number") return true;
    return v.value != null || v.raw != null;
  });

  return hasAny ? section : null;
}

function parseLeetifyExtra(html: string): CsstatProfile["leetifyExtra"] {
  const labels = collectLabeledValues(html);
  const kd = parseNumber(pick(labels, "KD", "K/D")?.raw);
  const bannedMatesPercent = parsePercent(
    pick(labels, "BANNED MATES", "BANNED TEAMMATES")?.raw,
  );
  const winRate = parsePercent(pick(labels, "WINRATE", "WIN RATE")?.raw);

  if (kd == null && bannedMatesPercent == null && winRate == null) {
    return null;
  }

  return { kd, bannedMatesPercent, winRate };
}

function parseGameCoordinator(
  html: string,
): CsstatGameCoordinatorSection | null {
  const $ = cheerio.load(html);
  const labels = collectLabeledValues(html);

  const xpLevel = parseNumber(pick(labels, "XP LEVEL", "XP")?.raw);
  const commendationsTotal = parseNumber(
    pick(labels, "COMMENDATIONS")?.raw,
  );

  let friendly: number | null = null;
  let leader: number | null = null;
  let teacher: number | null = null;

  $("img[src*='commendations']").each((_, img) => {
    const src = $(img).attr("src") ?? "";
    const alt = ($(img).attr("alt") ?? "").toLowerCase();
    const nearby = $(img)
      .parent()
      .text()
      .replace(/\s+/g, " ")
      .trim();
    const value = parseNumber(nearby);
    if (value == null) return;
    if (src.includes("smile") || alt.includes("friendly")) friendly = value;
    else if (src.includes("leader") || alt.includes("leader")) leader = value;
    else if (src.includes("teacher") || alt.includes("teacher")) teacher = value;
  });

  if (
    xpLevel == null &&
    commendationsTotal == null &&
    friendly == null &&
    leader == null &&
    teacher == null
  ) {
    return null;
  }

  return {
    xpLevel,
    commendationsTotal,
    friendly,
    leader,
    teacher,
  };
}

/**
 * Fetch csst.at HTMX profile fragments and parse Steam / FACEIT / Leetify / GC
 * sections. Soft-fails to null when Cloudflare blocks or no data is present.
 */
export async function getCsstatProfile(
  steamId64: string,
): Promise<CsstatProfile | null> {
  const id = steamId64.trim();
  if (!/^\d{17}$/.test(id)) return null;

  const results = await Promise.all(
    FRAGMENTS.map(async (fragment) => {
      const html = await fetchFragment(id, fragment);
      return [fragment, html] as const;
    }),
  );

  const byId = Object.fromEntries(results) as Record<
    FragmentId,
    string | null
  >;

  const steam = byId.steam ? parseSteam(byId.steam) : null;
  const faceit = byId.faceit ? parseFaceit(byId.faceit) : null;
  const leetify = byId.leetify ? parseLeetify(byId.leetify) : null;
  const leetifyExtra = byId["leetify-extra"]
    ? parseLeetifyExtra(byId["leetify-extra"])
    : null;
  const gameCoordinator = byId["game-coordinator"]
    ? parseGameCoordinator(byId["game-coordinator"])
    : null;

  if (
    !steam &&
    !faceit &&
    !leetify &&
    !leetifyExtra &&
    !gameCoordinator
  ) {
    return null;
  }

  return {
    profileUrl: profileUrl(id),
    steam,
    faceit,
    leetify,
    leetifyExtra,
    gameCoordinator,
    filledFields: [],
  };
}
