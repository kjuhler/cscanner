import {
  nameOf,
  normalizeSteamId,
  num,
  roundOf,
  steamIdOf,
  str,
  tickOf,
} from "./helpers";
import { buildSceneAtTick } from "./scene";
import type {
  DemoEventRow,
  Mistake,
  ParsedDemo,
  PlayerCheatScore,
  PlayerStats,
} from "./types";

const DEG = Math.PI / 180;
const AIM_ON_TARGET_DEG = 8;
const PRE_AIM_DEG = 10;
const WALL_MIN_DIST = 700;
const WALL_FAR_DIST = 1400;
const WALL_VERT_SEP = 56;
const RAGE_SNAP_DEG = 100;
const SPIN_TICK_DEG = 18;
const SPIN_STREAK_TICKS = 24;
const PRE_AIM_WINDOW_SEC = 1.25;
const PRE_AIM_HOLD_SEC = 0.25;

type Pose = {
  steamId: string;
  name: string;
  tick: number;
  x: number;
  y: number;
  z: number;
  pitch: number;
  yaw: number;
  team: number;
  alive: boolean;
};

function angleDeltaDeg(a: number, b: number): number {
  let d = ((a - b + 540) % 360) - 180;
  if (d < -180) d += 360;
  return d;
}

function absYawDelta(a: number, b: number): number {
  return Math.abs(angleDeltaDeg(a, b));
}

/** Source-engine forward vector from yaw/pitch (degrees). */
function viewForward(yaw: number, pitch: number): [number, number, number] {
  const yawR = yaw * DEG;
  const pitchR = pitch * DEG;
  const cp = Math.cos(pitchR);
  return [Math.cos(yawR) * cp, Math.sin(yawR) * cp, -Math.sin(pitchR)];
}

function aimErrorDeg(
  from: { x: number; y: number; z: number; yaw: number; pitch: number },
  to: { x: number; y: number; z: number },
): number {
  const eyeZ = from.z + 64;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z + 64 - eyeZ;
  const len = Math.hypot(dx, dy, dz);
  if (len < 1) return 180;
  const [fx, fy, fz] = viewForward(from.yaw, from.pitch);
  const dot = (fx * dx + fy * dy + fz * dz) / len;
  const clamped = Math.min(1, Math.max(-1, dot));
  return (Math.acos(clamped) / Math.PI) * 180;
}

