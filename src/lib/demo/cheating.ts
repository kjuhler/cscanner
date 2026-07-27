import { parseTicks } from "@laihoe/demoparser2";
import {
  nameOf,
  normalizeSteamId,
  num,
  roundOf,
  steamIdOf,
  str,
  tickOf,
} from "./helpers";
import {
  buildRoundScores,
  isPressureRound,
  roundFreezeEndTick,
  type RoundScore,
} from "./rounds";
import { buildSceneAtTick } from "./scene";
import { buildSmokeWindows, isInActiveSmoke } from "./smoke";
import type {
  CheatCategory,
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
const TRACK_SWITCH_YAW_DEG = 35;
const TRACK_SWITCH_TICK_GAP = 6;
const SELECTIVE_LOCK_DEG = 9;
const SELECTIVE_ALT_DEG = 22;
const SELECTIVE_MAX_SCAN_YAW = 50;
const EARLY_INFO_WINDOW_SEC = 15;
const EARLY_INFO_HOLD_SEC = 0.5;
const TRIGGER_MAX_TICKS = 4;
const TRANSFER_KILL_WINDOW_SEC = 2;
const RCS_MIN_SHOTS = 8;
const RCS_MAX_VARIANCE = 0.35;
const LURKER_MIN_YAW = 140;
const INFO_PROXY_SEC = 2;

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
  if (row.health === undefined && row.is_alive === undefined) {
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

function cheatMsg(category: CheatCategory, text: string): string {
  const tag =
    category === "wall" ? "[Wall]" : category === "aim" ? "[Aim]" : "[Context]";
  return `${tag} ${text}`;
}

function emptyScore(steamId: string, name: string): PlayerCheatScore {
  return {
    steamId,
    name,
    wallLookScore: 0,
    wallLookSamples: 0,
    preAimFlags: 0,
    wallTrackRotations: 0,
    selectiveClearFlags: 0,
    infoRotateFlags: 0,
    rageSnaps: 0,
    spinbotFlags: 0,
    smokeSpamFlags: 0,
    triggerFlags: 0,
    transferFlags: 0,
    rcsFlags: 0,
    lurkerCheckFlags: 0,
    momentumFlags: 0,
    cheatRisk: 0,
  };
}

function computeRisk(s: PlayerCheatScore): number {
  const wall = Math.min(35, s.wallLookScore * 0.4);
  const pre = Math.min(20, s.preAimFlags * 5);
  const track = Math.min(18, s.wallTrackRotations * 3);
  const selective = Math.min(12, s.selectiveClearFlags * 4);
  const infoRotate = Math.min(12, s.infoRotateFlags * 4);
  const smoke = Math.min(12, s.smokeSpamFlags * 5);
  const lurker = Math.min(10, s.lurkerCheckFlags * 5);
  const rage = Math.min(20, s.rageSnaps * 3);
  const spin = Math.min(25, s.spinbotFlags * 12);
  const trigger = Math.min(15, s.triggerFlags * 5);
  const transfer = Math.min(12, s.transferFlags * 6);
  const rcs = Math.min(10, s.rcsFlags * 5);
  const momentum = Math.min(10, s.momentumFlags * 8);
  return Math.min(
    100,
    Math.round(
      wall +
        pre +
        track +
        selective +
        infoRotate +
        smoke +
        lurker +
        rage +
        spin +
        trigger +
        transfer +
        rcs +
        momentum,
    ),
  );
}

function parseDenseTicks(
  demoPath: string,
  centerTicks: number[],
  tickRate: number,
): Map<number, Pose[]> {
  const unique = new Set<number>();
  const step = Math.max(1, Math.floor(tickRate / 32));
  for (const center of centerTicks) {
    for (let t = center - tickRate; t <= center + tickRate; t += step) {
      if (t >= 0) unique.add(t);
    }
  }
  const ticks = [...unique].sort((a, b) => a - b).slice(0, 4000);
  if (ticks.length === 0) return new Map();

  let rows: DemoEventRow[] = [];
  try {
    rows = (parseTicks(
      demoPath,
      ["X", "Y", "Z", "pitch", "yaw", "team_num", "health", "is_alive"],
      ticks,
    ) ?? []) as DemoEventRow[];
  } catch {
    return new Map();
  }

  const byTick = new Map<number, Pose[]>();
  for (const row of rows) {
    const pose = rowToPose(row);
    if (!pose || !pose.alive) continue;
    const list = byTick.get(pose.tick) ?? [];
    list.push(pose);
    byTick.set(pose.tick, list);
  }
  return byTick;
}

function mergeTickMaps(
  base: Map<number, Pose[]>,
  dense: Map<number, Pose[]>,
): Map<number, Pose[]> {
  const merged = new Map(base);
  for (const [tick, poses] of dense) {
    merged.set(tick, poses);
  }
  return merged;
}

function victimRecentlyFlashed(
  demo: ParsedDemo,
  victimId: string,
  tick: number,
  tickRate: number,
): boolean {
  const window = Math.round(INFO_PROXY_SEC * tickRate);
  for (const blind of demo.blinds) {
    if (steamIdOf(blind, "user") !== victimId) continue;
    if (Math.abs(tickOf(blind) - tick) <= window) return true;
  }
  return false;
}

function teammateRecentlyEngagedVictim(
  demo: ParsedDemo,
  attackerId: string,
  victimId: string,
  attackerTeam: number,
  tick: number,
  tickRate: number,
): boolean {
  const window = Math.round(INFO_PROXY_SEC * tickRate);
  for (const hurt of demo.hurts) {
    const t = tickOf(hurt);
    if (Math.abs(t - tick) > window || t >= tick) continue;
    if (steamIdOf(hurt, "user") !== victimId) continue;
    const otherAttacker = steamIdOf(hurt, "attacker");
    if (!otherAttacker || otherAttacker === attackerId) continue;
    const otherTeam = num(hurt, "attacker_team", "team_num");
    if (attackerTeam > 0 && otherTeam > 0 && otherTeam === attackerTeam) {
      return true;
    }
  }
  for (const death of demo.deaths) {
    const t = tickOf(death);
    if (Math.abs(t - tick) > window || t >= tick) continue;
    if (steamIdOf(death, "user") !== victimId) continue;
    const otherAttacker = steamIdOf(death, "attacker");
    if (!otherAttacker || otherAttacker === attackerId) continue;
  }
  return false;
}

function firstVisibleTick(
  byTick: Map<number, Pose[]>,
  sortedTicks: number[],
  attackerId: string,
  victimId: string,
  beforeTick: number,
  windowStart: number,
): number | null {
  let lastOccluded: number | null = null;
  for (const t of sortedTicks) {
    if (t < windowStart || t > beforeTick) continue;
    const group = byTick.get(t) ?? [];
    const attacker = group.find((p) => p.steamId === attackerId);
    const victim = group.find((p) => p.steamId === victimId);
    if (!attacker || !victim) continue;
    const occluded = occlusionProxy(attacker, victim);
    if (occluded) {
      lastOccluded = t;
    } else if (lastOccluded != null) {
      return t;
    }
  }
  return null;
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
  const teamById = new Map<string, number>();
  const roundScores = buildRoundScores(demo);
  const smokeWindows = buildSmokeWindows(demo, tickRate);

  for (const p of players) {
    scores.set(p.steamId, emptyScore(p.steamId, p.name));
    teamById.set(p.steamId, p.team);
  }

  const poses = demo.motionTicks
    .map(rowToPose)
    .filter((p): p is Pose => p !== null && p.alive);

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
    if (pose.team > 0) teamById.set(pose.steamId, pose.team);
  }

  const engagementCenters = [
    ...demo.deaths.map((d) => tickOf(d)),
    ...demo.hurts.map((h) => tickOf(h)),
    ...demo.weaponFires.slice(0, 500).map((w) => tickOf(w)),
  ].filter((t) => t > 0);
  const denseByTick = parseDenseTicks(demo.path, engagementCenters, tickRate);
  const allByTick = mergeTickMaps(byTick, denseByTick);
  const sortedTicks = [...allByTick.keys()].sort((a, b) => a - b);

  const cheatFlagsByPlayerRound = new Map<string, Map<number, number>>();

  function trackCheatRound(steamId: string, round: number) {
    const perPlayer = cheatFlagsByPlayerRound.get(steamId) ?? new Map();
    perPlayer.set(round, (perPlayer.get(round) ?? 0) + 1);
    cheatFlagsByPlayerRound.set(steamId, perPlayer);
  }

  function pushCheat(
    m: Omit<Mistake, "type" | "message" | "cheatCategory"> & {
      cheatCategory: CheatCategory;
      message: string;
    },
  ) {
    const { cheatCategory, message, ...rest } = m;
    mistakes.push({
      ...rest,
      type: "cheat",
      cheatCategory,
      message: cheatMsg(cheatCategory, message),
    });
    if (rest.round > 0) trackCheatRound(rest.steamId, rest.round);
  }

  // --- Wall-look ---
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
      sampleCount > 0 ? Math.round((hits / sampleCount) * 1000) / 10 : 0;
    scores.set(sid, s);

    if (s.wallLookScore >= 12 && sampleCount >= 40) {
      pushCheat({
        steamId: sid,
        playerName: s.name,
        round: 0,
        cheatCategory: "wall",
        message: `Elevated wall-look score ${s.wallLookScore}% (aiming at distant/occluded enemies — heuristic, not proof)`,
        severity: s.wallLookScore >= 22 ? "danger" : "warn",
      });
    }
  }

  // --- Rage snaps + spinbot ---
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

      const yawJump = absYawDelta(cur.yaw, prev.yaw);
      const perTick = yawJump / tickGap;

      if (yawJump >= RAGE_SNAP_DEG && tickGap <= Math.max(4, tickRate / 8)) {
        s.rageSnaps += 1;
        if (s.rageSnaps <= 8) {
          pushCheat({
            steamId: sid,
            playerName: s.name,
            round: 0,
            cheatCategory: "aim",
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
      pushCheat({
        steamId: sid,
        playerName: s.name,
        round: 0,
        cheatCategory: "aim",
        message: `Possible spinbot / continuous angle spam (${spinEpisodes} episode${spinEpisodes === 1 ? "" : "s"})`,
        severity: "danger",
      });
    }
    scores.set(sid, s);
  }

  // --- Wall-track rotations ---
  for (const [sid, history] of byPlayer) {
    const sorted = [...history].sort((a, b) => a.tick - b.tick);
    if (sorted.length < 3) continue;
    const s = scores.get(sid) ?? emptyScore(sid, sorted[0]?.name ?? sid);
    let switches = 0;
    let prevTargetId = "";
    let prevYaw = sorted[0]!.yaw;
    let prevTick = sorted[0]!.tick;

    for (const cur of sorted) {
      const group = allByTick.get(cur.tick) ?? [];
      let bestEnemy: Pose | null = null;
      let bestErr = 999;
      for (const enemy of group) {
        if (enemy.steamId === sid) continue;
        if (cur.team > 0 && enemy.team > 0 && cur.team === enemy.team) continue;
        if (!occlusionProxy(cur, enemy)) continue;
        const err = aimErrorDeg(cur, enemy);
        if (err < bestErr && err <= AIM_ON_TARGET_DEG) {
          bestErr = err;
          bestEnemy = enemy;
        }
      }
      const curTargetId = bestEnemy?.steamId ?? "";
      const tickGap = cur.tick - prevTick;
      const yawJump = absYawDelta(cur.yaw, prevYaw);
      if (
        prevTargetId &&
        curTargetId &&
        curTargetId !== prevTargetId &&
        tickGap > 0 &&
        tickGap <= TRACK_SWITCH_TICK_GAP &&
        yawJump >= TRACK_SWITCH_YAW_DEG
      ) {
        switches += 1;
      }
      prevTargetId = curTargetId || prevTargetId;
      prevYaw = cur.yaw;
      prevTick = cur.tick;
    }

    s.wallTrackRotations = switches;
    if (switches >= 3) {
      pushCheat({
        steamId: sid,
        playerName: s.name,
        round: 0,
        cheatCategory: "wall",
        message: `Repeated wall-track target switches (${switches}) with fast corrective rotations`,
        severity: switches >= 6 ? "danger" : "warn",
      });
    }
    scores.set(sid, s);
  }

  function posesNear(tick: number): Pose[] {
    let best = -1;
    for (const t of sortedTicks) {
      if (t > tick) break;
      best = t;
    }
    if (best < 0) return [];
    if (tick - best > tickRate * 0.5) return [];
    return allByTick.get(best) ?? [];
  }

  // --- Pre-aim + selective clears ---
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
    let lockSamples = 0;
    let altEnemySamples = 0;
    let minYaw = 999;
    let maxYaw = -999;

    for (const t of sortedTicks) {
      if (t < windowStart || t >= deathTick) continue;
      const group = allByTick.get(t) ?? [];
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
        hold += 1;
        lockSamples += 1;
        minYaw = Math.min(minYaw, attacker.yaw);
        maxYaw = Math.max(maxYaw, attacker.yaw);
        for (const enemy of group) {
          if (enemy.steamId === attackerId || enemy.steamId === victimId) continue;
          if (attacker.team > 0 && enemy.team > 0 && attacker.team === enemy.team) {
            continue;
          }
          if (!occlusionProxy(attacker, enemy)) continue;
          if (aimErrorDeg(attacker, enemy) <= SELECTIVE_ALT_DEG) {
            altEnemySamples += 1;
            break;
          }
        }
        if (hold >= Math.max(2, Math.ceil(holdNeed / 16))) {
          flagged = true;
          break;
        }
      } else {
        hold = 0;
      }
    }

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
      pushCheat({
        steamId: attackerId,
        playerName: s.name,
        round,
        cheatCategory: "wall",
        message: `Pre-aim on ${nameOf(death, "user") || "enemy"} through occlusion before kill`,
        severity: "warn",
        scene: buildSceneAtTick(
          demo,
          sceneTick,
          { [attackerId]: "attacker", [victimId]: "victim" },
          { focusSteamId: attackerId },
        ),
      });
      const yawRange =
        minYaw <= maxYaw ? absYawDelta(maxYaw, minYaw) : Number.POSITIVE_INFINITY;
      if (
        lockSamples >= 3 &&
        altEnemySamples >= 2 &&
        yawRange <= SELECTIVE_MAX_SCAN_YAW
      ) {
        s.selectiveClearFlags += 1;
        pushCheat({
          steamId: attackerId,
          playerName: s.name,
          round,
          cheatCategory: "wall",
          message:
            "Selective angle-clearing: tracked victim while skipping broad clears despite nearby enemy lanes",
          severity: "warn",
          scene: buildSceneAtTick(
            demo,
            sceneTick,
            { [attackerId]: "attacker", [victimId]: "victim" },
            { focusSteamId: attackerId },
          ),
        });
      }
    }
  }

  // --- Early-round info rotates ---
  const firstEngagement = new Map<
    string,
    { tick: number; victimId: string; round: number }
  >();
  for (const death of demo.deaths) {
    const attackerId = steamIdOf(death, "attacker");
    const victimId = steamIdOf(death, "user");
    if (!attackerId || !victimId || attackerId === victimId) continue;
    const t = tickOf(death);
    if (!t) continue;
    const cur = firstEngagement.get(attackerId);
    if (!cur || t < cur.tick) {
      firstEngagement.set(attackerId, { tick: t, victimId, round: roundOf(death) });
    }
  }
  for (const [attackerId, fe] of firstEngagement.entries()) {
    const freezeTick = roundFreezeEndTick(demo, fe.round);
    if (!freezeTick || fe.tick <= freezeTick) continue;
    const earlyEnd = Math.min(
      fe.tick,
      freezeTick + Math.round(EARLY_INFO_WINDOW_SEC * tickRate),
    );
    const holdNeed = Math.max(2, Math.round(EARLY_INFO_HOLD_SEC * tickRate));
    let hold = 0;
    let flagged = false;
    for (const t of sortedTicks) {
      if (t < freezeTick || t > earlyEnd) continue;
      const group = allByTick.get(t) ?? [];
      const attacker = group.find((p) => p.steamId === attackerId);
      if (!attacker) continue;
      const victim = group.find((p) => p.steamId === fe.victimId);
      if (!victim || !occlusionProxy(attacker, victim)) {
        hold = 0;
        continue;
      }
      if (aimErrorDeg(attacker, victim) <= SELECTIVE_LOCK_DEG) {
        hold += 1;
        if (hold >= holdNeed) {
          flagged = true;
          break;
        }
      } else {
        hold = 0;
      }
    }
    if (!flagged) continue;
    const s = scores.get(attackerId) ?? emptyScore(attackerId, attackerId);
    s.infoRotateFlags += 1;
    pushCheat({
      steamId: attackerId,
      playerName: s.name,
      round: fe.round,
      cheatCategory: "wall",
      message:
        "Early-round hidden-target lock before first duel (possible info-like rotate)",
      severity: "warn",
    });
    scores.set(attackerId, s);
  }

  // --- Smoke spam ---
  for (const hurt of demo.hurts) {
    const attackerId = steamIdOf(hurt, "attacker");
    const victimId = steamIdOf(hurt, "user");
    if (!attackerId || !victimId || attackerId === victimId) continue;
    const tick = tickOf(hurt);
    if (!tick) continue;
    const dmg = num(hurt, "dmg_health", "dmg_health_real");
    if (dmg <= 0) continue;

    const group = posesNear(tick);
    const attacker = group.find((p) => p.steamId === attackerId);
    const victim = group.find((p) => p.steamId === victimId);
    if (!attacker || !victim) continue;
    if (!isInActiveSmoke(victim.x, victim.y, tick, smokeWindows)) continue;
    if (!occlusionProxy(attacker, victim)) continue;

    const team = attacker.team || teamById.get(attackerId) || 0;
    if (
      victimRecentlyFlashed(demo, victimId, tick, tickRate) ||
      teammateRecentlyEngagedVictim(
        demo,
        attackerId,
        victimId,
        team,
        tick,
        tickRate,
      )
    ) {
      continue;
    }

    const s = scores.get(attackerId) ?? emptyScore(attackerId, nameOf(hurt, "attacker"));
    if (s.smokeSpamFlags >= 6) continue;
    s.smokeSpamFlags += 1;
    scores.set(attackerId, s);
    pushCheat({
      steamId: attackerId,
      playerName: s.name,
      round: roundOf(hurt),
      cheatCategory: "wall",
      message:
        "Damage on smoked victim through occlusion without flash or teammate info proxy",
      severity: "warn",
      scene: buildSceneAtTick(
        demo,
        tick,
        { [attackerId]: "attacker", [victimId]: "victim" },
        { focusSteamId: attackerId },
      ),
    });
  }

  // --- Trigger timing ---
  const triggerChecked = new Set<string>();
  for (const fire of demo.weaponFires) {
    const attackerId = steamIdOf(fire, "user") || steamIdOf(fire, "attacker");
    if (!attackerId) continue;
    const tick = tickOf(fire);
    if (!tick) continue;
    const weapon = str(fire, "weapon").toLowerCase();
    if (weapon.includes("knife") || weapon.includes("grenade")) continue;

    const windowStart = tick - Math.round(1.5 * tickRate);
    const nearestTick =
      sortedTicks.find((t) => t <= tick && tick - t <= tickRate / 4) ?? -1;
    const group = allByTick.get(nearestTick) ?? posesNear(tick);

    for (const victim of group) {
      if (victim.steamId === attackerId) continue;
      if (
        victim.team > 0 &&
        (teamById.get(attackerId) ?? 0) > 0 &&
        victim.team === teamById.get(attackerId)
      ) {
        continue;
      }
      const visibleTick = firstVisibleTick(
        allByTick,
        sortedTicks,
        attackerId,
        victim.steamId,
        tick - 1,
        windowStart,
      );
      if (visibleTick == null) continue;
      const reaction = tick - visibleTick;
      if (reaction > TRIGGER_MAX_TICKS || reaction < 0) continue;

      const key = `${attackerId}|${victim.steamId}|${Math.floor(tick / tickRate)}`;
      if (triggerChecked.has(key)) continue;
      triggerChecked.add(key);

      const s = scores.get(attackerId) ?? emptyScore(attackerId, attackerId);
      if (s.triggerFlags >= 5) continue;
      s.triggerFlags += 1;
      scores.set(attackerId, s);
      pushCheat({
        steamId: attackerId,
        playerName: s.name,
        round: roundOf(fire),
        cheatCategory: "aim",
        message: `Shot within ${reaction} tick(s) of target becoming visible (possible trigger timing)`,
        severity: reaction <= 2 ? "danger" : "warn",
        scene: buildSceneAtTick(
          demo,
          tick,
          { [attackerId]: "attacker", [victim.steamId]: "victim" },
          { focusSteamId: attackerId },
        ),
      });
      break;
    }
  }

  // --- Multi-kill occluded transfers ---
  const killsByAttacker = new Map<string, { tick: number; victimId: string; round: number }[]>();
  for (const death of demo.deaths) {
    const attackerId = steamIdOf(death, "attacker");
    const victimId = steamIdOf(death, "user");
    if (!attackerId || !victimId || attackerId === victimId) continue;
    const tick = tickOf(death);
    if (!tick) continue;
    const list = killsByAttacker.get(attackerId) ?? [];
    list.push({ tick, victimId, round: roundOf(death) });
    killsByAttacker.set(attackerId, list);
  }

  for (const [attackerId, kills] of killsByAttacker) {
    const sorted = [...kills].sort((a, b) => a.tick - b.tick);
    const windowTicks = Math.round(TRANSFER_KILL_WINDOW_SEC * tickRate);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const cur = sorted[i]!;
      if (cur.tick - prev.tick > windowTicks) continue;

      const midTick = Math.floor((prev.tick + cur.tick) / 2);
      const group = posesNear(midTick);
      const attacker = group.find((p) => p.steamId === attackerId);
      if (!attacker) continue;
      const prevVictim = group.find((p) => p.steamId === prev.victimId);
      const curVictim = group.find((p) => p.steamId === cur.victimId);
      if (!prevVictim || !curVictim) continue;
      const prevOcc = occlusionProxy(attacker, prevVictim);
      const curOcc = occlusionProxy(attacker, curVictim);
      if (!prevOcc && !curOcc) continue;
      const yawToPrev = Math.atan2(
        prevVictim.y - attacker.y,
        prevVictim.x - attacker.x,
      );
      const yawToCur = Math.atan2(
        curVictim.y - attacker.y,
        curVictim.x - attacker.x,
      );
      const transferYaw = absYawDelta(
        (yawToPrev * 180) / Math.PI,
        (yawToCur * 180) / Math.PI,
      );
      if (transferYaw < 25) continue;

      const s = scores.get(attackerId) ?? emptyScore(attackerId, attackerId);
      if (s.transferFlags >= 4) continue;
      s.transferFlags += 1;
      scores.set(attackerId, s);
      pushCheat({
        steamId: attackerId,
        playerName: s.name,
        round: cur.round,
        cheatCategory: "aim",
        message: `Multi-kill transfer with large aim jump (${Math.round(transferYaw)}°) between occluded targets`,
        severity: "warn",
        scene: buildSceneAtTick(
          demo,
          midTick,
          {
            [attackerId]: "attacker",
            [prev.victimId]: "victim",
            [cur.victimId]: "other",
          },
          { focusSteamId: attackerId },
        ),
      });
    }
  }

  // --- RCS uniformity ---
  const firesByPlayer = new Map<string, { tick: number; round: number }[]>();
  for (const fire of demo.weaponFires) {
    const sid = steamIdOf(fire, "user") || steamIdOf(fire, "attacker");
    if (!sid) continue;
    const weapon = str(fire, "weapon").toLowerCase();
    if (
      weapon.includes("knife") ||
      weapon.includes("grenade") ||
      weapon.includes("pistol")
    ) {
      continue;
    }
    const tick = tickOf(fire);
    if (!tick) continue;
    const list = firesByPlayer.get(sid) ?? [];
    list.push({ tick, round: roundOf(fire) });
    firesByPlayer.set(sid, list);
  }

  for (const [sid, shots] of firesByPlayer) {
    const sorted = [...shots].sort((a, b) => a.tick - b.tick);
    const gap = Math.max(4, Math.floor(tickRate / 8));
    let burst: { tick: number; round: number }[] = [];

    function flushBurst() {
      if (burst.length < RCS_MIN_SHOTS) {
        burst = [];
        return;
      }
      const pitchDeltas: number[] = [];
      const yawDeltas: number[] = [];
      for (let i = 1; i < burst.length; i++) {
        const t0 = burst[i - 1]!.tick;
        const t1 = burst[i]!.tick;
        const p0 = (allByTick.get(t0) ?? posesNear(t0)).find((p) => p.steamId === sid);
        const p1 = (allByTick.get(t1) ?? posesNear(t1)).find((p) => p.steamId === sid);
        if (!p0 || !p1) continue;
        pitchDeltas.push(p1.pitch - p0.pitch);
        yawDeltas.push(angleDeltaDeg(p1.yaw, p0.yaw));
      }
      if (pitchDeltas.length < RCS_MIN_SHOTS - 2) {
        burst = [];
        return;
      }
      const pitchVar = variance(pitchDeltas);
      const yawVar = variance(yawDeltas.map(Math.abs));
      if (pitchVar <= RCS_MAX_VARIANCE && yawVar <= RCS_MAX_VARIANCE * 2) {
        const s = scores.get(sid) ?? emptyScore(sid, sid);
        if (s.rcsFlags >= 3) {
          burst = [];
          return;
        }
        s.rcsFlags += 1;
        scores.set(sid, s);
        pushCheat({
          steamId: sid,
          playerName: s.name,
          round: burst[0]!.round,
          cheatCategory: "aim",
          message: `Robotic spray compensation during ${burst.length}-shot burst (low angle variance)`,
          severity: "warn",
          scene: buildSceneAtTick(
            demo,
            burst[Math.floor(burst.length / 2)]!.tick,
            { [sid]: "focus" },
            { focusSteamId: sid },
          ),
        });
      }
      burst = [];
    }

    for (const shot of sorted) {
      if (burst.length === 0 || shot.tick - burst[burst.length - 1]!.tick <= gap) {
        burst.push(shot);
      } else {
        flushBurst();
        burst = [shot];
      }
    }
    flushBurst();
  }

  // --- Lurker checks ---
  for (const [sid, history] of byPlayer) {
    const sorted = [...history].sort((a, b) => a.tick - b.tick);
    const s = scores.get(sid) ?? emptyScore(sid, sorted[0]?.name ?? sid);
    for (let i = 2; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const cur = sorted[i]!;
      const yawTurn = absYawDelta(cur.yaw, prev.yaw);
      if (yawTurn < LURKER_MIN_YAW) continue;

      const group = allByTick.get(cur.tick) ?? [];
      let lurker: Pose | null = null;
      for (const enemy of group) {
        if (enemy.steamId === sid) continue;
        if (cur.team > 0 && enemy.team > 0 && cur.team === enemy.team) continue;
        if (!occlusionProxy(cur, enemy)) continue;
        const err = aimErrorDeg(cur, enemy);
        if (err > SELECTIVE_LOCK_DEG) continue;
        const behindYaw = absYawDelta(
          cur.yaw,
          (Math.atan2(enemy.y - cur.y, enemy.x - cur.x) * 180) / Math.PI,
        );
        if (behindYaw <= 35 || behindYaw >= 325) {
          lurker = enemy;
          break;
        }
      }
      if (!lurker) continue;
      if (s.lurkerCheckFlags >= 4) break;
      s.lurkerCheckFlags += 1;
      pushCheat({
        steamId: sid,
        playerName: s.name,
        round: 0,
        cheatCategory: "wall",
        message:
          "Sharp turn to lock onto hidden lurker behind without prior lane contact",
        severity: "warn",
        scene: buildSceneAtTick(
          demo,
          cur.tick,
          { [sid]: "focus", [lurker.steamId]: "other" },
          { focusSteamId: sid },
        ),
      });
    }
    scores.set(sid, s);
  }

  // --- Momentum / pressure rounds ---
  analyzeMomentum(
    scores,
    cheatFlagsByPlayerRound,
    teamById,
    roundScores,
    pushCheat,
  );

  const cheatScores = [...scores.values()].map((s) => {
    s.cheatRisk = computeRisk(s);
    return s;
  });
  cheatScores.sort((a, b) => b.cheatRisk - a.cheatRisk);

  return { mistakes, cheatScores };
}

