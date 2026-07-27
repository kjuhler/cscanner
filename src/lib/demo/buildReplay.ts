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
  collectFlashBlinds,
  mergeTickAlphaIntoBlinds,
} from "./flashBlinds";
import { zoneAt } from "./zones";
import type {
  DemoEventRow,
  DemoReplay,
  ParsedDemo,
  PlayerStats,
  ReplayBombEvent,
  ReplayEvent,
  ReplayEventKind,
  ReplayFrame,
  ReplayPlayerPose,
  ReplayRound,
} from "./types";

function isAliveRow(row: DemoEventRow): boolean {
  const health = num(row, "health");
  if (health > 0) return true;
  if (num(row, "is_alive") === 1) return true;
  if (row.health === undefined && row.is_alive === undefined) {
    return num(row, "X", "x") !== 0 || num(row, "Y", "y") !== 0;
  }
  return false;
}

function poseFromRow(row: DemoEventRow): ReplayPlayerPose | null {
  const steamId = normalizeSteamId(str(row, "steamid", "steam_id"));
  if (!steamId || steamId === "0") return null;
  return {
    steamId,
    x: num(row, "X", "x"),
    y: num(row, "Y", "y"),
    yaw: num(row, "yaw", "eye_yaw", "ang_y"),
    alive: isAliveRow(row),
    team: num(row, "team_num", "team_number"),
  };
}

function eventCoords(
  row: DemoEventRow,
  fallback?: { x: number; y: number } | null,
): { x: number; y: number } {
  const x = num(row, "x", "X");
  const y = num(row, "y", "Y");
  if (x !== 0 || y !== 0) return { x, y };
  if (fallback) return fallback;
  return { x: 0, y: 0 };
}

function nearestPose(
  frames: ReplayFrame[],
  tick: number,
  steamId: string,
): ReplayPlayerPose | null {
  if (frames.length === 0) return null;
  let best: ReplayFrame | null = null;
  let bestDist = Infinity;
  for (const f of frames) {
    const d = Math.abs(f.tick - tick);
    if (d < bestDist) {
      bestDist = d;
      best = f;
    }
    if (f.tick > tick && bestDist < 64) break;
  }
  return best?.players.find((p) => p.steamId === steamId) ?? null;
}

function winnerTeamOf(row: DemoEventRow): number | undefined {
  for (const key of ["winner", "winner_team"] as const) {
    const v = row[key];
    if (v === undefined || v === null || v === "") continue;
    const n = typeof v === "number" ? v : Number(v);
    if (n === 2 || n === 3) return n;
    // Rare encodings: 0 = T, 1 = CT (only when field is present)
    if (n === 0) return 2;
    if (n === 1) return 3;
    const label = String(v).toLowerCase();
    if (label.includes("counter") || label === "ct") return 3;
    if (label.includes("terror") || label === "t") return 2;
  }

  const message = str(row, "message").toLowerCase();
  if (message.includes("counter") || message.includes("_ct")) return 3;
  if (message.includes("terror") || message.includes("_t")) return 2;
  return undefined;
}

