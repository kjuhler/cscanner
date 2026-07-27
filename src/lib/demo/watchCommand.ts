import { steamId64ToAccountId } from "@/lib/scope";

const WATCH_LEAD_SECONDS = 15;
const DEFAULT_TICK_RATE = 64;

export function watchLeadTicks(tickRate?: number | null): number {
  const rate = tickRate && tickRate > 0 ? tickRate : DEFAULT_TICK_RATE;
  return Math.round(WATCH_LEAD_SECONDS * rate);
}

export function watchTickAt(tick: number, tickRate?: number | null): number {
  return Math.max(0, tick - watchLeadTicks(tickRate));
}

/** CS2 console commands to jump to a tick and lock the camera on a player. */
export function buildDemoWatchCommand(
  tick: number,
  steamId: string,
  playerName: string,
  tickRate?: number | null,
): string {
  const jumpTick = watchTickAt(tick, tickRate);
  const accountId = steamId64ToAccountId(steamId);
  const parts = [`demo_gototick ${jumpTick}`];

  if (accountId != null) {
    // spec_mode must come before spec_player in CS2.
    parts.push(`spec_mode 1`, `spec_player ${accountId}`, `spec_lock_to_accountid ${accountId}`);
  } else if (playerName.trim()) {
    const safeName = playerName.replace(/"/g, '\\"');
    parts.push(`spec_mode 1`, `spec_player "${safeName}"`);
  }

  return parts.join("; ");
}
