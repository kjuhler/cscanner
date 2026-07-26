import { mapCode } from "@/lib/maps";

export type RadarCalibration = {
  posX: number;
  posY: number;
  scale: number;
  /** Radar image assumed 1024×1024. */
  imageSize: number;
  /** Local public path — always preferred. */
  radarUrl: string;
  radarUrlAlt: string;
  mapCode: string;
};

/** Official map overview calibrations (from Valve radar_info / MurkyYT extract). */
const CALIBRATIONS: Record<
  string,
  { posX: number; posY: number; scale: number; file: string }
> = {
  de_ancient: {
    posX: -2953,
    posY: 2164,
    scale: 5,
    file: "de_ancient_radar_psd.png",
  },
  de_anubis: {
    posX: -2796,
    posY: 3328,
    scale: 5.22,
    file: "de_anubis_radar_psd.png",
  },
  de_cache: {
    posX: -2000,
    posY: 3250,
    scale: 5.5,
    file: "de_cache_radar_psd.png",
  },
  de_dust2: {
    posX: -2476,
    posY: 3239,
    scale: 4.4,
    file: "de_dust2_radar_psd.png",
  },
  de_inferno: {
    posX: -2087,
    posY: 3870,
    scale: 4.9,
    file: "de_inferno_radar_psd.png",
  },
  de_mirage: {
    posX: -3230,
    posY: 1713,
    scale: 5,
    file: "de_mirage_radar_psd.png",
  },
  de_nuke: {
    posX: -3453,
    posY: 2887,
    scale: 7,
    file: "de_nuke_radar_psd.png",
  },
  de_overpass: {
    posX: -4831,
    posY: 1781,
    scale: 5.2,
    file: "de_overpass_radar_psd.png",
  },
  de_train: {
    posX: -2308,
    posY: 2078,
    scale: 4.082077,
    file: "de_train_radar_psd.png",
  },
  de_vertigo: {
    posX: -3168,
    posY: 1762,
    scale: 4,
    file: "de_vertigo_radar_psd.png",
  },
};

export function getRadarCalibration(
  mapName: string | null | undefined,
): RadarCalibration | null {
  const code = mapCode(mapName);
  if (!code) return null;
  const cal = CALIBRATIONS[code];
  if (!cal) return null;
  return {
    posX: cal.posX,
    posY: cal.posY,
    scale: cal.scale,
    imageSize: 1024,
    // Served from /public/radars — same origin, no CDN dependency.
    radarUrl: `/radars/${cal.file}`,
    radarUrlAlt: `https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/radars/${cal.file}`,
    mapCode: code,
  };
}

/** World → radar pixel (0…imageSize). Y inverted per Valve overview convention. */
export function worldToRadarPx(
  worldX: number,
  worldY: number,
  cal: RadarCalibration,
): { x: number; y: number } {
  return {
    x: (worldX - cal.posX) / cal.scale,
    y: (cal.posY - worldY) / cal.scale,
  };
}

/** World → CSS percent for absolute positioning on the radar image. */
export function worldToRadarPercent(
  worldX: number,
  worldY: number,
  cal: RadarCalibration,
): { left: number; top: number } {
  const { x, y } = worldToRadarPx(worldX, worldY, cal);
  return {
    left: (x / cal.imageSize) * 100,
    top: (y / cal.imageSize) * 100,
  };
}

/** Approximate horizontal distance in metres (CS units / 52 ≈ metres). */
export function distanceMeters(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.hypot(a.x - b.x, a.y - b.y) / 52;
}

/** CS2 smoke vision-block radius (hammer units). */
export const SMOKE_COVER_RADIUS = 144;
/** Approximate molotov/incendiary burn pool radius (hammer units). */
export const MOLLY_COVER_RADIUS = 115;

/** World-space radius → percent of the radar image (diameter = 2× this). */
export function worldRadiusToRadarPercent(
  worldRadius: number,
  cal: RadarCalibration,
): number {
  return (worldRadius / cal.scale / cal.imageSize) * 100;
}