function buildRounds(
  demo: ParsedDemo,
  endTick: number,
  mapName: string,
): ReplayRound[] {
  const starts = [...demo.roundStarts]
    .map((r) => ({ round: roundOf(r), tick: tickOf(r) }))
    .filter((r) => r.tick > 0)
    .sort((a, b) => a.tick - b.tick);

  const freezeEnds = [...demo.roundFreezeEnds]
    .map((r) => ({ round: roundOf(r), tick: tickOf(r) }))
    .filter((r) => r.tick > 0)
    .sort((a, b) => a.tick - b.tick);

  const ends = [...demo.roundEnds]
    .map((r) => ({
      round: roundOf(r),
      tick: tickOf(r),
      winner: winnerTeamOf(r),
    }))
    .filter((r) => r.tick > 0)
    .sort((a, b) => a.tick - b.tick);

  const mvpsByRound = new Map<number, string>();
  for (const row of demo.roundMvps ?? []) {
    const round = roundOf(row);
    const steamId =
      steamIdOf(row, "user") ||
      normalizeSteamId(str(row, "steamid", "user_steamid"));
    if (round > 0 && steamId) mvpsByRound.set(round, steamId);
  }

  if (starts.length === 0) {
    return [{ round: 1, startTick: 0, endTick }];
  }

  const plantsByRound = new Map<number, { tick: number; x: number; y: number }>();
  for (const row of demo.bombPlanted) {
    const round = roundOf(row);
    const tick = tickOf(row);
    if (round <= 0 || tick <= 0) continue;
    const x = num(row, "x", "X");
    const y = num(row, "y", "Y");
    plantsByRound.set(round, { tick, x, y });
  }

  const defusedRounds = new Set(
    demo.bombDefused.map((r) => roundOf(r)).filter((n) => n > 0),
  );
  const explodedRounds = new Set(
    demo.bombExploded.map((r) => roundOf(r)).filter((n) => n > 0),
  );

  const rounds: ReplayRound[] = [];
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i]!;
    const nextStart = starts[i + 1];
    const endFromEvent = ends.find(
      (e) => e.tick > start.tick && (!nextStart || e.tick <= nextStart.tick),
    );
    const endTickRound =
      endFromEvent?.tick ?? nextStart?.tick ?? endTick;
    const roundNum = start.round || i + 1;
    const winnerTeam = endFromEvent?.winner;

    const freezeEnd = freezeEnds.find(
      (f) =>
        f.round === roundNum ||
        (f.tick > start.tick && (!nextStart || f.tick < nextStart.tick)),
    );
    const plant = plantsByRound.get(roundNum);
    const plantZone = plant
      ? zoneAt(mapName, plant.x, plant.y)
      : null;

    rounds.push({
      round: roundNum,
      startTick: start.tick,
      endTick: Math.max(start.tick + 1, endTickRound),
      winnerTeam,
      mvpSteamId: mvpsByRound.get(roundNum),
      freezeEndTick: freezeEnd?.tick,
      plantTick: plant?.tick,
      plantZoneId: plantZone?.id,
      bombDefused: defusedRounds.has(roundNum),
      bombExploded: explodedRounds.has(roundNum),
    });
  }
  return rounds;
}

/** Overlay lifetimes in ticks (CS2 defaults; prefer expire events when present). */
function durationForKind(kind: ReplayEventKind, tickRate: number): number {
  switch (kind) {
    case "smoke":
      // CS2 smoke cloud lifetime.
      return Math.round(18 * tickRate);
    case "molotov":
      // CS2 molotov / incendiary burn time.
      return Math.round(7 * tickRate);
    case "he":
      // Keep impact readable a bit longer than the real blast.
      return Math.round(2.5 * tickRate);
    case "flash":
      // Bright pop; extended if blinds last longer (set later).
      return Math.round(1.4 * tickRate);
    case "kill":
      return Math.round(2.5 * tickRate);
    default:
      return Math.round(2 * tickRate);
  }
}

function entityIdOf(row: DemoEventRow): string {
  const id = str(row, "entityid", "entity_id", "EntityID");
  return id;
}

/**
 * Match a smoke/molly start to its expire tick (entity id, else nearest later xy).
 */
function matchExpireTick(
  start: DemoEventRow,
  expires: DemoEventRow[],
  used: Set<number>,
  tickRate: number,
  maxSeconds: number,
): number | null {
  const startTick = tickOf(start);
  const maxDelta = Math.round(tickRate * maxSeconds);
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
          const minTicks = Math.round(tickRate * (maxSeconds > 15 ? 5 : 2));
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
    const dist = Math.hypot(dx, dy);
    const score = dist + (t - startTick) * 0.02;
    if (score < bestScore) {
      bestScore = score;
      bestI = i;
    }
  }
  if (bestI >= 0 && bestScore < 400) {
    const t = tickOf(expires[bestI]!);
    // Reject absurdly short matches (bad entity/xy pairing → "0s" overlays).
    const minTicks = Math.round(tickRate * (maxSeconds > 15 ? 5 : 2));
    if (t - startTick < minTicks) return null;
    used.add(bestI);
    return t;
  }
  return null;
}

type GrenadeFlight = {
  entityId: string;
  kind: Exclude<ReplayEventKind, "kill">;
  steamId: string;
  name: string;
  throwTick: number;
  throwX: number;
  throwY: number;
  endTick: number;
  endX: number;
  endY: number;
  used: boolean;
};

function mapGrenadeType(raw: string): Exclude<ReplayEventKind, "kill"> | null {
  const t = raw.toLowerCase().replace(/\s+/g, "");
  if (t.includes("flash")) return "flash";
  if (t.includes("smoke")) return "smoke";
  if (t.includes("hegrenade") || t === "he" || t.includes("explosive")) {
    return "he";
  }
  if (
    t.includes("molotov") ||
    t.includes("incendiary") ||
    t.includes("inferno") ||
    t.includes("firebomb")
  ) {
    return "molotov";
  }
  return null;
}

