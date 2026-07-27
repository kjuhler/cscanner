import type { DemoEventRow } from "./types";

export function str(row: DemoEventRow, ...keys: string[]): string {
  for (const key of keys) {
    const v = row[key];
    if (v !== undefined && v !== null && String(v).length > 0) {
      return String(v);
    }
  }
  return "";
}

export function num(row: DemoEventRow, ...keys: string[]): number {
  for (const key of keys) {
    const v = row[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "boolean") return v ? 1 : 0;
    if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) {
      return Number(v);
    }
  }
  return 0;
}

/** Alive flag may be 0/1 or boolean depending on demoparser field. */
export function isAliveValue(row: DemoEventRow): boolean {
  for (const key of ["is_alive", "alive"] as const) {
    const v = row[key];
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v !== 0;
    if (typeof v === "string") {
      const s = v.toLowerCase();
      if (s === "true" || s === "1") return true;
      if (s === "false" || s === "0") return false;
    }
  }
  return true;
}

export function steamIdOf(
  row: DemoEventRow,
  role: "attacker" | "user" | "assister" | "thrower" = "user",
): string {
  if (role === "attacker") {
    return str(
      row,
      "attacker_steamid",
      "attacker_steam_id",
      "attackerSteamid",
    );
  }
  if (role === "assister") {
    return str(
      row,
      "assister_steamid",
      "assister_steam_id",
      "assisterSteamid",
    );
  }
  if (role === "thrower") {
    return str(row, "thrower_steamid", "user_steamid", "steamid");
  }
  return str(row, "user_steamid", "steamid", "player_steamid");
}

export function nameOf(
  row: DemoEventRow,
  role: "attacker" | "user" | "assister" | "thrower" = "user",
): string {
  if (role === "attacker") {
    return str(row, "attacker_name", "attackerName", "attacker");
  }
  if (role === "assister") {
    return str(row, "assister_name", "assisterName");
  }
  if (role === "thrower") {
    return str(row, "thrower_name", "user_name", "name");
  }
  return str(row, "user_name", "name", "player_name");
}

export function roundOf(row: DemoEventRow): number {
  // total_rounds_played is 0-indexed completed rounds; display as round+1.
  const completed = num(row, "total_rounds_played", "round");
  return completed + 1;
}

export function tickOf(row: DemoEventRow): number {
  return num(row, "tick", "Tick");
}

/** Approximate seconds between two ticks at a given tickrate (default 64). */
export function secondsBetween(
  tickA: number,
  tickB: number,
  tickRate = 64,
): number {
  if (!tickRate) return 0;
  return Math.abs(tickB - tickA) / tickRate;
}

export function normalizeSteamId(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}
