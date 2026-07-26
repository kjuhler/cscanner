import { normalizeSteamId, num, str, tickOf } from "./helpers";
import type { DemoEventRow, EventScene, ParsedDemo, SceneMarker } from "./types";

type Pose = {
  steamId: string;
  name: string;
  team: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  alive: boolean;
  tick: number;
};

function rowToPose(row: DemoEventRow): Pose | null {
  const steamId = normalizeSteamId(str(row, "steamid", "steam_id"));
  if (!steamId || steamId === "0") return null;
  const health = num(row, "health");
  const aliveFlag = num(row, "is_alive");
  const alive =
    health > 0 ||
    aliveFlag === 1 ||
    (row.health === undefined && row.is_alive === undefined);
  return {
    steamId,
    name: str(row, "name") || steamId,
    team: num(row, "team_num", "team_number"),
    x: num(row, "X", "x"),
    y: num(row, "Y", "y"),
    z: num(row, "Z", "z"),
    yaw: num(row, "yaw"),
    alive,
    tick: tickOf(row),
  };
}

/**
 * Build a radar scene from the closest sampled motion tick to `targetTick`.
 */
export function buildSceneAtTick(
  demo: ParsedDemo,
  targetTick: number,
  roles: Record<string, SceneMarker["role"]>,
  options?: { includeDead?: boolean; focusSteamId?: string },
): EventScene | undefined {
  if (!demo.motionTicks.length || !Number.isFinite(targetTick)) return undefined;

  const poses = demo.motionTicks
    .map(rowToPose)
    .filter((p): p is Pose => p !== null);

  if (poses.length === 0) return undefined;

  // Pick closest tick at or before target (prefer), else nearest overall.
  let bestTick = -1;
  let bestDist = Infinity;
  const ticks = new Set(poses.map((p) => p.tick));
  for (const t of ticks) {
    const dist =
      t <= targetTick ? targetTick - t : (t - targetTick) * 2 + 0.5;
    if (dist < bestDist) {
      bestDist = dist;
      bestTick = t;
    }
  }
  if (bestTick < 0) return undefined;

  const atTick = poses.filter((p) => p.tick === bestTick);
  const includeDead = options?.includeDead ?? true;

  const markers: SceneMarker[] = [];
  for (const p of atTick) {
    if (!includeDead && !p.alive) continue;
    const role = roles[p.steamId] ?? "other";
    // Skip anonymous others to keep radar readable — keep roles + same-team mates.
    if (role === "other") continue;
    markers.push({
      steamId: p.steamId,
      name: p.name,
      team: p.team,
      x: p.x,
      y: p.y,
      z: p.z,
      yaw: p.yaw,
      role,
      alive: p.alive,
    });
  }

  // Ensure role players appear even if filtered as other somehow
  for (const [sid, role] of Object.entries(roles)) {
    if (markers.some((m) => m.steamId === sid)) continue;
    const p = atTick.find((x) => x.steamId === sid);
    if (!p) continue;
    markers.push({
      steamId: p.steamId,
      name: p.name,
      team: p.team,
      x: p.x,
      y: p.y,
      z: p.z,
      yaw: p.yaw,
      role,
      alive: p.alive,
    });
  }

  if (markers.length === 0) return undefined;

  return {
    tick: bestTick,
    markers,
    focusSteamId: options?.focusSteamId,
  };
}
