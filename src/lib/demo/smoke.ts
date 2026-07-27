import { num, str, tickOf } from "./helpers";
import type { DemoEventRow, ParsedDemo } from "./types";
import { SMOKE_COVER_RADIUS } from "./radar";

export type SmokeWindow = {
  x: number;
  y: number;
  startTick: number;
  endTick: number;
};

function entityIdOf(row: DemoEventRow): string {
  return str(row, "entityid", "entity_id", "EntityID");
}

function matchExpireTick(
  start: DemoEventRow,
  expires: DemoEventRow[],
  used: Set<number>,
  tickRate: number,
): number | null {
  const startTick = tickOf(start);
  const maxDelta = Math.round(tickRate * 22);
  const eid = entityIdOf(start);
  const sx = num(start, "x", "X");
  const sy = num(start, "y", "Y");

  if (eid) {
    for (let i = 0; i < expires.length; i++) {
      if (used.has(i)) continue;
      const row = expires[i]!;
      if (entityIdOf(row) !== eid) continue;
      const t = tickOf(row);
      if (t <= startTick || t - startTick > maxDelta) continue;
      const minTicks = Math.round(tickRate * 5);
      if (t - startTick < minTicks) continue;
      used.add(i);
      return t;
    }
  }

  let bestI = -1;
  let bestScore = Infinity;
  for (let i = 0; i < expires.length; i++) {
    if (used.has(i)) continue;
    const row = expires[i]!;
    const t = tickOf(row);
    if (t <= startTick || t - startTick > maxDelta) continue;
    const dx = num(row, "x", "X") - sx;
    const dy = num(row, "y", "Y") - sy;
    const score = Math.hypot(dx, dy) + (t - startTick) * 0.02;
    if (score < bestScore) {
      bestScore = score;
      bestI = i;
    }
  }
  if (bestI >= 0 && bestScore < 400) {
    const t = tickOf(expires[bestI]!);
    const minTicks = Math.round(tickRate * 5);
    if (t - startTick < minTicks) return null;
    used.add(bestI);
    return t;
  }
  return null;
}

/** Active smoke clouds with start/end ticks for cheat + replay helpers. */
export function buildSmokeWindows(
  demo: ParsedDemo,
  tickRate: number,
): SmokeWindow[] {
  const windows: SmokeWindow[] = [];
  const used = new Set<number>();
  const defaultDuration = Math.round(18 * tickRate);

  for (const det of demo.smokeDetonates) {
    const startTick = tickOf(det);
    if (!startTick) continue;
    const expireTick = matchExpireTick(det, demo.smokeExpires, used, tickRate);
    windows.push({
      x: num(det, "x", "X"),
      y: num(det, "y", "Y"),
      startTick,
      endTick: expireTick ?? startTick + defaultDuration,
    });
  }

  return windows;
}

export function isInActiveSmoke(
  x: number,
  y: number,
  tick: number,
  windows: SmokeWindow[],
): boolean {
  for (const w of windows) {
    if (tick < w.startTick || tick > w.endTick) continue;
    if (Math.hypot(x - w.x, y - w.y) <= SMOKE_COVER_RADIUS) return true;
  }
  return false;
}
