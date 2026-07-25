const MAP_CODES: Record<string, string> = {
  dust2: "de_dust2",
  "dust 2": "de_dust2",
  dustii: "de_dust2",
  mirage: "de_mirage",
  inferno: "de_inferno",
  nuke: "de_nuke",
  overpass: "de_overpass",
  vertigo: "de_vertigo",
  ancient: "de_ancient",
  anubis: "de_anubis",
  train: "de_train",
  cache: "de_cache",
  cobble: "de_cbble",
  cobblestone: "de_cbble",
  cbble: "de_cbble",
  italy: "cs_italy",
  office: "cs_office",
  agency: "cs_agency",
  assault: "cs_assault",
  militia: "cs_militia",
  alpine: "cs_alpine",
  shelter: "cs_shelter",
  jura: "de_jura",
  basalt: "de_basalt",
  edin: "de_edin",
  palacio: "de_palacio",
  thera: "de_thera",
  mills: "de_mills",
  brewery: "de_brewery",
  dogtown: "de_dogtown",
  grail: "de_grail",
  blackgold: "de_blackgold",
};

const DISPLAY_NAMES: Record<string, string> = {
  de_dust2: "Dust II",
  de_mirage: "Mirage",
  de_inferno: "Inferno",
  de_nuke: "Nuke",
  de_overpass: "Overpass",
  de_vertigo: "Vertigo",
  de_ancient: "Ancient",
  de_anubis: "Anubis",
  de_train: "Train",
  de_cache: "Cache",
  de_cbble: "Cobblestone",
  cs_italy: "Italy",
  cs_office: "Office",
  cs_agency: "Agency",
  cs_assault: "Assault",
  cs_militia: "Militia",
  cs_alpine: "Alpine",
  cs_shelter: "Shelter",
  de_jura: "Jura",
  de_basalt: "Basalt",
  de_edin: "Edin",
  de_palacio: "Palacio",
  de_thera: "Thera",
  de_mills: "Mills",
  de_brewery: "Brewery",
  de_dogtown: "Dogtown",
  de_grail: "Grail",
  de_blackgold: "Black Gold",
};

const ICON_BASE =
  "https://cdn.jsdelivr.net/gh/MurkyYT/cs2-map-icons@main/images";

function normalizeKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\.bsp$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Resolve a FACEIT/Leetify/Steam map label to Valve map code (e.g. de_mirage). */
export function mapCode(name: string | null | undefined): string | null {
  if (!name) return null;
  const key = normalizeKey(name);
  if (!key || key === "unknown" || key === "unknown map") return null;

  const compact = key.replace(/\s+/g, "");
  if (MAP_CODES[key]) return MAP_CODES[key];
  if (MAP_CODES[compact]) return MAP_CODES[compact];

  if (/^(de|cs|ar|gd)_/.test(compact)) return compact;
  if (MAP_CODES[compact.replace(/^(de|cs)/, "")]) {
    return MAP_CODES[compact.replace(/^(de|cs)/, "")];
  }

  return `de_${compact}`;
}

export function mapDisplayName(name: string | null | undefined): string {
  if (!name) return "Unknown";
  const code = mapCode(name);
  if (code && DISPLAY_NAMES[code]) return DISPLAY_NAMES[code];
  const cleaned = name.replace(/^de_|^cs_/i, "").trim();
  if (!cleaned) return "Unknown";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function mapIconUrl(name: string | null | undefined): string | null {
  const code = mapCode(name);
  if (!code) return null;
  return `${ICON_BASE}/${code}.png`;
}
