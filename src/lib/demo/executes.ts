import type { CoachingHighlight, DemoReplay, PlayerStats } from "./types";
import {
  distanceToZone,
  isSiteZone,
  zoneAt,
  zoneCentroid,
  zonesForMap,
  type TacticalZoneId,
} from "./zones";
import { avgEnemyBlindPercent, enemyBlindCount } from "./flashBlinds";

export type SiteExecute = {
  round: number;
  commitTick: number;
  siteZoneId: TacticalZoneId;
  siteLabel: string;
  attackingTeam: number;
  fiveStack: boolean;
  playersInZone: number;
  plantTick?: number;
  plantSecondsFromFreeze?: number;
  freezeEndTick?: number;
  utilityCount: number;
  flashEnemyBlinds: number;
  avgBlindPercent: number;
  roundWon: boolean;
  bombPlanted: boolean;
  bombDefused: boolean;
  bombExploded: boolean;
  x: number;
  y: number;
};

function findFrameIndex(
  frames: DemoReplay["frames"],
  tick: number,
): number {
  let lo = 0;
  let hi = frames.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (frames[mid]!.tick <= tick) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

function playersInSiteAtTick(
  replay: DemoReplay,
  tick: number,
  team: number,
  siteZoneId: TacticalZoneId,
  nearRadius = 800,
): string[] {
  const i = findFrameIndex(replay.frames, tick);
  const frame = replay.frames[i];
  if (!frame) return [];

  const zones = zonesForMap(replay.mapName);
  const siteZone = zones.find((z) => z.id === siteZoneId);
  if (!siteZone) return [];

  const inZone: string[] = [];
  for (const p of frame.players) {
    if (!p.alive || p.team !== team) continue;
    const z = zoneAt(replay.mapName, p.x, p.y);
    if (z?.id === siteZoneId) {
      inZone.push(p.steamId);
      continue;
    }
    if (distanceToZone(p.x, p.y, siteZone) <= nearRadius) {
      inZone.push(p.steamId);
    }
  }
  return inZone;
}

function countUtilityBefore(
  replay: DemoReplay,
  round: number,
  siteZoneId: TacticalZoneId,
  beforeTick: number,
  windowTicks: number,
): number {
  let count = 0;
  for (const ev of replay.events) {
    if (ev.round !== round) continue;
    if (ev.tick > beforeTick || ev.tick < beforeTick - windowTicks) continue;
    if (!["flash", "smoke", "molotov", "he"].includes(ev.kind)) continue;
    const z = zoneAt(replay.mapName, ev.x, ev.y);
    if (z?.id === siteZoneId || z?.id === "connector") count += 1;
  }
  return count;
}

/**
 * Detect coordinated site executes per round from replay frames + bomb events.
 */
export function detectSiteExecutes(
  replay: DemoReplay | null,
  players: PlayerStats[],
): SiteExecute[] {
  if (!replay) return [];

  const tickRate = replay.tickRate;
  const commitWindow = tickRate * 12;
  const utilWindow = tickRate * 8;
  const executes: SiteExecute[] = [];

  const teamById = new Map(players.map((p) => [p.steamId, p.team]));

  for (const roundMeta of replay.rounds) {
    const { round, startTick, endTick, freezeEndTick, winnerTeam } = roundMeta;
    const freezeEnd = freezeEndTick ?? startTick + tickRate * 15;

    const plantEvent = replay.bombEvents?.find(
      (b) => b.round === round && b.kind === "planted",
    );
    const defused = replay.bombEvents?.some(
      (b) => b.round === round && b.kind === "defused",
    );
    const exploded = replay.bombEvents?.some(
      (b) => b.round === round && b.kind === "exploded",
    );

    let siteZoneId: TacticalZoneId | null = null;
    if (plantEvent?.siteZoneId && isSiteZone(plantEvent.siteZoneId as TacticalZoneId)) {
      siteZoneId = plantEvent.siteZoneId as TacticalZoneId;
    } else if (plantEvent) {
      const z = zoneAt(replay.mapName, plantEvent.x, plantEvent.y);
      if (z && isSiteZone(z.id)) siteZoneId = z.id;
    }

    if (!siteZoneId) {
      // Infer site from player clustering before plant or round end
      for (const site of ["a_site", "b_site"] as TacticalZoneId[]) {
        const atEnd = playersInSiteAtTick(
          replay,
          plantEvent?.tick ?? endTick - tickRate * 5,
          2,
          site,
        );
        if (atEnd.length >= 3) {
          siteZoneId = site;
          break;
        }
      }
    }

    if (!siteZoneId) continue;

    const siteLabel =
      siteZoneId === "a_site" ? "A Site" : siteZoneId === "b_site" ? "B Site" : siteZoneId;

    // T-side executes (team 2); also check CT retakes as team 3
    for (const attackingTeam of [2, 3] as const) {
      let commitTick: number | null = null;
      let maxInZone = 0;

      for (let t = freezeEnd; t <= endTick - tickRate; t += Math.round(tickRate / 2)) {
        const inZone = playersInSiteAtTick(replay, t, attackingTeam, siteZoneId);
        if (inZone.length >= 4 && inZone.length >= maxInZone) {
          maxInZone = inZone.length;
          commitTick = t;
        }
      }

      if (!commitTick || maxInZone < 4) continue;

      const aliveAttackers = players.filter(
        (p) => p.team === attackingTeam,
      ).length;
      const inZoneAtCommit = playersInSiteAtTick(
        replay,
        commitTick,
        attackingTeam,
        siteZoneId,
      );
      const fiveStack =
        inZoneAtCommit.length >= 5 ||
        (aliveAttackers >= 5 && inZoneAtCommit.length >= 4);

      const utilityCount = countUtilityBefore(
        replay,
        round,
        siteZoneId,
        commitTick,
        utilWindow,
      );

      const flashes = replay.events.filter(
        (e) =>
          e.kind === "flash" &&
          e.round === round &&
          e.tick >= commitTick - utilWindow &&
          e.tick <= commitTick + tickRate * 3 &&
          e.actorTeam === attackingTeam,
      );
      let flashEnemyBlinds = 0;
      let blindSum = 0;
      let blindN = 0;
      for (const f of flashes) {
        const n = enemyBlindCount(f.blinds, attackingTeam);
        flashEnemyBlinds += n;
        const avg = avgEnemyBlindPercent(f.blinds, attackingTeam);
        if (avg > 0) {
          blindSum += avg;
          blindN += 1;
        }
      }

      const plantTick = plantEvent?.tick;
      const plantSecondsFromFreeze =
        plantTick != null
          ? Math.round(((plantTick - freezeEnd) / tickRate) * 10) / 10
          : undefined;

      const zones = zonesForMap(replay.mapName);
      const siteZone = zones.find((z) => z.id === siteZoneId);
      const pose = inZoneAtCommit[0]
        ? replay.frames[findFrameIndex(replay.frames, commitTick)]?.players.find(
            (p) => p.steamId === inZoneAtCommit[0],
          )
        : null;

      executes.push({
        round,
        commitTick,
        siteZoneId,
        siteLabel,
        attackingTeam,
        fiveStack,
        playersInZone: inZoneAtCommit.length,
        plantTick,
        plantSecondsFromFreeze,
        freezeEndTick: freezeEnd,
        utilityCount,
        flashEnemyBlinds,
        avgBlindPercent: blindN > 0 ? blindSum / blindN : 0,
        roundWon: winnerTeam === attackingTeam,
        bombPlanted: Boolean(plantEvent),
        bombDefused: Boolean(defused),
        bombExploded: Boolean(exploded),
        x: plantEvent?.x ?? pose?.x ?? (siteZone ? zoneCentroid(siteZone).x : 0),
        y: plantEvent?.y ?? pose?.y ?? (siteZone ? zoneCentroid(siteZone).y : 0),
      });

      break; // one execute per round per detected site
    }
  }

  return executes;
}

let siteHlSeq = 0;

export function siteExecutesToHighlights(
  executes: SiteExecute[],
): CoachingHighlight[] {
  siteHlSeq = 0;
  const highlights: CoachingHighlight[] = [];

  for (const ex of executes) {
    siteHlSeq += 1;
    const siteShort = ex.siteZoneId === "a_site" ? "A" : "B";
    const stackLabel = ex.fiveStack ? "5-stack" : `${ex.playersInZone}-man`;
    const plantLabel =
      ex.plantSecondsFromFreeze != null
        ? `, plant @ +${ex.plantSecondsFromFreeze}s`
        : ex.bombPlanted
          ? ", planted"
          : "";

    const success =
      ex.roundWon ||
      (ex.bombPlanted && !ex.bombDefused && ex.bombExploded);

    const kind = success ? "execute_good" : "execute_bad";
    const partialTag =
      ex.avgBlindPercent > 0 && ex.avgBlindPercent < 0.5
        ? ["partial_flash"]
        : [];

    highlights.push({
      id: `site-ex-${siteHlSeq}`,
      kind,
      round: ex.round,
      tick: ex.commitTick,
      title: `${siteShort} execute — ${stackLabel}${plantLabel}`,
      detail: `Round ${ex.round}: ${ex.playersInZone} players committed to ${ex.siteLabel} with ${ex.utilityCount} utility piece${ex.utilityCount === 1 ? "" : "s"}${ex.flashEnemyBlinds > 0 ? `, ${ex.flashEnemyBlinds} enemy blind${ex.flashEnemyBlinds === 1 ? "" : "s"}` : ""}.${ex.roundWon ? " Round won." : ex.bombDefused ? " Bomb defused." : ex.bombPlanted ? " Plant failed to convert." : " No plant."}`,
      score:
        (success ? 55 : 20) +
        (ex.fiveStack ? 15 : 0) +
        Math.min(20, ex.utilityCount * 4) +
        Math.round(ex.avgBlindPercent * 15),
      actorSteamIds: [],
      enemyBlinds: ex.flashEnemyBlinds,
      tags: [
        "site_execute",
        ex.siteZoneId,
        ...(ex.fiveStack ? ["five_stack"] : []),
        ...(ex.plantSecondsFromFreeze != null ? ["plant_timing"] : []),
        ...partialTag,
      ],
      x: ex.x,
      y: ex.y,
    });
  }

  return highlights;
}