/**
 * Collapse parseGrenades trajectory samples into throw→end flights per entity.
 */
function buildGrenadeFlights(rows: DemoEventRow[]): GrenadeFlight[] {
  const byEntity = new Map<string, DemoEventRow[]>();
  for (const row of rows) {
    const id = str(row, "entity_id", "entityId", "EntityId");
    if (!id) continue;
    const list = byEntity.get(id) ?? [];
    list.push(row);
    byEntity.set(id, list);
  }

  const flights: GrenadeFlight[] = [];
  for (const [entityId, samples] of byEntity) {
    const sorted = [...samples].sort((a, b) => tickOf(a) - tickOf(b));
    const first = sorted[0]!;
    const last = sorted[sorted.length - 1]!;
    const kind = mapGrenadeType(str(first, "grenade_type", "grenadeType", "weapon"));
    if (!kind) continue;

    const steamId = normalizeSteamId(
      str(first, "steamid", "thrower_steamid", "steam_id"),
    );
    const throwX = num(first, "x", "X");
    const throwY = num(first, "y", "Y");
    const endX = num(last, "x", "X");
    const endY = num(last, "y", "Y");
    if ((throwX === 0 && throwY === 0) || (endX === 0 && endY === 0)) continue;

    flights.push({
      entityId,
      kind,
      steamId,
      name: str(first, "name", "thrower_name") || steamId,
      throwTick: tickOf(first),
      throwX,
      throwY,
      endTick: tickOf(last),
      endX,
      endY,
      used: false,
    });
  }

  return flights.sort((a, b) => a.throwTick - b.throwTick);
}

function matchFlight(
  flights: GrenadeFlight[],
  kind: Exclude<ReplayEventKind, "kill">,
  throwerId: string | undefined,
  detonateTick: number,
  detonateX: number,
  detonateY: number,
  tickRate: number,
): GrenadeFlight | null {
  const window = Math.max(64, tickRate * 3);
  let best: GrenadeFlight | null = null;
  let bestScore = Infinity;

  for (const f of flights) {
    if (f.used || f.kind !== kind) continue;
    if (throwerId && f.steamId && f.steamId !== throwerId) continue;

    const tickDelta = Math.abs(f.endTick - detonateTick);
    if (tickDelta > window) continue;

    const dist = Math.hypot(f.endX - detonateX, f.endY - detonateY);
    // Prefer end near detonation; allow thrower match to outweigh distance a bit.
    const score = tickDelta + dist / 50;
    if (score < bestScore) {
      bestScore = score;
      best = f;
    }
  }

  if (best) best.used = true;
  return best;
}

function collectNadeDamage(
  demo: ParsedDemo,
  kind: "he" | "molotov",
  startTick: number,
  endTick: number,
  throwerId: string | undefined,
  tickRate: number,
): number {
  // HE damage lands almost instantly; molly ticks over the burn window.
  const pad = Math.round(tickRate * (kind === "he" ? 0.5 : 0.25));
  const from = startTick - pad;
  const to = endTick + pad;
  let total = 0;
  for (const hurt of demo.hurts) {
    const t = tickOf(hurt);
    if (t < from || t > to) continue;
    const weapon = str(hurt, "weapon").toLowerCase();
    const isHe = weapon.includes("hegrenade");
    const isFire =
      weapon.includes("inferno") ||
      weapon.includes("molotov") ||
      weapon.includes("incendiary");
    if (kind === "he" && !isHe) continue;
    if (kind === "molotov" && !isFire) continue;
    if (throwerId) {
      const attacker = steamIdOf(hurt, "attacker");
      if (attacker && attacker !== throwerId) continue;
    }
    total += Math.max(0, num(hurt, "dmg_health", "dmg_health_real"));
  }
  return Math.round(total);
}

/**
 * Build a compact 2D radar replay payload from parsed demo motion + events.
 */