function dist3(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function isAliveRow(row: DemoEventRow): boolean {
  const health = num(row, "health");
  if (health > 0) return true;
  const alive = num(row, "is_alive");
  if (alive === 1) return true;
  // Some demos omit is_alive; treat non-zero health prop absence carefully.
  if (row.health === undefined && row.is_alive === undefined) {
    // Fall back: if we have coords, assume alive for motion analysis.
    return num(row, "X", "x") !== 0 || num(row, "Y", "y") !== 0;
  }
  return false;
}

function rowToPose(row: DemoEventRow): Pose | null {
  const steamId = normalizeSteamId(str(row, "steamid", "steam_id"));
  if (!steamId || steamId === "0") return null;
  return {
    steamId,
    name: str(row, "name") || steamId,
    tick: tickOf(row),
    x: num(row, "X", "x"),
    y: num(row, "Y", "y"),
    z: num(row, "Z", "z"),
    pitch: num(row, "pitch"),
    yaw: num(row, "yaw"),
    team: num(row, "team_num", "team_number"),
    alive: isAliveRow(row),
  };
}

function occlusionProxy(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
): boolean {
  const d = dist3(a, b);
  if (d < WALL_MIN_DIST) return false;
  if (Math.abs(a.z - b.z) >= WALL_VERT_SEP) return true;
  return d >= WALL_FAR_DIST;
}

function emptyScore(steamId: string, name: string): PlayerCheatScore {
  return {
    steamId,
    name,
    wallLookScore: 0,
    wallLookSamples: 0,
    preAimFlags: 0,
    rageSnaps: 0,
    spinbotFlags: 0,
    cheatRisk: 0,
  };
}

function computeRisk(s: PlayerCheatScore): number {
  const wall = Math.min(40, s.wallLookScore * 0.45);
  const pre = Math.min(25, s.preAimFlags * 6);
  const rage = Math.min(25, s.rageSnaps * 4);
  const spin = Math.min(30, s.spinbotFlags * 15);
  return Math.min(100, Math.round(wall + pre + rage + spin));
}

/**
 * Cheat / suspicious-aim heuristics from sampled motion ticks + deaths.
 * Not VAC proof — signals for review only.
 */
export function analyzeCheating(
  demo: ParsedDemo,
  players: PlayerStats[],
  tickRate: number,
): { mistakes: Mistake[]; cheatScores: PlayerCheatScore[] } {
  const mistakes: Mistake[] = [];
  const scores = new Map<string, PlayerCheatScore>();

  for (const p of players) {
    scores.set(p.steamId, emptyScore(p.steamId, p.name));
  }

  const poses = demo.motionTicks
    .map(rowToPose)
    .filter((p): p is Pose => p !== null && p.alive);

  // Index poses by tick → steamId
  const byTick = new Map<number, Pose[]>();
  const byPlayer = new Map<string, Pose[]>();
  for (const pose of poses) {
    const tickList = byTick.get(pose.tick) ?? [];
    tickList.push(pose);
    byTick.set(pose.tick, tickList);

    const plist = byPlayer.get(pose.steamId) ?? [];
    plist.push(pose);
    byPlayer.set(pose.steamId, plist);

    if (!scores.has(pose.steamId)) {
      scores.set(pose.steamId, emptyScore(pose.steamId, pose.name));
    } else {
      const s = scores.get(pose.steamId)!;
      if (pose.name && s.name === s.steamId) s.name = pose.name;
    }
  }

  // --- Wall-look / tracking occluded enemies ---
  const wallHits = new Map<string, number>();
  const wallSamples = new Map<string, number>();

  for (const [, group] of byTick) {
    for (const observer of group) {
      wallSamples.set(
        observer.steamId,
        (wallSamples.get(observer.steamId) ?? 0) + 1,
      );
      let lookingOccluded = false;
      for (const enemy of group) {
        if (enemy.steamId === observer.steamId) continue;
        if (observer.team > 0 && enemy.team > 0 && observer.team === enemy.team) {
          continue;
        }
        if (!occlusionProxy(observer, enemy)) continue;
        if (aimErrorDeg(observer, enemy) <= AIM_ON_TARGET_DEG) {
          lookingOccluded = true;
          break;
        }
      }
      if (lookingOccluded) {
        wallHits.set(
          observer.steamId,
          (wallHits.get(observer.steamId) ?? 0) + 1,
        );
      }
    }
  }

  for (const [sid, sampleCount] of wallSamples) {
    const s = scores.get(sid) ?? emptyScore(sid, sid);
    const hits = wallHits.get(sid) ?? 0;
    s.wallLookSamples = sampleCount;
    s.wallLookScore =
      sampleCount > 0
        ? Math.round((hits / sampleCount) * 1000) / 10
        : 0;
    scores.set(sid, s);

    if (s.wallLookScore >= 12 && sampleCount >= 40) {
      mistakes.push({
        steamId: sid,
        playerName: s.name,
        round: 0,
        type: "cheat",
        message: `Elevated wall-look score ${s.wallLookScore}% (aiming at distant/occluded enemies — heuristic, not proof)`,
        severity: s.wallLookScore >= 22 ? "danger" : "warn",
      });
    }
  }

  // --- Rage snaps + spinbot from yaw history ---
  for (const [sid, history] of byPlayer) {
    const sorted = [...history].sort((a, b) => a.tick - b.tick);
    const s = scores.get(sid) ?? emptyScore(sid, sorted[0]?.name ?? sid);
    let spinStreak = 0;
    let spinEpisodes = 0;

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const cur = sorted[i]!;
      const tickGap = cur.tick - prev.tick;
      if (tickGap <= 0 || tickGap > tickRate) {
        spinStreak = 0;
        continue;
      }

      // Normalize snap magnitude to per-tick equivalent for multi-tick samples.
      const yawJump = absYawDelta(cur.yaw, prev.yaw);
      const perTick = yawJump / tickGap;

      if (yawJump >= RAGE_SNAP_DEG && tickGap <= Math.max(4, tickRate / 8)) {
        s.rageSnaps += 1;
        if (s.rageSnaps <= 8) {
          mistakes.push({
            steamId: sid,
            playerName: s.name,
            round: 0,
            type: "cheat",
            message: `Rage-like aim snap ~${Math.round(yawJump)}° (viewangle jump)`,
            severity: "danger",
          });
        }
      }

      if (perTick >= SPIN_TICK_DEG) {
        spinStreak += tickGap;
        if (spinStreak >= SPIN_STREAK_TICKS) {
          spinEpisodes += 1;
          spinStreak = 0;
        }
      } else {
        spinStreak = 0;
      }
    }

    s.spinbotFlags = spinEpisodes;
    if (spinEpisodes > 0) {
      mistakes.push({
        steamId: sid,
        playerName: s.name,
        round: 0,
        type: "cheat",
        message: `Possible spinbot / continuous angle spam (${spinEpisodes} episode${spinEpisodes === 1 ? "" : "s"})`,
        severity: "danger",
      });
    }
    scores.set(sid, s);
  }

  // --- Pre-aim before kills ---
  const sortedTicks = [...byTick.keys()].sort((a, b) => a - b);

  function posesNear(tick: number): Pose[] {
    // Find closest sampled tick <= target
    let best = -1;
    for (const t of sortedTicks) {
      if (t > tick) break;
      best = t;
    }
    if (best < 0) return [];
    if (tick - best > tickRate * 0.5) return [];
    return byTick.get(best) ?? [];
  }

  for (const death of demo.deaths) {
    const attackerId = steamIdOf(death, "attacker");
    const victimId = steamIdOf(death, "user");
    if (!attackerId || !victimId || attackerId === victimId) continue;

    const deathTick = tickOf(death);
    if (!deathTick) continue;
    const round = roundOf(death);
    const windowStart = deathTick - Math.round(PRE_AIM_WINDOW_SEC * tickRate);
    const holdNeed = Math.round(PRE_AIM_HOLD_SEC * tickRate);

    let hold = 0;
    let flagged = false;

    for (const t of sortedTicks) {
      if (t < windowStart || t >= deathTick) continue;
      const group = byTick.get(t) ?? [];
      const attacker = group.find((p) => p.steamId === attackerId);
      const victim = group.find((p) => p.steamId === victimId);
      if (!attacker || !victim) {
        hold = 0;
        continue;
      }
      if (!occlusionProxy(attacker, victim)) {
        hold = 0;
        continue;
      }
      if (aimErrorDeg(attacker, victim) <= PRE_AIM_DEG) {
        hold += 1; // sampled ticks; approximate
        // Convert sample count using typical step — use consecutive samples
        if (hold >= Math.max(2, Math.ceil(holdNeed / 16))) {
          flagged = true;
          break;
        }
      } else {
        hold = 0;
      }
    }

    // Also check denser: walk samples in window via posesNear at intervals
    if (!flagged) {
      let continuous = 0;
      for (
        let t = windowStart;
        t < deathTick;
        t += Math.max(4, Math.floor(tickRate / 16))
      ) {
        const group = posesNear(t);
        const attacker = group.find((p) => p.steamId === attackerId);
        const victim = group.find((p) => p.steamId === victimId);
        if (!attacker || !victim || !occlusionProxy(attacker, victim)) {
          continuous = 0;
          continue;
        }
        if (aimErrorDeg(attacker, victim) <= PRE_AIM_DEG) {
          continuous += Math.max(4, Math.floor(tickRate / 16));
          if (continuous >= holdNeed) {
            flagged = true;
            break;
          }
        } else {
          continuous = 0;
        }
      }
    }

    if (flagged) {
      const s =
        scores.get(attackerId) ??
        emptyScore(attackerId, nameOf(death, "attacker"));
      s.preAimFlags += 1;
      scores.set(attackerId, s);
      const sceneTick = deathTick - Math.round(0.4 * tickRate);
      mistakes.push({
        steamId: attackerId,
        playerName: s.name,
        round,
        type: "cheat",
        message: `Pre-aim on ${nameOf(death, "user") || "enemy"} through occlusion before kill`,
        severity: "warn",
        scene: buildSceneAtTick(
          demo,
          sceneTick,
          {
            [attackerId]: "attacker",
            [victimId]: "victim",
          },
          { focusSteamId: attackerId },
        ),
      });
    }
  }

  const cheatScores = [...scores.values()].map((s) => {
    s.cheatRisk = computeRisk(s);
    return s;
  });
  cheatScores.sort((a, b) => b.cheatRisk - a.cheatRisk);

  return { mistakes, cheatScores };
}