function variance(nums: number[]): number {
  if (nums.length === 0) return 0;
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  return nums.reduce((sum, n) => sum + (n - mean) ** 2, 0) / nums.length;
}

function analyzeMomentum(
  scores: Map<string, PlayerCheatScore>,
  cheatFlagsByPlayerRound: Map<string, Map<number, number>>,
  teamById: Map<string, number>,
  roundScores: RoundScore[],
  pushCheat: (m: Omit<Mistake, "type"> & { cheatCategory: CheatCategory }) => void,
) {
  for (const [sid, perRound] of cheatFlagsByPlayerRound) {
    const team = teamById.get(sid) ?? 0;
    if (team !== 2 && team !== 3) continue;
    let pressureFlags = 0;
    let normalFlags = 0;
    for (const [round, count] of perRound) {
      if (isPressureRound(team, round, roundScores)) {
        pressureFlags += count;
      } else {
        normalFlags += count;
      }
    }
    if (pressureFlags >= 2 && normalFlags <= 1) {
      const s = scores.get(sid) ?? emptyScore(sid, sid);
      s.momentumFlags += 1;
      scores.set(sid, s);
      pushCheat({
        steamId: sid,
        playerName: s.name,
        round: 0,
        cheatCategory: "context",
        message: `Most cheat signals (${pressureFlags}) cluster in pressure rounds when team was down ≥3`,
        severity: "warn",
      });
    }
  }
}
