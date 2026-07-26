"use client";

import { useEffect, useMemo, useState } from "react";
import type { EventScene, SceneMarker, SceneMarkerRole } from "@/lib/demo";
import {
  distanceMeters,
  getRadarCalibration,
  worldToRadarPercent,
  type RadarCalibration,
} from "@/lib/demo/radar";
import { mapDisplayName } from "@/lib/maps";

type Props = {
  mapName: string;
  scene: EventScene;
  className?: string;
  /** Optional one-line explanation above the diagram. */
  caption?: string;
};

const ROLE_STYLE: Record<
  SceneMarkerRole,
  { fill: string; ring: string; label: string; text: string }
> = {
  victim: {
    fill: "bg-[var(--danger)]",
    ring: "ring-[var(--danger)]",
    label: "Victim",
    text: "text-[var(--danger)]",
  },
  attacker: {
    fill: "bg-[var(--amber)]",
    ring: "ring-[var(--amber)]",
    label: "Killer / aim",
    text: "text-[var(--amber)]",
  },
  teammate: {
    fill: "bg-sky-400",
    ring: "ring-sky-400",
    label: "Teammate",
    text: "text-sky-400",
  },
  focus: {
    fill: "bg-[var(--ok)]",
    ring: "ring-[var(--ok)]",
    label: "Focus",
    text: "text-[var(--ok)]",
  },
  other: {
    fill: "bg-[var(--muted)]",
    ring: "ring-[var(--muted)]",
    label: "Player",
    text: "text-[var(--muted)]",
  },
};

function markerPos(
  m: SceneMarker,
  cal: RadarCalibration | null,
  bounds: { minX: number; minY: number; dx: number; dy: number },
): { left: number; top: number } {
  if (cal) return worldToRadarPercent(m.x, m.y, cal);
  const pad = 0.14;
  return {
    left: ((m.x - bounds.minX) / bounds.dx) * (1 - 2 * pad) * 100 + pad * 100,
    top:
      (1 - (m.y - bounds.minY) / bounds.dy) * (1 - 2 * pad) * 100 + pad * 100,
  };
}

function buildCaption(scene: EventScene, fallback?: string): string {
  if (fallback) return fallback;
  const attacker = scene.markers.find((m) => m.role === "attacker");
  const victim = scene.markers.find((m) => m.role === "victim");
  if (attacker && victim) {
    const m = distanceMeters(attacker, victim);
    return `${attacker.name} (aim) → ${victim.name} (target), ~${m.toFixed(0)} m apart`;
  }
  return "Player positions at the flagged moment";
}

export function DemoRadarScene({
  mapName,
  scene,
  className = "",
  caption,
}: Props) {
  const cal = getRadarCalibration(mapName);
  const [cdn, setCdn] = useState<"primary" | "alt" | "none">(
    cal ? "primary" : "none",
  );

  useEffect(() => {
    setCdn(cal ? "primary" : "none");
  }, [mapName, cal?.mapCode]);

  const bounds = useMemo(() => {
    const xs = scene.markers.map((m) => m.x);
    const ys = scene.markers.map((m) => m.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return {
      minX,
      minY,
      dx: Math.max(maxX - minX, 400),
      dy: Math.max(maxY - minY, 400),
    };
  }, [scene.markers]);

  if (scene.markers.length === 0) return null;

  const useCal = cal && cdn !== "none" ? cal : null;
  const radarSrc =
    cal && cdn === "primary"
      ? cal.radarUrl
      : cal && cdn === "alt"
        ? cal.radarUrlAlt
        : null;

  const attacker = scene.markers.find((m) => m.role === "attacker");
  const victim = scene.markers.find((m) => m.role === "victim");
  const dist =
    attacker && victim ? distanceMeters(attacker, victim) : null;
  const title = buildCaption(scene, caption);
  const rolesPresent = new Set(scene.markers.map((m) => m.role));
  const displayMap = mapDisplayName(mapName);

  return (
    <div className={`mt-3 ${className}`}>
      <p className="mb-2 max-w-lg text-xs leading-relaxed text-[var(--foreground)]">
        {title}
        {dist != null ? (
          <span className="text-[var(--muted)]">
            {" "}
            · line = aim direction between them
          </span>
        ) : null}
      </p>

      <div className="relative aspect-square w-full max-w-[320px] overflow-hidden border border-[var(--border)] bg-[#0a0c0e]">
        {radarSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={radarSrc}
            alt={`${displayMap} radar`}
            className="h-full w-full object-cover opacity-40 brightness-[0.85] contrast-[0.9]"
            onError={() => {
              if (cdn === "primary") setCdn("alt");
              else setCdn("none");
            }}
          />
        ) : (
          <div
            aria-hidden
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "linear-gradient(rgba(42,51,61,0.9) 1px, transparent 1px), linear-gradient(90deg, rgba(42,51,61,0.9) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />
        )}

        <p className="absolute left-2 top-2 z-10 rounded bg-black/60 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[var(--foreground)]">
          {useCal
            ? `${displayMap} minimap`
            : `${displayMap !== "Unknown" ? displayMap : "Top-down"} · no map image`}
        </p>

        {/* Aim / trade line */}
        {attacker && victim ? (
          <svg
            className="pointer-events-none absolute inset-0 z-[1] h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <line
              x1={markerPos(attacker, useCal, bounds).left}
              y1={markerPos(attacker, useCal, bounds).top}
              x2={markerPos(victim, useCal, bounds).left}
              y2={markerPos(victim, useCal, bounds).top}
              stroke="rgba(232,168,56,0.75)"
              strokeWidth="0.8"
              strokeDasharray="2.5 1.5"
            />
          </svg>
        ) : null}

        {scene.markers.map((m) => {
          const pos = markerPos(m, useCal, bounds);
          if (pos.left < -8 || pos.left > 108 || pos.top < -8 || pos.top > 108) {
            return null;
          }
          const style = ROLE_STYLE[m.role];
          const focused = scene.focusSteamId === m.steamId;
          const labelSide = pos.left > 70 ? "right" : "left";
          return (
            <div
              key={`${m.steamId}-${m.role}`}
              className="absolute z-[2]"
              style={{ left: `${pos.left}%`, top: `${pos.top}%` }}
            >
              <div
                className={`h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full shadow ${style.fill} ${
                  focused ? `ring-2 ${style.ring}` : "ring-1 ring-black/60"
                } ${m.alive === false ? "opacity-50" : ""}`}
                title={`${m.name} (${style.label})`}
              />
              <span
                className={`absolute top-1/2 max-w-[7.5rem] -translate-y-1/2 truncate text-[10px] font-medium leading-tight ${style.text} ${
                  labelSide === "left"
                    ? "left-3 text-left"
                    : "right-3 text-right"
                }`}
                style={
                  labelSide === "left"
                    ? undefined
                    : { right: "0.75rem", left: "auto" }
                }
              >
                {m.name}
                <span className="block text-[9px] font-normal uppercase tracking-wide text-[var(--muted)]">
                  {style.label}
                </span>
              </span>
            </div>
          );
        })}
      </div>

      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">
        {[...rolesPresent].map((role) => (
          <li key={role} className="flex items-center gap-1.5">
            <span
              className={`inline-block h-2 w-2 rounded-full ${ROLE_STYLE[role].fill}`}
            />
            {ROLE_STYLE[role].label}
          </li>
        ))}
        {dist != null ? (
          <li className="normal-case tracking-normal text-[var(--foreground)]">
            ~{dist.toFixed(0)} m between aim and target
          </li>
        ) : null}
      </ul>
    </div>
  );
}
