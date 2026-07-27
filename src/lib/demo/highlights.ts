import type {
  CoachingHighlight,
  DemoReplay,
  PlayerStats,
  ReplayEvent,
  ReplayFrame,
} from "./types";
import { detectSiteExecutes, siteExecutesToHighlights } from "./executes";
import {
  avgEnemyBlindPercent,
  enemyBlindCount,
} from "./flashBlinds";

function enemyBlindCountEvent(ev: ReplayEvent): number {
  return enemyBlindCount(ev.blinds, ev.actorTeam);
}

function findFrameIndex(frames: ReplayFrame[], tick: number): number {
  let lo = 0;
  let hi = frames.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (frames[mid]!.tick <= tick) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

function poseAtTick(
  frames: ReplayFrame[],
  tick: number,
  steamId: string,
): { x: number; y: number } | null {
  if (frames.length === 0) return null;
  const i = findFrameIndex(frames, tick);
  const frame = frames[i];
  const pose = frame?.players.find((p) => p.steamId === steamId);
  return pose ? { x: pose.x, y: pose.y } : null;
}

function focusCoords(
  replay: DemoReplay,
  ev: ReplayEvent,
): { x: number; y: number } {
  const points: { x: number; y: number }[] = [];
  if (ev.x !== 0 || ev.y !== 0) points.push({ x: ev.x, y: ev.y });
  if (ev.throwX != null && ev.throwY != null) {
    points.push({ x: ev.throwX, y: ev.throwY });
  }
  for (const b of ev.blinds ?? []) {
    const p = poseAtTick(replay.frames, ev.tick, b.steamId);
    if (p) points.push(p);
  }
  if (ev.actorSteamId) {
    const p = poseAtTick(replay.frames, ev.tick, ev.actorSteamId);
    if (p) points.push(p);
  }
  if (points.length === 0) return { x: ev.x, y: ev.y };
  const x = points.reduce((s, p) => s + p.x, 0) / points.length;
  const y = points.reduce((s, p) => s + p.y, 0) / points.length;
  return { x, y };
}

function killsInRound(replay: DemoReplay, round: number): ReplayEvent[] {
  return replay.events.filter((e) => e.kind === "kill" && e.round === round);
}

function aliveCountAtTick(
  replay: DemoReplay,
  tick: number,
  team: number,
): number {
  const i = findFrameIndex(replay.frames, tick);
  const frame = replay.frames[i];
  if (!frame) return 0;
  return frame.players.filter((p) => p.alive && p.team === team).length;
}

let highlightSeq = 0;

function makeHighlight(
  partial: Omit<CoachingHighlight, "id">,
): CoachingHighlight {
  highlightSeq += 1;
  return { id: `hl-${highlightSeq}`, ...partial };
}

/**
 * Detect coaching highlights from replay events (executes, impact plays, etc.).
 */
export function buildCoachingHighlights(
  replay: DemoReplay | null,
  players: PlayerStats[],
): CoachingHighlight[] {
  if (!replay) return [];
  highlightSeq = 0;

  const highlights: CoachingHighlight[] = [];
  const tickRate = replay.tickRate;
  const teamById = new Map(players.map((p) => [p.steamId, p.team]));
  const nameById = new Map(players.map((p) => [p.steamId, p.name]));

  const siteExecutes = detectSiteExecutes(replay, players);
  const siteHighlights = siteExecutesToHighlights(siteExecutes);
  const siteExecuteRounds = new Set(siteExecutes.map((e) => e.round));
  highlights.push(...siteHighlights);

  const flashEvents = replay.events.filter((e) => e.kind === "flash");
  const killEvents = replay.events.filter((e) => e.kind === "kill");
  const heEvents = replay.events.filter((e) => e.kind === "he");

  for (const flash of flashEvents) {
    const enemies = enemyBlindCountEvent(flash);
    const avgBlind = avgEnemyBlindPercent(flash.blinds, flash.actorTeam);
    const actorId = flash.actorSteamId;
    const actorTeam = flash.actorTeam ?? (actorId ? teamById.get(actorId) : 0);
    const actorName =
      flash.actorName ?? (actorId ? nameById.get(actorId) : undefined) ?? "?";
    const coords = focusCoords(replay, flash);
    const followWindow = tickRate * 5;
    const failWindow = tickRate * 8;

    const teamKillsAfter = killEvents.filter(
      (k) =>
        k.round === flash.round &&
        k.tick > flash.tick &&
        k.tick <= flash.tick + followWindow &&
        k.actorTeam === actorTeam &&
        actorTeam,
    );

    // Skip standalone flash execute highlights when a site execute exists for this round.
    const skipFlashExecute = siteExecuteRounds.has(flash.round);

    if (enemies >= 1) {
      if (!skipFlashExecute) {
        const partialNote =
          avgBlind > 0 && avgBlind < 0.5 ? " (partial flash)" : "";
        const title =
          teamKillsAfter.length > 0
            ? `Good execute — ${enemies} blinded, kill followed${partialNote}`
            : `Flash connected (${enemies}) but no follow-up kill${partialNote}`;
        const kind = teamKillsAfter.length > 0 ? "execute_good" : "execute_bad";
        highlights.push(
          makeHighlight({
            kind,
            round: flash.round,
            tick: flash.tick,
            title,
            detail: `${actorName} flashed ${enemies} enemy${enemies === 1 ? "" : "ies"} in round ${flash.round}.${teamKillsAfter.length > 0 ? ` ${teamKillsAfter[0]!.actorName ?? "Teammate"} got the kill.` : " Team did not trade on the blind."}`,
            score:
              (kind === "execute_good" ? 40 + enemies * 10 : 15) +
              Math.round(avgBlind * 10),
            actorSteamIds: actorId ? [actorId] : [],
            focusSteamId: actorId,
            enemyBlinds: enemies,
            tags:
              teamKillsAfter.length > 0
                ? ["execute", "follow_up", ...(avgBlind < 0.5 ? ["partial_flash"] : [])]
                : ["execute", "no_follow_up", ...(avgBlind < 0.5 ? ["partial_flash"] : [])],
            x: coords.x,
            y: coords.y,
          }),
        );
      }

      for (const blind of flash.blinds ?? []) {
        if (!actorTeam || blind.team === actorTeam) continue;
        const chainKill = killEvents.find(
          (k) =>
            k.round === flash.round &&
            k.tick > flash.tick &&
            k.tick <= flash.tick + tickRate * 3 &&
            k.targetSteamId === blind.steamId &&
            (k.actorTeam === actorTeam || k.actorSteamId === actorId),
        );
        if (chainKill) {
          highlights.push(
            makeHighlight({
              kind: "flash_chain",
              round: flash.round,
              tick: flash.tick,
              title: `Flash → kill on ${blind.name}`,
              detail: `${actorName}'s flash blinded ${blind.name}; ${chainKill.actorName ?? "teammate"} got the kill within 3s.`,
              score: 50,
              actorSteamIds: [actorId, chainKill.actorSteamId].filter(
                (id): id is string => Boolean(id),
              ),
              focusSteamId: chainKill.actorSteamId ?? actorId,
              enemyBlinds: 1,
              tags: ["flash_kill"],
              x: coords.x,
              y: coords.y,
            }),
          );
        }
      }
    } else {
      if (!skipFlashExecute) {
        const totalBlinds = flash.blinds?.length ?? 0;
        const detail =
          totalBlinds > 0
            ? `${actorName} only blinded teammates — no enemy value.`
            : `${actorName}'s flash hit nobody.`;
        highlights.push(
          makeHighlight({
            kind: "execute_bad",
            round: flash.round,
            tick: flash.tick,
            title: totalBlinds > 0 ? "Team-flash execute" : "Wasted flash",
            detail,
            score: 10,
            actorSteamIds: actorId ? [actorId] : [],
            focusSteamId: actorId,
            enemyBlinds: 0,
            tags: ["no_enemy_blind"],
            x: coords.x,
            y: coords.y,
          }),
        );
      }
    }

    if (enemies >= 1 && teamKillsAfter.length === 0) {
      const lateKill = killEvents.find(
        (k) =>
          k.round === flash.round &&
          k.tick > flash.tick + followWindow &&
          k.tick <= flash.tick + failWindow &&
          k.actorTeam === actorTeam,
      );
      if (!lateKill && enemies >= 1) {
        // already covered by execute_bad above when no follow-up
      }
    }
  }

  // Impact plays from kills
  const killsByRound = new Map<number, ReplayEvent[]>();
  for (const k of killEvents) {
    const list = killsByRound.get(k.round) ?? [];
    list.push(k);
    killsByRound.set(k.round, list);
  }

  for (const [round, kills] of killsByRound) {
    const byActor = new Map<string, ReplayEvent[]>();
    for (const k of kills) {
      if (!k.actorSteamId) continue;
      const list = byActor.get(k.actorSteamId) ?? [];
      list.push(k);
      byActor.set(k.actorSteamId, list);
    }

    for (const [actorId, actorKills] of byActor) {
      if (actorKills.length >= 2) {
        const first = actorKills[0]!;
        const coords = poseAtTick(replay.frames, first.tick, actorId) ?? {
          x: first.x,
          y: first.y,
        };
        highlights.push(
          makeHighlight({
            kind: "impact_play",
            round,
            tick: first.tick,
            title: `Multi-kill (${actorKills.length})`,
            detail: `${first.actorName ?? nameById.get(actorId) ?? "?"} got ${actorKills.length} kills in round ${round}.`,
            score: 30 + actorKills.length * 15,
            actorSteamIds: [actorId],
            focusSteamId: actorId,
            tags: ["multi_kill"],
            x: coords.x,
            y: coords.y,
          }),
        );
      }

      for (const kill of actorKills) {
        const actorTeam = kill.actorTeam ?? teamById.get(actorId);
        if (!actorTeam) continue;

        const priorFlash = flashEvents.find(
          (f) =>
            f.round === round &&
            f.tick < kill.tick &&
            kill.tick - f.tick <= tickRate * 5 &&
            f.actorTeam === actorTeam &&
            enemyBlindCountEvent(f) >= 1,
        );
        if (priorFlash) {
          const coords = poseAtTick(replay.frames, kill.tick, actorId) ?? {
            x: kill.x,
            y: kill.y,
          };
          highlights.push(
            makeHighlight({
              kind: "impact_play",
              round,
              tick: kill.tick,
              title: "Entry after flash",
              detail: `${kill.actorName ?? "?"} killed ${kill.targetName ?? "?"} shortly after a team flash.`,
              score: 45,
              actorSteamIds: [actorId],
              focusSteamId: actorId,
              tags: ["entry", "post_flash"],
              x: coords.x,
              y: coords.y,
            }),
          );
        }

        const alliesBefore = aliveCountAtTick(
          replay,
          kill.tick - 1,
          actorTeam,
        );
        const enemiesBefore = aliveCountAtTick(
          replay,
          kill.tick - 1,
          actorTeam === 3 ? 2 : 3,
        );
        if (enemiesBefore >= alliesBefore + 2) {
          highlights.push(
            makeHighlight({
              kind: "impact_play",
              round,
              tick: kill.tick,
              title: "Round swing kill",
              detail: `${kill.actorName ?? "?"} got a kill while down ${enemiesBefore - alliesBefore + 1} players.`,
              score: 35,
              actorSteamIds: [actorId],
              focusSteamId: actorId,
              tags: ["momentum", "swing"],
              x: kill.x,
              y: kill.y,
            }),
          );
        }
      }
    }

    const roundMeta = replay.rounds.find((r) => r.round === round);
    if (roundMeta?.mvpSteamId) {
      const mvpKills = kills.filter((k) => k.actorSteamId === roundMeta.mvpSteamId);
      if (mvpKills.length > 0) {
        const first = mvpKills[0]!;
        highlights.push(
          makeHighlight({
            kind: "impact_play",
            round,
            tick: first.tick,
            title: "Round MVP play",
            detail: `${nameById.get(roundMeta.mvpSteamId) ?? "?"} was round MVP with ${mvpKills.length} kill${mvpKills.length === 1 ? "" : "s"}.`,
            score: 25,
            actorSteamIds: [roundMeta.mvpSteamId],
            focusSteamId: roundMeta.mvpSteamId,
            tags: ["mvp"],
            x: first.x,
            y: first.y,
          }),
        );
      }
    }
  }

  for (const he of heEvents) {
    if ((he.damage ?? 0) >= 50) {
      highlights.push(
        makeHighlight({
          kind: "impact_play",
          round: he.round,
          tick: he.tick,
          title: `Big HE (${he.damage} dmg)`,
          detail: `${he.actorName ?? "?"}'s HE dealt ${he.damage} damage.`,
          score: 20 + Math.min(30, he.damage ?? 0),
          actorSteamIds: he.actorSteamId ? [he.actorSteamId] : [],
          focusSteamId: he.actorSteamId,
          tags: ["utility", "he"],
          x: he.x,
          y: he.y,
        }),
      );
    }
  }

  // Missed trades
  for (const kill of killEvents) {
    const victimId = kill.targetSteamId;
    const victimTeam = victimId ? teamById.get(victimId) : undefined;
    if (!victimTeam || !kill.actorSteamId) continue;
    const tradeWindow = tickRate * 2;
    const traded = killEvents.some(
      (k) =>
        k.round === kill.round &&
        k.tick > kill.tick &&
        k.tick <= kill.tick + tradeWindow &&
        k.actorTeam === victimTeam &&
        k.targetSteamId === kill.actorSteamId,
    );
    if (!traded) {
      highlights.push(
        makeHighlight({
          kind: "trade",
          round: kill.round,
          tick: kill.tick,
          title: "Missed trade",
          detail: `${kill.targetName ?? "?"} died to ${kill.actorName ?? "?"} with no trade within 2s.`,
          score: 12,
          actorSteamIds: victimId ? [victimId] : [],
          focusSteamId: victimId,
          tags: ["missed_trade"],
          x: kill.x,
          y: kill.y,
        }),
      );
    }
  }

  // Deduplicate similar highlights (same round/tick/kind)
  const seen = new Set<string>();
  const unique = highlights.filter((h) => {
    const key = `${h.kind}|${h.round}|${h.tick}|${h.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.sort((a, b) => b.score - a.score || a.round - b.round);
}