export function buildReplay(
  demo: ParsedDemo,
  players: PlayerStats[],
  mapName: string,
  tickRate: number,
): DemoReplay | null {
  const byTick = new Map<number, ReplayPlayerPose[]>();

  for (const row of demo.motionTicks) {
    const tick = tickOf(row);
    const pose = poseFromRow(row);
    if (!pose || !tick) continue;
    const list = byTick.get(tick) ?? [];
    list.push(pose);
    byTick.set(tick, list);
  }

  const frames: ReplayFrame[] = [...byTick.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([tick, poses]) => ({ tick, players: poses }));

  if (frames.length < 2) return null;

  const startTick = frames[0]!.tick;
  const endTick = frames[frames.length - 1]!.tick;

  const rosterMap = new Map<
    string,
    { steamId: string; name: string; team: number }
  >();
  for (const p of players) {
    rosterMap.set(p.steamId, {
      steamId: p.steamId,
      name: p.name,
      team: p.team,
    });
  }
  for (const f of frames) {
    for (const pose of f.players) {
      if (!rosterMap.has(pose.steamId)) {
        rosterMap.set(pose.steamId, {
          steamId: pose.steamId,
          name: pose.steamId,
          team: pose.team,
        });
      } else if (pose.team > 0) {
        const cur = rosterMap.get(pose.steamId)!;
        if (!cur.team) cur.team = pose.team;
      }
    }
  }

  const teamById = new Map(
    [...rosterMap.values()].map((p) => [p.steamId, p.team]),
  );
  const nameById = new Map(
    [...rosterMap.values()].map((p) => [p.steamId, p.name]),
  );

  const flights = buildGrenadeFlights(demo.grenadeTrajectories);

  const events: ReplayEvent[] = [];

  for (const row of demo.deaths) {
    const attackerId = steamIdOf(row, "attacker");
    const victimId = steamIdOf(row, "user");
    if (!victimId) continue;
    const tick = tickOf(row);
    const victimPose = nearestPose(frames, tick, victimId);
    const coords = eventCoords(row, victimPose);
    events.push({
      tick,
      round: roundOf(row),
      kind: "kill",
      x: coords.x,
      y: coords.y,
      actorSteamId: attackerId || undefined,
      actorName: nameOf(row, "attacker") || undefined,
      actorTeam: attackerId ? teamById.get(attackerId) : undefined,
      targetSteamId: victimId,
      targetName: nameOf(row, "user") || undefined,
      durationTicks: durationForKind("kill", tickRate),
    });
  }

  const nadeSources: Array<{
    rows: DemoEventRow[];
    kind: Exclude<ReplayEventKind, "kill">;
    expires?: DemoEventRow[];
    maxLifetimeSec: number;
  }> = [
    { rows: demo.flashDetonates, kind: "flash", maxLifetimeSec: 6 },
    { rows: demo.heDetonates, kind: "he", maxLifetimeSec: 2 },
    {
      rows: demo.smokeDetonates,
      kind: "smoke",
      expires: demo.smokeExpires ?? [],
      maxLifetimeSec: 25,
    },
    {
      rows: demo.molotovDetonates,
      kind: "molotov",
      expires: demo.molotovExpires ?? [],
      maxLifetimeSec: 12,
    },
  ];

  const smokeExpireUsed = new Set<number>();
  const mollyExpireUsed = new Set<number>();

  for (const { rows, kind, expires, maxLifetimeSec } of nadeSources) {
    for (const row of rows) {
      const tick = tickOf(row);
      const throwerId =
        steamIdOf(row, "thrower") || steamIdOf(row, "user") || undefined;
      const throwerAtDetonate = throwerId
        ? nearestPose(frames, tick, throwerId)
        : null;
      const coords = eventCoords(row, throwerAtDetonate);
      if (coords.x === 0 && coords.y === 0 && !throwerAtDetonate) continue;

      const flight = matchFlight(
        flights,
        kind,
        throwerId,
        tick,
        coords.x,
        coords.y,
        tickRate,
      );

      // Fallback throw origin: thrower pose a bit before detonate, or flight start.
      let throwX = flight?.throwX;
      let throwY = flight?.throwY;
      let throwTick = flight?.throwTick;
      if (throwX == null || throwY == null) {
        const earlyTick = tick - Math.round(tickRate * 1.5);
        const earlyPose = throwerId
          ? nearestPose(frames, earlyTick, throwerId)
          : null;
        if (earlyPose) {
          throwX = earlyPose.x;
          throwY = earlyPose.y;
          throwTick = earlyTick;
        } else if (throwerAtDetonate) {
          // Last resort — same spot as thrower at pop (still shows actor).
          throwX = throwerAtDetonate.x;
          throwY = throwerAtDetonate.y;
          throwTick = tick;
        }
      }

      // Prefer flight end as pop location when detonate coords are missing/zero.
      const popX =
        coords.x === 0 && coords.y === 0 && flight ? flight.endX : coords.x;
      const popY =
        coords.x === 0 && coords.y === 0 && flight ? flight.endY : coords.y;

      let durationTicks = durationForKind(kind, tickRate);
      let durationEstimated = kind === "smoke" || kind === "molotov";
      if (expires && expires.length > 0) {
        const used = kind === "smoke" ? smokeExpireUsed : mollyExpireUsed;
        const expireTick = matchExpireTick(
          row,
          expires,
          used,
          tickRate,
          maxLifetimeSec,
        );
        if (expireTick != null) {
          const measured = expireTick - tick;
          // Only trust expire if it's in a realistic CS2 range
          // (rejects bad matches that collapse to ~1s).
          const minOk = Math.round(tickRate * (kind === "smoke" ? 12 : 4));
          const maxOk = Math.round(tickRate * (kind === "smoke" ? 22 : 9));
          if (measured >= minOk && measured <= maxOk) {
            durationTicks = measured;
            durationEstimated = false;
          }
        }
      }

      const event: ReplayEvent = {
        tick,
        round: roundOf(row),
        kind,
        x: popX,
        y: popY,
        actorSteamId: throwerId || flight?.steamId,
        actorName:
          nameOf(row, "thrower") ||
          nameOf(row, "user") ||
          flight?.name ||
          undefined,
        actorTeam: (throwerId || flight?.steamId)
          ? teamById.get(throwerId || flight!.steamId)
          : undefined,
        durationTicks,
        durationEstimated:
          kind === "smoke" || kind === "molotov"
            ? durationEstimated
            : undefined,
        throwX,
        throwY,
        throwTick,
      };

      if (kind === "flash") {
        const thrower = throwerId || flight?.steamId;
        event.blinds = collectFlashBlinds(
          demo,
          tick,
          thrower,
          tickRate,
          teamById,
          nameById,
        );
        event.blinds = mergeTickAlphaIntoBlinds(
          demo,
          tick,
          event.blinds,
          tickRate,
        );
        const maxBlindSec = event.blinds.reduce(
          (m, b) => Math.max(m, b.duration),
          0,
        );
        if (maxBlindSec > 0) {
          event.durationTicks = Math.max(
            durationTicks,
            Math.round(maxBlindSec * tickRate),
          );
        }
      }

      if (kind === "he" || kind === "molotov") {
        event.damage = collectNadeDamage(
          demo,
          kind,
          tick,
          tick + durationTicks,
          throwerId || flight?.steamId,
          tickRate,
        );
      }

      events.push(event);
    }
  }

  events.sort((a, b) => a.tick - b.tick);

  const rounds = buildRounds(demo, endTick, mapName);

  const bombEvents: ReplayBombEvent[] = [];
  for (const row of demo.bombPlanted) {
    const round = roundOf(row);
    const tick = tickOf(row);
    if (round <= 0 || tick <= 0) continue;
    const x = num(row, "x", "X");
    const y = num(row, "y", "Y");
    const zone = zoneAt(mapName, x, y);
    bombEvents.push({
      round,
      tick,
      kind: "planted",
      x,
      y,
      team: 2,
      siteZoneId: zone?.id,
    });
  }
  for (const row of demo.bombDefused) {
    const round = roundOf(row);
    const tick = tickOf(row);
    if (round <= 0 || tick <= 0) continue;
    bombEvents.push({
      round,
      tick,
      kind: "defused",
      x: num(row, "x", "X"),
      y: num(row, "y", "Y"),
      team: 3,
    });
  }
  for (const row of demo.bombExploded) {
    const round = roundOf(row);
    const tick = tickOf(row);
    if (round <= 0 || tick <= 0) continue;
    bombEvents.push({
      round,
      tick,
      kind: "exploded",
      x: num(row, "x", "X"),
      y: num(row, "y", "Y"),
      team: 2,
    });
  }
  bombEvents.sort((a, b) => a.tick - b.tick);

  // Recompute molly damage with final duration window.
  for (const ev of events) {
    if (ev.kind !== "molotov" || ev.durationTicks == null) continue;
    ev.damage = collectNadeDamage(
      demo,
      "molotov",
      ev.tick,
      ev.tick + ev.durationTicks,
      ev.actorSteamId,
      tickRate,
    );
  }

  return {
    tickRate,
    mapName,
    startTick,
    endTick,
    players: [...rosterMap.values()],
    frames,
    events,
    rounds,
    bombEvents,
  };
}
