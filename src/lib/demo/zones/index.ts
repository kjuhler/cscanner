import { mapCode } from "@/lib/maps";
import { getRadarCalibration } from "@/lib/demo/radar";
import type { MapZone, MapZoneFile, TacticalZoneId } from "./types";

import deAncient from "./data/de_ancient.json";
import deAnubis from "./data/de_anubis.json";
import deCache from "./data/de_cache.json";
import deDust2 from "./data/de_dust2.json";
import deInferno from "./data/de_inferno.json";
import deMirage from "./data/de_mirage.json";
import deNuke from "./data/de_nuke.json";
import deOverpass from "./data/de_overpass.json";
import deTrain from "./data/de_train.json";
import deVertigo from "./data/de_vertigo.json";

const ZONE_FILES: Record<string, MapZoneFile> = {
  de_ancient: deAncient as MapZoneFile,
  de_anubis: deAnubis as MapZoneFile,
  de_cache: deCache as MapZoneFile,
  de_dust2: deDust2 as MapZoneFile,
  de_inferno: deInferno as MapZoneFile,
  de_mirage: deMirage as MapZoneFile,
  de_nuke: deNuke as MapZoneFile,
  de_overpass: deOverpass as MapZoneFile,
  de_train: deTrain as MapZoneFile,
  de_vertigo: deVertigo as MapZoneFile,
};

export type ZoneMatch = {
  id: TacticalZoneId;
  label: string;
};

/** Point-in-polygon (ray casting) for world X/Y. */
export function pointInPolygon(
  x: number,
  y: number,
  polygon: [number, number][],
): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]!;
    const [xj, yj] = polygon[j]!;
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function zonesForMap(mapName: string | null | undefined): MapZone[] {
  const code = mapCode(mapName);
  if (!code) return [];
  return ZONE_FILES[code]?.zones ?? [];
}

/** Return the first tactical zone containing world (x, y), or null. */
export function zoneAt(
  mapName: string | null | undefined,
  x: number,
  y: number,
): ZoneMatch | null {
  const zones = zonesForMap(mapName);
  for (const zone of zones) {
    if (pointInPolygon(x, y, zone.polygon)) {
      return { id: zone.id, label: zone.label };
    }
  }
  return null;
}

/** Centroid of a zone polygon (world coords). */
export function zoneCentroid(zone: MapZone): { x: number; y: number } {
  if (zone.polygon.length === 0) return { x: 0, y: 0 };
  let sx = 0;
  let sy = 0;
  for (const [px, py] of zone.polygon) {
    sx += px;
    sy += py;
  }
  return { x: sx / zone.polygon.length, y: sy / zone.polygon.length };
}

/** Distance from point to zone centroid (world units). */
export function distanceToZone(
  x: number,
  y: number,
  zone: MapZone,
): number {
  const c = zoneCentroid(zone);
  return Math.hypot(x - c.x, y - c.y);
}

export function isSiteZone(id: TacticalZoneId): boolean {
  return id === "a_site" || id === "b_site";
}

export { getRadarCalibration };
export type { MapZone, MapZoneFile, TacticalZoneId } from "./types";
