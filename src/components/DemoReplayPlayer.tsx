"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

export function DemoReplayPlayer({ replay, mapName }: Props) {
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
  const lastEventIdx = useRef(-1);
  const rafRef = useRef<number | null>(null);
  const lastTs = useRef<number | null>(null);

  useEffect(() => {
    setRadarSrc(cal ? "local" : "none");
  }, [cal]);

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of replay.players) m.set(p.steamId, p.name);
    return m;
  }, [replay.players]);

  const currentRound = replay.rounds[roundIdx] ?? null;

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

  useEffect(() => {
    if (!playing) {
      lastTs.current = null;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      return;
    }

    const end = currentRound?.endTick ?? replay.endTick;
    const tickRate = replay.tickRate || 64;

    const step = (ts: number) => {
      if (lastTs.current == null) lastTs.current = ts;
      const dt = (ts - lastTs.current) / 1000;
      lastTs.current = ts;
      setTick((prev) => {
        const next = prev + dt * tickRate * speed;
        if (next >= end) {
          setPlaying(false);
          return end;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, speed, currentRound, replay.endTick, replay.tickRate]);

  function jumpToRound(idx: number) {
    const r = replay.rounds[idx];
    if (!r) return;
    setRoundIdx(idx);
    setTick(r.startTick);
    setPlaying(false);
  }

  function jumpToEvent(ev: ReplayEvent) {
    const idx = replay.rounds.findIndex((r) => r.round === ev.round);
    if (idx >= 0) setRoundIdx(idx);
    // Land a few ticks before the pop so throw → effect is visible.
    const lead = Math.round(replay.tickRate * 0.35);
    setTick(Math.max(replay.startTick, ev.tick - lead));
    setPlaying(false);
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
          <div className="relative mx-auto aspect-square w-full max-w-[560px] overflow-hidden border border-[var(--border)] bg-[#07090b] shadow-[inset_0_0_60px_rgba(0,0,0,0.45)]">
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
              const showPopLabel = false; // labels live on the nade overlays now

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
              const blinded = activeOverlays.some(
                (ev) =>
                  ev.kind === "flash" &&
                  ev.blinds?.some((b) => {
                    if (b.steamId !== p.steamId) return false;
                    const elapsedSec =
                      (tick - ev.tick) / Math.max(1, replay.tickRate);
                    return !(b.duration > 0 && elapsedSec > b.duration);
                  }),
              );
              return (
                <div
                  key={p.steamId}
                  className="absolute z-[4]"
                  style={{ left: `${pos.left}%`, top: `${pos.top}%` }}
                  title={`${name} · look ${Math.round(p.yaw)}°`}
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
                    } ${blinded ? "ring-2 ring-[var(--amber-bright)]" : ""}`}
                    style={{
                      transform: `translate(-50%, -50%) rotate(${90 - p.yaw}deg)`,
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
                  {p.alive ? (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-black/55 px-1 py-px text-[9px] font-medium text-[var(--foreground)]">
                      {initials(name)}
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

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              className="border border-[var(--amber)]/50 bg-[var(--amber)]/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--amber-bright)] hover:bg-[var(--amber)]/25"
            >
              {playing ? "Pause" : "Play"}
            </button>
            <button
              type="button"
              onClick={() => {
                setTick(rangeStart);
                setPlaying(false);
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
            </span>
          </div>

          <input
            type="range"
            min={rangeStart}
            max={rangeEnd}
            step={1}
            value={Math.min(rangeEnd, Math.max(rangeStart, tick))}
            onChange={(e) => {
              setTick(Number(e.target.value));
              setPlaying(false);
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
}
