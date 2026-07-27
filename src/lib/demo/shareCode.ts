import {
  decodeMatchShareCode,
  InvalidShareCode,
  type MatchInformation,
} from "csgo-sharecode";

/** Canonical CS2 / CS:GO match sharing code shape. */
const SHARE_CODE_RE =
  /^CSGO(-[A-Za-z0-9]{5}){5}$/;

export type DecodedShareCode = {
  matchId: string;
  outcomeId: string;
  token: number;
  normalized: string;
};

/**
 * Strip whitespace / steam:// wrappers and uppercase the CSGO- prefix form.
 */
export function normalizeShareCode(raw: string): string {
  let s = raw.trim();
  try {
    s = decodeURIComponent(s);
  } catch {
    // Keep raw input if decoding fails.
  }
  // Supports plain CSGO-... or full steam://...+csgo_download_match%20CSGO-...
  const extracted = s.match(/CSGO(-[A-Za-z0-9]{5}){5}/i);
  if (extracted) s = extracted[0];
  s = s.replace(/\s+/g, "");
  if (s.toUpperCase().startsWith("CSGO-")) {
    return "CSGO-" + s.slice(5);
  }
  return s;
}

export function isValidShareCodeFormat(raw: string): boolean {
  try {
    return SHARE_CODE_RE.test(normalizeShareCode(raw));
  } catch {
    return false;
  }
}

/**
 * Validate + decode a match share code into GC request fields.
 * `outcomeId` = reservationId; `token` = tvPort (Valve naming).
 */
export function decodeShareCode(raw: string): DecodedShareCode {
  const normalized = normalizeShareCode(raw);
  if (!SHARE_CODE_RE.test(normalized)) {
    throw new Error(
      "Invalid match sharing code. Expected CSGO-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX.",
    );
  }
  let info: MatchInformation;
  try {
    info = decodeMatchShareCode(normalized);
  } catch (err) {
    if (err instanceof InvalidShareCode) {
      throw new Error(
        "Invalid match sharing code. Expected CSGO-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX.",
      );
    }
    throw err;
  }
  return {
    matchId: info.matchId.toString(),
    outcomeId: info.reservationId.toString(),
    token: info.tvPort,
    normalized,
  };
}

/** True when the web/API should advertise share-code fetch (worker has GC creds). */
export function isSteamGcEnabled(): boolean {
  const flag = process.env.STEAM_GC_ENABLED?.trim().toLowerCase();
  if (flag === "1" || flag === "true" || flag === "yes") return true;
  if (flag === "0" || flag === "false" || flag === "no") return false;
  // Fallback: refresh token present (local .env shared by web+worker).
  return Boolean(process.env.STEAM_REFRESH_TOKEN?.trim());
}
