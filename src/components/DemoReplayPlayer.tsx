"use client";

import {
  forwardRef,
  startTransition,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type {
  DemoReplay,
  ReplayEvent,
  ReplayEventKind,
  ReplayPlayerPose,
} from "@/lib/demo";
import {
  getRadarCalibration,
  MOLLY_COVER_RADIUS,
  SMOKE_COVER_RADIUS,
  worldRadiusToRadarPercent,
  worldToRadarPercent,
  type RadarCalibration,
} from "@/lib/demo/radar";
import { mapDisplayName } from "@/lib/maps";
import { DemoRoundTimeline } from "@/components/DemoRoundTimeline";
import { NadeEffectOverlay } from "@/components/NadeEffectOverlay";

type Props = {
  replay: DemoReplay;
  mapName?: string;
};

export type DemoReplayJumpTarget = {
  tick: number;
  focusSteamId?: string;
  zoom?: boolean;
  x?: number;
  y?: number;
  /** Follow nade flight / impact instead of only the player. Default true. */
  followAction?: boolean;
};

export type DemoReplayHandle = {
  jumpTo: (target: DemoReplayJumpTarget) => void;
};

/** Camera path for a utility throw or impact play. */
type ActionFollow = {
  kind: ReplayEventKind;
  throwTick: number;
  popTick: number;
  throwX: number;
  throwY: number;
  popX: number;
  popY: number;
  holdTicks: number;
  focusSteamId?: string;
  targetSteamId?: string;
  /** Blinded players — camera holds on their cluster after a flash pops. */
  blindSteamIds?: string[];
};

function blindInfoForPlayer(
  steamId: string,
  activeOverlays: ReplayEvent[],
  tick: number,
  tickRate: number,
): { blinded: boolean; enemyFlash: boolean; blindPercent: number } {
  for (const ev of activeOverlays) {
    if (ev.kind !== "flash") continue;
    const blind = ev.blinds?.find((b) => b.steamId === steamId);
    if (!blind) continue;
    const elapsedSec = (tick - ev.tick) / Math.max(1, tickRate);
    if (blind.duration > 0 && elapsedSec > blind.duration) continue;
    const enemyFlash =
      Boolean(ev.actorTeam) && blind.team > 0 && blind.team !== ev.actorTeam;
    const blindPercent = blind.blindPercent ?? (blind.duration > 0 ? Math.min(1, blind.duration / 2.5) : 1);
    return { blinded: true, enemyFlash, blindPercent };
  }
  return { blinded: false, enemyFlash: false, blindPercent: 0 };
}

const KIND_META: Record<
  ReplayEventKind,
  { color: string; label: string; mapRadius: number }
> = {
  kill: { color: "#e05a4f", label: "Kill", mapRadius: 9 },
  flash: { color: "#f5e6a3", label: "Flash", mapRadius: 28 },
  he: { color: "#e8a838", label: "HE", mapRadius: 14 },
  smoke: { color: "#9aa3ad", label: "Smoke", mapRadius: 32 },
  molotov: { color: "#e07040", label: "Molly", mapRadius: 22 },
};

function findFrameIndex(frames: DemoReplay["frames"], tick: number): number {
  let lo = 0;
  let hi = frames.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (frames[mid]!.tick <= tick) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

function poseAt(
  frames: DemoReplay["frames"],
  tick: number,
  steamId: string,
): { x: number; y: number } | null {
  if (frames.length === 0) return null;
  const i = findFrameIndex(frames, tick);
  const pose = frames[i]?.players.find((p) => p.steamId === steamId);
  return pose ? { x: pose.x, y: pose.y } : null;
}

function buildActionFollow(
  ev: ReplayEvent,
  tickRate: number,
): ActionFollow {
  const isNade = ev.kind !== "kill";
  const popX = ev.x;
  const popY = ev.y;
  const throwX = ev.throwX ?? popX;
  const throwY = ev.throwY ?? popY;
  const throwTick =
    ev.throwTick ??
    (isNade ? ev.tick - Math.round(tickRate * 1.2) : ev.tick);
  const holdSec = ev.kind === "flash" ? 2.5 : ev.kind === "kill" ? 1.5 : 2;
  return {
    kind: ev.kind,
    throwTick,
    popTick: ev.tick,
    throwX,
    throwY,
    popX,
    popY,
    holdTicks: Math.round(tickRate * holdSec),
    focusSteamId: ev.actorSteamId,
    targetSteamId: ev.targetSteamId,
    blindSteamIds:
      ev.kind === "flash"
        ? (ev.blinds ?? []).map((b) => b.steamId).filter(Boolean)
        : undefined,
  };
}

/** World focus point for the action camera at the current tick. */
function actionFocusAtTick(
  action: ActionFollow,
  tick: number,
  frames: DemoReplay["frames"],
): { x: number; y: number } {
  if (tick < action.throwTick) {
    if (action.focusSteamId) {
      const p = poseAt(frames, tick, action.focusSteamId);
      if (p) return p;
    }
    return { x: action.throwX, y: action.throwY };
  }

  if (tick < action.popTick) {
    const span = Math.max(1, action.popTick - action.throwTick);
    const t = (tick - action.throwTick) / span;
    return {
      x: action.throwX + (action.popX - action.throwX) * t,
      y: action.throwY + (action.popY - action.throwY) * t,
    };
  }

  const afterPop = tick - action.popTick;
  if (afterPop <= action.holdTicks) {
    if (action.kind === "kill" && action.targetSteamId) {
      const victim = poseAt(frames, tick, action.targetSteamId);
      if (victim) return victim;
    }
    if (action.blindSteamIds && action.blindSteamIds.length > 0) {
      const points: { x: number; y: number }[] = [];
      for (const id of action.blindSteamIds) {
        const p = poseAt(frames, tick, id);
        if (p) points.push(p);
      }
      if (points.length > 0) {
        // Blend pop location with blinded cluster so we track the fight.
        const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
        const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
        const blend = Math.min(1, afterPop / Math.max(1, action.holdTicks * 0.35));
        return {
          x: action.popX + (cx - action.popX) * blend,
          y: action.popY + (cy - action.popY) * blend,
        };
      }
    }
    return { x: action.popX, y: action.popY };
  }

  // Aftermath: follow the actor (or victim for kills).
  const followId =
    action.kind === "kill"
      ? (action.focusSteamId ?? action.targetSteamId)
      : action.focusSteamId;
  if (followId) {
    const p = poseAt(frames, tick, followId);
    if (p) return p;
  }
  return { x: action.popX, y: action.popY };
}

function findActionNearTick(
  replay: DemoReplay,
  tick: number,
  focusSteamId?: string,
): ReplayEvent | null {
  const window = Math.max(32, Math.round(replay.tickRate * 2.5));
  const candidates = replay.events.filter(
    (e) => Math.abs(e.tick - tick) <= window,
  );
  if (candidates.length === 0) return null;

  const scored = candidates.map((e) => {
    let score = -Math.abs(e.tick - tick);
    if (focusSteamId && e.actorSteamId === focusSteamId) score += 40;
    if (focusSteamId && e.targetSteamId === focusSteamId) score += 20;
    if (e.kind === "flash") score += 15;
    else if (e.kind === "he" || e.kind === "molotov") score += 10;
    else if (e.kind === "smoke") score += 5;
    else if (e.kind === "kill") score += 8;
    return { e, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.e ?? null;
}

function shortestYawDelta(from: number, to: number): number {
  let d = ((to - from + 540) % 360) - 180;
  if (d < -180) d += 360;
  return d;
}

function interpolatePlayers(
  a: ReplayPlayerPose[],
  b: ReplayPlayerPose[],
  t: number,
): ReplayPlayerPose[] {
  const byId = new Map(b.map((p) => [p.steamId, p]));
  return a.map((pa) => {
    const pb = byId.get(pa.steamId);
    if (!pb) return pa;
    return {
      steamId: pa.steamId,
      team: pb.team || pa.team,
      alive: t < 0.5 ? pa.alive : pb.alive,
      x: pa.x + (pb.x - pa.x) * t,
      y: pa.y + (pb.y - pa.y) * t,
      yaw: pa.yaw + shortestYawDelta(pa.yaw, pb.yaw) * t,
    };
  });
}

function formatClock(tick: number, tickRate: number, startTick: number): string {
  const sec = Math.max(0, (tick - startTick) / tickRate);
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function enemyBlindCount(ev: ReplayEvent): number {
  if (!ev.blinds?.length) return 0;
  if (!ev.actorTeam) return ev.blinds.length;
  return ev.blinds.filter((b) => b.team > 0 && b.team !== ev.actorTeam).length;
}

function flashCoachHint(ev: ReplayEvent): string | null {
  if (ev.kind !== "flash") return null;
  const enemies = enemyBlindCount(ev);
  const total = ev.blinds?.length ?? 0;
  if (enemies === 0 && total === 0) return "Flash hit nobody";
  if (enemies === 0 && total > 0) return "Flash only hit teammates";
  return null;
}

function fallbackPercent(
  p: ReplayPlayerPose,
  all: ReplayPlayerPose[],
): { left: number; top: number } {
  const xs = all.map((x) => x.x);
  const ys = all.map((x) => x.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const dx = Math.max(maxX - minX, 200);
  const dy = Math.max(maxY - minY, 200);
  return {
    left: ((p.x - minX) / dx) * 80 + 10,
    top: (1 - (p.y - minY) / dy) * 80 + 10,
  };
}

function eventPos(
  ev: Pick<ReplayEvent, "x" | "y">,
  cal: RadarCalibration | null,
  poses: ReplayPlayerPose[],
): { left: number; top: number } {
  if (cal) return worldToRadarPercent(ev.x, ev.y, cal);
  if (poses.length === 0) return { left: 50, top: 50 };
  return fallbackPercent({ ...poses[0]!, x: ev.x, y: ev.y }, [
    ...poses,
    { ...poses[0]!, x: ev.x, y: ev.y },
  ]);
}

function throwPos(
  ev: ReplayEvent,
  cal: RadarCalibration | null,
  poses: ReplayPlayerPose[],
): { left: number; top: number } | null {
  if (ev.throwX == null || ev.throwY == null) return null;
  return eventPos({ x: ev.throwX, y: ev.throwY }, cal, poses);
}

export const DemoReplayPlayer = forwardRef<DemoReplayHandle, Props>(
  function DemoReplayPlayer({ replay, mapName }, ref) {
  const resolvedMap = mapName || replay.mapName;
  const cal = useMemo(
    () =>
      getRadarCalibration(resolvedMap) ??
      getRadarCalibration(replay.mapName),
    [resolvedMap, replay.mapName],
  );

  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [tick, setTick] = useState(replay.startTick);
  const [roundIdx, setRoundIdx] = useState(0);
  const [radarSrc, setRadarSrc] = useState<"local" | "alt" | "none">("local");
  const [focusSteamId, setFocusSteamId] = useState(
    () =>
      replay.players.reduce<{ id: string; kills: number } | null>((best, p) => {
        const kills = replay.events.filter(
          (e) => e.kind === "kill" && e.actorSteamId === p.steamId,
        ).length;
        if (!best || kills > best.kills) return { id: p.steamId, kills };
        return best;
      }, null)?.id ??
      replay.players[0]?.steamId ??
      "",
  );
  const [actionZoom, setActionZoom] = useState(false);
  const [followFocus, setFollowFocus] = useState(false);
  const [actionFollow, setActionFollow] = useState<ActionFollow | null>(null);
  const [zoomOrigin, setZoomOrigin] = useState({ left: 50, top: 50 });
  const [draggingMap, setDraggingMap] = useState(false);
  const [hoveredPlayerId, setHoveredPlayerId] = useState<string | null>(null);
  const mapStageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originLeft: number;
    originTop: number;
  } | null>(null);
  const lastEventIdx = useRef(-1);
  const rafRef = useRef<number | null>(null);
  const lastTs = useRef<number | null>(null);
  const playingRef = useRef(false);
  const tickRef = useRef(replay.startTick);
  const endTickRef = useRef(replay.endTick);
  const speedRef = useRef(speed);

  const ZOOM_SCALE = 2.25;

  useEffect(() => {
    setRadarSrc(cal ? "local" : "none");
  }, [cal]);

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of replay.players) m.set(p.steamId, p.name);
    return m;
  }, [replay.players]);

  const currentRound = replay.rounds[roundIdx] ?? null;

  playingRef.current = playing;
  tickRef.current = tick;
  speedRef.current = speed;
  endTickRef.current = currentRound?.endTick ?? replay.endTick;

  const { poses, frameTick } = useMemo(() => {
    const frames = replay.frames;
    if (frames.length === 0) {
      return { poses: [] as ReplayPlayerPose[], frameTick: tick };
    }
    const i = findFrameIndex(frames, tick);
    const a = frames[i]!;
    const b = frames[Math.min(i + 1, frames.length - 1)]!;
    if (a.tick === b.tick || tick <= a.tick) {
      return { poses: a.players, frameTick: a.tick };
    }
    const t = Math.min(1, Math.max(0, (tick - a.tick) / (b.tick - a.tick)));
    return {
      poses: interpolatePlayers(a.players, b.players, t),
      frameTick: tick,
    };
  }, [replay.frames, tick]);

  // Camera: follow nade flight / impact, then the focused player.
  useEffect(() => {
    if (!actionZoom || !cal || draggingMap) return;

    if (actionFollow) {
      const focus = actionFocusAtTick(actionFollow, tick, replay.frames);
      const next = worldToRadarPercent(focus.x, focus.y, cal);
      setZoomOrigin((prev) => {
        if (
          Math.abs(prev.left - next.left) < 0.12 &&
          Math.abs(prev.top - next.top) < 0.12
        ) {
          return prev;
        }
        return next;
      });
      return;
    }

    if (!followFocus || !focusSteamId) return;
    const pose = poses.find((p) => p.steamId === focusSteamId);
    if (!pose || (!pose.alive && pose.x === 0 && pose.y === 0)) return;
    const next = worldToRadarPercent(pose.x, pose.y, cal);
    setZoomOrigin((prev) => {
      if (
        Math.abs(prev.left - next.left) < 0.15 &&
        Math.abs(prev.top - next.top) < 0.15
      ) {
        return prev;
      }
      return next;
    });
  }, [
    actionZoom,
    actionFollow,
    followFocus,
    cal,
    focusSteamId,
    tick,
    draggingMap,
    poses,
    replay.frames,
  ]);

  const activeOverlays = useMemo(() => {
    return replay.events.filter((ev) => {
      const dur = ev.durationTicks ?? Math.round(replay.tickRate * 2);
      return tick >= ev.tick && tick <= ev.tick + dur;
    });
  }, [replay.events, replay.tickRate, tick]);

  const feedEvents = useMemo(() => {
    return replay.events
      .filter((e) => e.tick <= tick)
      .slice(-14)
      .reverse();
  }, [replay.events, tick]);

  const aliveCt = poses.filter((p) => p.alive && p.team === 3).length;
  const aliveT = poses.filter((p) => p.alive && p.team === 2).length;

  useEffect(() => {
    if (replay.rounds.length === 0) return;
    const idx = replay.rounds.findIndex(
      (r) => tick >= r.startTick && tick <= r.endTick,
    );
    if (idx >= 0 && idx !== roundIdx) setRoundIdx(idx);
  }, [tick, replay.rounds, roundIdx]);

  useEffect(() => {
    let idx = -1;
    for (let i = 0; i < replay.events.length; i++) {
      if (replay.events[i]!.tick <= tick) idx = i;
      else break;
    }
    lastEventIdx.current = idx;
  }, [tick, replay.events]);

  // Cleanup playback on unmount only — loop is started from event handlers,
  // not from an effect (avoids React update-depth storms with rAF + setState).
  useEffect(() => {
    return () => {
      playingRef.current = false;
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  function stopPlayback() {
    playingRef.current = false;
    setPlaying(false);
    lastTs.current = null;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }

  function startPlayback() {
    // Restart cleanly if a loop is already running (e.g. Watch while playing).
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastTs.current = null;

    const end = endTickRef.current;
    if (tickRef.current >= end) {
      const start = currentRound?.startTick ?? replay.startTick;
      tickRef.current = start;
      setTick(start);
    }
    playingRef.current = true;
    setPlaying(true);
    const tickRate = replay.tickRate || 64;

    const step = (ts: number) => {
      if (!playingRef.current) return;

      if (lastTs.current == null) lastTs.current = ts;
      const dt = Math.min(0.05, (ts - lastTs.current) / 1000);
      lastTs.current = ts;
      if (dt <= 0) {
        rafRef.current = requestAnimationFrame(step);
        return;
      }

      const endNow = endTickRef.current;
      const prev = tickRef.current;
      if (prev >= endNow) {
        stopPlayback();
        return;
      }

      const next = Math.min(endNow, prev + dt * tickRate * speedRef.current);
      tickRef.current = next;
      startTransition(() => {
        setTick(next);
      });

      if (next >= endNow) {
        stopPlayback();
        return;
      }
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
  }

  function togglePlayback() {
    if (playingRef.current) stopPlayback();
    else startPlayback();
  }

  function roundIndexForTick(at: number): number {
    const exact = replay.rounds.findIndex(
      (r) => at >= r.startTick && at <= r.endTick,
    );
    if (exact >= 0) return exact;
    let best = 0;
    for (let i = 0; i < replay.rounds.length; i++) {
      if (replay.rounds[i]!.startTick <= at) best = i;
    }
    return best;
  }

  function jumpToRound(idx: number) {
    const r = replay.rounds[idx];
    if (!r) return;
    stopPlayback();
    setRoundIdx(idx);
    setTick(r.startTick);
    tickRef.current = r.startTick;
    endTickRef.current = r.endTick;
  }

  function jumpToEvent(ev: ReplayEvent) {
    const idx = roundIndexForTick(ev.tick);
    const round = replay.rounds[idx];
    if (idx >= 0) {
      setRoundIdx(idx);
      if (round) endTickRef.current = round.endTick;
    }
    const lead = Math.round(replay.tickRate * 1.5);
    const action = buildActionFollow(ev, replay.tickRate || 64);
    let startAt = Math.max(
      replay.startTick,
      Math.min(ev.tick - lead, action.throwTick - Math.round(replay.tickRate * 0.4)),
    );
    if (round) {
      startAt = Math.min(startAt, Math.max(round.startTick, round.endTick - 1));
      startAt = Math.max(startAt, round.startTick);
    }
    setTick(startAt);
    tickRef.current = startAt;
    if (ev.actorSteamId) setFocusSteamId(ev.actorSteamId);
    setActionFollow(action);
    setFollowFocus(true);
    setActionZoom(true);
    if (cal) {
      const focus = actionFocusAtTick(action, startAt, replay.frames);
      setZoomOrigin(worldToRadarPercent(focus.x, focus.y, cal));
    }
    startPlayback();
  }

  function jumpToTarget(target: DemoReplayJumpTarget) {
    const idx = roundIndexForTick(target.tick);
    const round = replay.rounds[idx];
    if (idx >= 0) {
      setRoundIdx(idx);
      if (round) endTickRef.current = round.endTick;
    }

    const preferAction = target.followAction !== false;
    const actionEvent = preferAction
      ? findActionNearTick(replay, target.tick, target.focusSteamId)
      : null;
    const action = actionEvent
      ? buildActionFollow(actionEvent, replay.tickRate || 64)
      : null;

    const lead = Math.round(replay.tickRate * 1.5);
    let startAt = Math.max(replay.startTick, target.tick - lead);
    if (action) {
      startAt = Math.min(
        startAt,
        Math.max(
          replay.startTick,
          action.throwTick - Math.round((replay.tickRate || 64) * 0.4),
        ),
      );
    }
    if (round) {
      startAt = Math.min(startAt, Math.max(round.startTick, round.endTick - 1));
      startAt = Math.max(startAt, round.startTick);
    }
    setTick(startAt);
    tickRef.current = startAt;

    if (target.focusSteamId) setFocusSteamId(target.focusSteamId);
    else if (action?.focusSteamId) setFocusSteamId(action.focusSteamId);

    setActionFollow(action);
    setFollowFocus(true);

    if (target.zoom !== false) {
      setActionZoom(true);
      if (cal) {
        if (action) {
          const focus = actionFocusAtTick(action, startAt, replay.frames);
          setZoomOrigin(worldToRadarPercent(focus.x, focus.y, cal));
        } else if (target.focusSteamId) {
          const pose = poseAt(replay.frames, target.tick, target.focusSteamId);
          if (pose) setZoomOrigin(worldToRadarPercent(pose.x, pose.y, cal));
          else if (target.x != null && target.y != null) {
            setZoomOrigin(worldToRadarPercent(target.x, target.y, cal));
          }
        } else if (target.x != null && target.y != null) {
          setZoomOrigin(worldToRadarPercent(target.x, target.y, cal));
        }
      }
    }
    startPlayback();
    mapStageRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  useImperativeHandle(ref, () => ({
    jumpTo: jumpToTarget,
  }));

  function onMapPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    e.preventDefault();
    // Manual pan takes over from auto-follow.
    setFollowFocus(false);
    setActionFollow(null);
    if (!actionZoom) setActionZoom(true);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originLeft: zoomOrigin.left,
      originTop: zoomOrigin.top,
    };
    setDraggingMap(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onMapPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const rect = mapStageRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    // Drag map content with the pointer (origin moves opposite to finger).
    const dx = ((e.clientX - drag.startX) / rect.width) * 100 / ZOOM_SCALE;
    const dy = ((e.clientY - drag.startY) / rect.height) * 100 / ZOOM_SCALE;
    setZoomOrigin({
      left: Math.min(95, Math.max(5, drag.originLeft - dx)),
      top: Math.min(95, Math.max(5, drag.originTop - dy)),
    });
  }

  function onMapPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setDraggingMap(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  }

  const rangeStart = currentRound?.startTick ?? replay.startTick;
  const rangeEnd = currentRound?.endTick ?? replay.endTick;
  const hasRadar = Boolean(cal && radarSrc !== "none");

  return (
    <section className="overflow-hidden border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex flex-col gap-2 border-b border-[var(--border)] bg-[var(--bg-elevated)]/50 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-[0.18em] text-[var(--amber)]">
            Radar replay
          </h3>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Watch utility landings, blinds, and kills — coaching view, not GOTV.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-[var(--muted)]">
            Speed
            <select
              className="ml-2 border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--foreground)]"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
            >
              <option value={0.5}>0.5×</option>
              <option value={1}>1×</option>
              <option value={2}>2×</option>
              <option value={4}>4×</option>
            </select>
          </label>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_280px]">
        {/* Map stage */}
        <div className="relative border-b border-[var(--border)] p-4 lg:border-b-0 lg:border-r">
          <div
            ref={mapStageRef}
            className={`relative mx-auto aspect-square w-full max-w-[560px] overflow-hidden border border-[var(--border)] bg-[#07090b] shadow-[inset_0_0_60px_rgba(0,0,0,0.45)] touch-none select-none ${
              draggingMap ? "cursor-grabbing" : "cursor-grab"
            }`}
            onPointerDown={onMapPointerDown}
            onPointerMove={onMapPointerMove}
            onPointerUp={onMapPointerUp}
            onPointerCancel={onMapPointerUp}
          >
            <div
              className={`pointer-events-none absolute inset-0 ease-out ${
                draggingMap
                  ? ""
                  : followFocus && actionZoom
                    ? "transition-[transform-origin] duration-75"
                    : "transition-transform duration-300"
              }`}
              style={
                actionZoom
                  ? {
                      transform: `scale(${ZOOM_SCALE})`,
                      transformOrigin: `${zoomOrigin.left}% ${zoomOrigin.top}%`,
                    }
                  : undefined
              }
            >
            {hasRadar && cal ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={radarSrc === "local" ? cal.radarUrl : cal.radarUrlAlt}
                alt={`${mapDisplayName(resolvedMap)} radar`}
                className="h-full w-full object-cover opacity-[0.42] brightness-[0.85] contrast-[0.9]"
                onError={() => {
                  if (radarSrc === "local") setRadarSrc("alt");
                  else setRadarSrc("none");
                }}
              />
            ) : (
              <div
                aria-hidden
                className="absolute inset-0 opacity-35"
                style={{
                  backgroundImage:
                    "linear-gradient(rgba(42,51,61,0.95) 1px, transparent 1px), linear-gradient(90deg, rgba(42,51,61,0.95) 1px, transparent 1px)",
                  backgroundSize: "36px 36px",
                }}
              />
            )}

            {/* Persistent utility / kill overlays */}
            {activeOverlays.map((ev, i) => {
              const meta = KIND_META[ev.kind];
              const pos = eventPos(ev, hasRadar ? cal : null, poses);
              const from = throwPos(ev, hasRadar ? cal : null, poses);
              const age = Math.min(
                1,
                (tick - ev.tick) / Math.max(1, ev.durationTicks ?? 1),
              );
              const isNade = ev.kind !== "kill";
              // Throw → pop guide only for the first ~2.5s so long smokes stay readable.
              const showThrowGuide =
                isNade &&
                from &&
                (tick - ev.tick) / Math.max(1, replay.tickRate) < 2.5;
              const showPopLabel = actionZoom && isNade;

              return (
                <div key={`ov-${ev.kind}-${ev.tick}-${i}`}>
                  {/* Throw origin → explosion arc */}
                  {showThrowGuide && from ? (
                    <>
                      <svg
                        className="pointer-events-none absolute inset-0 z-[2] h-full w-full"
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                      >
                        <defs>
                          <marker
                            id={`arrow-${ev.kind}-${ev.tick}-${i}`}
                            markerWidth="4"
                            markerHeight="4"
                            refX="3"
                            refY="2"
                            orient="auto"
                          >
                            <path d="M0,0 L4,2 L0,4 Z" fill={meta.color} />
                          </marker>
                        </defs>
                        <line
                          x1={from.left}
                          y1={from.top}
                          x2={pos.left}
                          y2={pos.top}
                          stroke={meta.color}
                          strokeWidth="0.85"
                          strokeOpacity={0.85}
                          strokeDasharray="2.2 1.4"
                          markerEnd={`url(#arrow-${ev.kind}-${ev.tick}-${i})`}
                        />
                      </svg>
                      {/* Throw marker */}
                      <div
                        className="pointer-events-none absolute z-[3] -translate-x-1/2 -translate-y-1/2"
                        style={{ left: `${from.left}%`, top: `${from.top}%` }}
                        title={`${meta.label} thrown from here`}
                      >
                        <div
                          className="h-2.5 w-2.5 rotate-45 border-2 bg-black/40"
                          style={{ borderColor: meta.color }}
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-black/65 px-1 py-px text-[8px] uppercase tracking-wide text-[var(--foreground)]">
                          Throw
                        </span>
                      </div>
                    </>
                  ) : null}

                  {/* Detonation / impact effect */}
                  {isNade ? (
                    <NadeEffectOverlay
                      ev={ev}
                      left={pos.left}
                      top={pos.top}
                      age={age}
                      totalSec={
                        ev.durationTicks != null
                          ? ev.durationTicks / Math.max(1, replay.tickRate)
                          : undefined
                      }
                      remainSec={
                        ev.kind === "smoke" ||
                        ev.kind === "molotov" ||
                        ev.kind === "flash"
                          ? Math.max(
                              0,
                              ((ev.durationTicks ?? 0) - (tick - ev.tick)) /
                                Math.max(1, replay.tickRate),
                            )
                          : undefined
                      }
                      coverRadiusPct={
                        hasRadar && cal
                          ? ev.kind === "smoke"
                            ? Math.max(
                                7,
                                worldRadiusToRadarPercent(
                                  SMOKE_COVER_RADIUS,
                                  cal,
                                ) * 2.2,
                              )
                            : ev.kind === "molotov"
                              ? Math.max(
                                  5.5,
                                  worldRadiusToRadarPercent(
                                    MOLLY_COVER_RADIUS,
                                    cal,
                                  ) * 2.0,
                                )
                              : undefined
                          : ev.kind === "smoke"
                            ? 8
                            : ev.kind === "molotov"
                              ? 6.5
                              : undefined
                      }
                    />
                  ) : (
                    <div
                      className="pointer-events-none absolute z-[2] -translate-x-1/2 -translate-y-1/2 rounded-full"
                      style={{
                        left: `${pos.left}%`,
                        top: `${pos.top}%`,
                        width: meta.mapRadius * 2,
                        height: meta.mapRadius * 2,
                        background: meta.color,
                        opacity: 0.55 * (1 - age * 0.85),
                      }}
                      title="Kill"
                    />
                  )}

                  {showPopLabel ? (
                    <span
                      className="pointer-events-none absolute z-[3] -translate-x-1/2 whitespace-nowrap rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-[var(--foreground)]"
                      style={{
                        left: `${pos.left}%`,
                        top: `${Math.min(96, pos.top + 4.5)}%`,
                      }}
                    >
                      {ev.kind === "flash"
                        ? enemyBlindCount(ev) > 0
                          ? `Flash · blind ${enemyBlindCount(ev)}`
                          : flashCoachHint(ev) ?? "Flash"
                        : meta.label}
                    </span>
                  ) : null}

                  {/* Flash → blinded player lines (only while still blinded) */}
                  {ev.kind === "flash" &&
                    ev.blinds?.map((b) => {
                      const elapsedSec =
                        (tick - ev.tick) / Math.max(1, replay.tickRate);
                      if (b.duration > 0 && elapsedSec > b.duration) return null;
                      const victim = poses.find((p) => p.steamId === b.steamId);
                      if (!victim) return null;
                      const vp =
                        hasRadar && cal
                          ? worldToRadarPercent(victim.x, victim.y, cal)
                          : fallbackPercent(victim, poses);
                      const useful =
                        !ev.actorTeam ||
                        (b.team > 0 && b.team !== ev.actorTeam);
                      return (
                        <svg
                          key={`blink-${ev.tick}-${b.steamId}`}
                          className="pointer-events-none absolute inset-0 z-[2] h-full w-full"
                          viewBox="0 0 100 100"
                          preserveAspectRatio="none"
                        >
                          <line
                            x1={pos.left}
                            y1={pos.top}
                            x2={vp.left}
                            y2={vp.top}
                            stroke={
                              useful
                                ? "rgba(245,230,163,0.75)"
                                : "rgba(224,90,79,0.55)"
                            }
                            strokeWidth="0.7"
                            strokeDasharray="2 1.2"
                          />
                        </svg>
                      );
                    })}
                </div>
              );
            })}

            {/* Players */}
            {poses.map((p) => {
              const pos =
                hasRadar && cal
                  ? worldToRadarPercent(p.x, p.y, cal)
                  : fallbackPercent(p, poses);
              if (
                pos.left < -8 ||
                pos.left > 108 ||
                pos.top < -8 ||
                pos.top > 108
              ) {
                return null;
              }
              const isCt = p.team === 3;
              const name = nameById.get(p.steamId) ?? p.steamId;
              const blindInfo = blindInfoForPlayer(
                p.steamId,
                activeOverlays,
                tick,
                replay.tickRate,
              );
              return (
                <div
                  key={p.steamId}
                  className="pointer-events-auto absolute z-[20]"
                  style={{ left: `${pos.left}%`, top: `${pos.top}%` }}
                  onPointerEnter={() => setHoveredPlayerId(p.steamId)}
                  onPointerLeave={() =>
                    setHoveredPlayerId((id) => (id === p.steamId ? null : id))
                  }
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  {/*
                    Source yaw: 0 = +X (east), 90 = +Y (north).
                    Radar Y is flipped, and the tip defaults to screen-up,
                    so CSS rotation is (90 - yaw).
                  */}
                  <div
                    className={`relative h-4 w-4 rounded-full border border-black/60 shadow ${
                      !p.alive
                        ? "bg-[var(--muted)] opacity-30"
                        : isCt
                          ? "bg-sky-400"
                          : "bg-[var(--amber)]"
                    } ${blindInfo.blinded ? "ring-2 ring-[var(--amber-bright)]" : ""} ${
                      hoveredPlayerId === p.steamId ? "ring-2 ring-white/80" : ""
                    }`}
                    style={{
                      transform: `translate(-50%, -50%) rotate(${90 - p.yaw}deg)`,
                      opacity: blindInfo.blinded
                        ? 0.45 + blindInfo.blindPercent * 0.55
                        : 1,
                    }}
                  >
                    <span
                      aria-hidden
                      className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-[95%]"
                      style={{
                        width: 0,
                        height: 0,
                        borderLeft: "3.5px solid transparent",
                        borderRight: "3.5px solid transparent",
                        borderBottom: "7px solid rgba(255,255,255,0.92)",
                        filter: "drop-shadow(0 0 1px rgba(0,0,0,0.85))",
                      }}
                    />
                  </div>
                  {blindInfo.blinded && p.alive ? (
                    <span
                      className={`absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-bold shadow ${
                        blindInfo.enemyFlash
                          ? "bg-[var(--danger)] text-white"
                          : "bg-[var(--amber)] text-black"
                      }`}
                    >
                      ✦
                    </span>
                  ) : null}
                  {p.alive && hoveredPlayerId !== p.steamId ? (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-black/55 px-1 py-px text-[9px] font-medium text-[var(--foreground)]">
                      {initials(name)}
                    </span>
                  ) : null}
                  {hoveredPlayerId === p.steamId ? (
                    <span className="absolute left-3 top-1/2 z-30 -translate-y-1/2 whitespace-nowrap rounded border border-[var(--border)] bg-black/90 px-1.5 py-0.5 text-[11px] font-medium text-[var(--foreground)] shadow-lg">
                      {name}
                      {!p.alive ? (
                        <span className="ml-1 text-[var(--muted)]">dead</span>
                      ) : null}
                      {blindInfo.blinded && p.alive ? (
                        <span className="ml-1 text-[var(--amber-bright)]">
                          · {Math.round(blindInfo.blindPercent * 100)}% blind
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                </div>
              );
            })}

            <div className="absolute left-2 top-2 z-10 flex flex-wrap gap-1.5">
              <span className="rounded bg-black/65 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[var(--foreground)]">
                {hasRadar
                  ? `${mapDisplayName(resolvedMap)} minimap`
                  : `${mapDisplayName(resolvedMap)} · no map image`}
              </span>
              <span className="rounded bg-black/65 px-1.5 py-0.5 font-[family-name:var(--font-code)] text-[10px] text-[var(--muted)]">
                <span className="text-sky-400">{aliveCt} CT</span>
                {" · "}
                <span className="text-[var(--amber)]">{aliveT} T</span>
              </span>
            </div>

            {/* Mini kill feed overlay on map */}
            <div className="pointer-events-none absolute right-2 top-2 z-10 flex max-w-[46%] flex-col items-end gap-1">
              {feedEvents
                .filter((e) => e.kind === "kill")
                .slice(0, 5)
                .map((e, i) => (
                  <div
                    key={`kf-${e.tick}-${i}`}
                    className="rounded border border-[var(--border)]/80 bg-black/70 px-2 py-1 text-[10px] text-[var(--foreground)] backdrop-blur-sm"
                  >
                    <span className="text-[var(--amber)]">
                      {e.actorName ?? "?"}
                    </span>
                    <span className="mx-1 text-[var(--muted)]">→</span>
                    <span className="text-[var(--danger)]">
                      {e.targetName ?? "?"}
                    </span>
                  </div>
                ))}
            </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setActionZoom((z) => {
                  const next = !z;
                  if (next) setFollowFocus(true);
                  else {
                    setFollowFocus(false);
                    setActionFollow(null);
                  }
                  return next;
                });
              }}
              className={`border px-3 py-2 text-xs uppercase tracking-[0.12em] ${
                actionZoom
                  ? "border-[var(--amber)]/50 bg-[var(--amber)]/15 text-[var(--amber-bright)]"
                  : "border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {actionZoom ? "Full map" : "Focus play"}
            </button>
            <button
              type="button"
              onClick={() => togglePlayback()}
              className="border border-[var(--amber)]/50 bg-[var(--amber)]/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--amber-bright)] hover:bg-[var(--amber)]/25"
            >
              {playing ? "Pause" : "Play"}
            </button>
            <button
              type="button"
              onClick={() => {
                stopPlayback();
                setTick(rangeStart);
                tickRef.current = rangeStart;
              }}
              className="border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs uppercase tracking-[0.12em] text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              Restart round
            </button>
            <span className="font-[family-name:var(--font-code)] text-xs text-[var(--muted)]">
              {formatClock(tick, replay.tickRate, replay.startTick)}
              {currentRound ? ` · R${currentRound.round}` : ""}
              {" · "}
              frame ~{Math.round(frameTick)}
              {actionZoom ? " · drag map to pan" : ""}
              {actionFollow && actionZoom
                ? ` · following ${actionFollow.kind}`
                : followFocus && actionZoom
                  ? " · following"
                  : ""}
            </span>
          </div>

          <input
            type="range"
            min={rangeStart}
            max={rangeEnd}
            step={1}
            value={Math.min(rangeEnd, Math.max(rangeStart, tick))}
            onChange={(e) => {
              const t = Number(e.target.value);
              stopPlayback();
              tickRef.current = t;
              setTick(t);
            }}
            className="mt-3 w-full accent-[var(--amber)]"
          />
        </div>

        {/* Side panel: legend + coaching feed */}
        <aside className="flex max-h-[640px] flex-col bg-[var(--bg-elevated)]/30">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <p className="font-[family-name:var(--font-display)] text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
              Legend
            </p>
            <ul className="mt-2 grid grid-cols-2 gap-1.5 text-[11px] text-[var(--muted)]">
              <li className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-sky-400" /> CT
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--amber)]" /> T
              </li>
              {(Object.keys(KIND_META) as ReplayEventKind[]).map((k) => (
                <li key={k} className="flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: KIND_META[k].color }}
                  />
                  {KIND_META[k].label}
                </li>
              ))}
              <li className="flex items-center gap-1.5">
                <span className="h-2 w-2 rotate-45 border border-[var(--muted)]" />
                Throw
              </li>
              <li className="flex items-center gap-1.5">
                <span className="inline-block h-px w-3 bg-[var(--muted)]" />
                Throw → pop
              </li>
            </ul>
          </div>

          <div className="flex min-h-0 flex-1 flex-col px-4 py-3">
            <p className="font-[family-name:var(--font-display)] text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
              Event feed
              <span className="ml-1.5 font-normal normal-case tracking-normal text-[var(--muted)]/70">
                · click to jump
              </span>
            </p>
            <ul className="mt-2 flex-1 space-y-2 overflow-y-auto pr-1 text-xs">
              {feedEvents.length === 0 ? (
                <li className="text-[var(--muted)]">
                  Play the round to see kills and utility here.
                </li>
              ) : (
                feedEvents.map((e, i) => {
                  const meta = KIND_META[e.kind];
                  const hint = flashCoachHint(e);
                  const active =
                    tick >= e.tick &&
                    tick <= e.tick + (e.durationTicks ?? replay.tickRate);
                  if (e.kind === "kill") {
                    return (
                      <li key={`feed-${e.tick}-${i}`}>
                        <button
                          type="button"
                          onClick={() => jumpToEvent(e)}
                          className={`w-full rounded border px-2.5 py-2 text-left transition hover:border-[var(--amber)]/50 hover:bg-[var(--amber)]/10 ${
                            active
                              ? "border-[var(--amber)]/45 bg-[var(--amber)]/10"
                              : "border-[var(--border)] bg-[var(--surface)]"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ background: meta.color }}
                            />
                            <span className="text-[var(--foreground)]">
                              {e.actorName ??
                                nameById.get(e.actorSteamId ?? "") ??
                                "?"}
                            </span>
                            <span className="text-[var(--muted)]">killed</span>
                            <span className="text-[var(--foreground)]">
                              {e.targetName ??
                                nameById.get(e.targetSteamId ?? "") ??
                                "?"}
                            </span>
                          </div>
                        </button>
                      </li>
                    );
                  }

                  const blinds = e.blinds ?? [];
                  const enemies = enemyBlindCount(e);
                  return (
                    <li key={`feed-${e.tick}-${i}`}>
                      <button
                        type="button"
                        onClick={() => jumpToEvent(e)}
                        className={`w-full rounded border px-2.5 py-2 text-left transition hover:border-[var(--amber)]/50 hover:bg-[var(--amber)]/10 ${
                          hint
                            ? "border-[var(--warn)]/40 bg-[var(--warn)]/10"
                            : active
                              ? "border-[var(--amber)]/45 bg-[var(--amber)]/10"
                              : "border-[var(--border)] bg-[var(--surface)]"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <span
                            className="mt-1 h-2 w-2 shrink-0 rounded-full"
                            style={{ background: meta.color }}
                          />
                          <div className="min-w-0">
                            <p className="text-[var(--foreground)]">
                              <span className="font-medium">{meta.label}</span>
                              {e.actorName ? (
                                <span className="text-[var(--muted)]">
                                  {" "}
                                  · {e.actorName}
                                </span>
                              ) : null}
                            </p>
                            {e.kind === "flash" ? (
                              <p className="mt-0.5 text-[var(--muted)]">
                                {blinds.length === 0
                                  ? "No one blinded"
                                  : `Blinded: ${blinds
                                      .map((b) => b.name)
                                      .slice(0, 4)
                                      .join(", ")}${
                                      blinds.length > 4
                                        ? ` +${blinds.length - 4}`
                                        : ""
                                    }`}
                                {enemies > 0 ? (
                                  <span className="text-[var(--ok)]">
                                    {" "}
                                    ({enemies} enemy)
                                  </span>
                                ) : null}
                              </p>
                            ) : (
                              <p className="mt-0.5 text-[var(--muted)]">
                                {e.throwX != null
                                  ? "Throw → pop on map"
                                  : "Landed on map"}
                                {e.kind === "smoke" || e.kind === "molotov"
                                  ? (() => {
                                      const fallback =
                                        e.kind === "smoke" ? 18 : 7;
                                      const sec = Math.max(
                                        fallback * 0.85,
                                        (e.durationTicks ?? 0) /
                                          Math.max(1, replay.tickRate),
                                      );
                                      return ` · ${e.durationEstimated ? "~" : ""}${Math.round(sec)}s`;
                                    })()
                                  : ""}
                                {e.kind === "he" || e.kind === "molotov"
                                  ? ` · ${e.damage ?? 0} dmg`
                                  : ""}
                              </p>
                            )}
                            {hint ? (
                              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--warn)]">
                                Improve: {hint}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>

          <div className="border-t border-[var(--border)] px-4 py-2 text-[10px] text-[var(--muted)]">
            {activeOverlays.filter((e) => e.kind !== "kill").length} utility
            active on map
          </div>
        </aside>
      </div>

      {replay.rounds.length > 0 && focusSteamId ? (
        <DemoRoundTimeline
          replay={replay}
          roundIdx={roundIdx}
          focusSteamId={focusSteamId}
          onFocusChange={setFocusSteamId}
          onJumpRound={jumpToRound}
        />
      ) : null}
    </section>
  );
},
);
