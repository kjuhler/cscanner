/** Tactical zone ids used for execute / site detection. */
export type TacticalZoneId = "a_site" | "b_site" | "mid" | "connector";

export type MapZone = {
  id: TacticalZoneId;
  label: string;
  /** World-space polygon vertices (X/Y only; Z ignored). */
  polygon: [number, number][];
};

export type MapZoneFile = {
  mapCode: string;
  zones: MapZone[];
};
