/**
 * Generate tactical zone JSON from radar calibration + per-map layout fractions.
 *
 * Usage:
 *   node scripts/extract-map-zones.mjs
 *
 * Optional: set CS2_GAME_PATH and use CS2CalloutExtractor for fine callouts (not required).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "src", "lib", "demo", "zones", "data");

/** Radar calibrations (mirrors src/lib/demo/radar.ts). */
const CALIBRATIONS = {
  de_ancient: { posX: -2953, posY: 2164, scale: 5 },
  de_anubis: { posX: -2796, posY: 3328, scale: 5.22 },
  de_cache: { posX: -2000, posY: 3250, scale: 5.5 },
  de_dust2: { posX: -2476, posY: 3239, scale: 4.4 },
  de_inferno: { posX: -2087, posY: 3870, scale: 4.9 },
  de_mirage: { posX: -3230, posY: 1713, scale: 5 },
  de_nuke: { posX: -3453, posY: 2887, scale: 7 },
  de_overpass: { posX: -4831, posY: 1781, scale: 5.2 },
  de_train: { posX: -2308, posY: 2078, scale: 4.082077 },
  de_vertigo: { posX: -3168, posY: 1762, scale: 4 },
};

const IMAGE_SIZE = 1024;

/**
 * Fractional radar regions per map (x0,x1,y0,y1 as 0–1 of radar image).
 * y0 = top of radar (high world Y), y1 = bottom.
 */
const LAYOUTS = {
  de_ancient: {
    a_site: [0.55, 0.92, 0.35, 0.75],
    b_site: [0.05, 0.42, 0.08, 0.45],
    mid: [0.35, 0.62, 0.35, 0.65],
    connector: [0.42, 0.58, 0.55, 0.72],
  },
  de_anubis: {
    a_site: [0.08, 0.42, 0.45, 0.78],
    b_site: [0.58, 0.92, 0.12, 0.48],
    mid: [0.38, 0.62, 0.42, 0.62],
    connector: [0.35, 0.55, 0.55, 0.72],
  },
  de_cache: {
    a_site: [0.55, 0.88, 0.55, 0.88],
    b_site: [0.08, 0.38, 0.08, 0.42],
    mid: [0.35, 0.58, 0.35, 0.58],
    connector: [0.42, 0.58, 0.48, 0.65],
  },
  de_dust2: {
    a_site: [0.62, 0.95, 0.42, 0.78],
    b_site: [0.05, 0.35, 0.08, 0.42],
    mid: [0.38, 0.58, 0.38, 0.55],
    connector: [0.48, 0.62, 0.52, 0.68],
  },
  de_inferno: {
    a_site: [0.05, 0.38, 0.52, 0.88],
    b_site: [0.58, 0.92, 0.08, 0.48],
    mid: [0.38, 0.58, 0.38, 0.55],
    connector: [0.35, 0.52, 0.48, 0.58],
  },
  de_mirage: {
    a_site: [0.05, 0.35, 0.45, 0.82],
    b_site: [0.62, 0.95, 0.08, 0.45],
    mid: [0.35, 0.58, 0.35, 0.52],
    connector: [0.42, 0.58, 0.48, 0.58],
  },
  de_nuke: {
    a_site: [0.08, 0.42, 0.55, 0.88],
    b_site: [0.55, 0.92, 0.05, 0.42],
    mid: [0.35, 0.58, 0.38, 0.55],
    connector: [0.42, 0.55, 0.45, 0.55],
  },
  de_overpass: {
    a_site: [0.62, 0.95, 0.45, 0.82],
    b_site: [0.05, 0.35, 0.08, 0.42],
    mid: [0.35, 0.58, 0.35, 0.52],
    connector: [0.48, 0.62, 0.52, 0.62],
  },
  de_train: {
    a_site: [0.05, 0.38, 0.45, 0.82],
    b_site: [0.58, 0.92, 0.08, 0.45],
    mid: [0.35, 0.58, 0.35, 0.52],
    connector: [0.42, 0.58, 0.48, 0.58],
  },
  de_vertigo: {
    a_site: [0.55, 0.92, 0.45, 0.82],
    b_site: [0.05, 0.38, 0.08, 0.42],
    mid: [0.35, 0.58, 0.35, 0.55],
    connector: [0.42, 0.58, 0.48, 0.65],
  },
};

const LABELS = {
  a_site: "A Site",
  b_site: "B Site",
  mid: "Mid",
  connector: "Connector",
};

function rectToPolygon(cal, [fx0, fx1, fy0, fy1]) {
  const minX = cal.posX + cal.scale * IMAGE_SIZE * fx0;
  const maxX = cal.posX + cal.scale * IMAGE_SIZE * fx1;
  const maxY = cal.posY - cal.scale * IMAGE_SIZE * fy0;
  const minY = cal.posY - cal.scale * IMAGE_SIZE * fy1;
  return [
    [minX, maxY],
    [maxX, maxY],
    [maxX, minY],
    [minX, minY],
  ];
}

mkdirSync(outDir, { recursive: true });

for (const [mapCode, cal] of Object.entries(CALIBRATIONS)) {
  const layout = LAYOUTS[mapCode];
  if (!layout) continue;

  const zones = Object.entries(layout).map(([id, frac]) => ({
    id,
    label: LABELS[id],
    polygon: rectToPolygon(cal, frac),
  }));

  const file = join(outDir, `${mapCode}.json`);
  writeFileSync(
    file,
    JSON.stringify({ mapCode, zones }, null, 2) + "\n",
    "utf8",
  );
  console.log(`Wrote ${file}`);
}

console.log("Done. Review polygons and adjust LAYOUTS in this script if needed.");
