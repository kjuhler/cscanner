"use client";

import type { ReplayEvent } from "@/lib/demo";

type Props = {
  ev: ReplayEvent;
  left: number;
  top: number;
  /** 0 at pop → 1 at end of lifetime */
  age: number;
  /** Total lifetime in seconds (how long it was up). */
  totalSec?: number;
  /** Seconds remaining while active. */
  remainSec?: number;
  /**
   * Coverage radius as % of the radar map (not diameter).
   * Used for smoke / molly area overlays.
   */
  coverRadiusPct?: number;
};

function formatSec(sec: number, estimated?: boolean): string {
  const n = sec >= 10 ? `${Math.round(sec)}` : sec.toFixed(1);
  return `${estimated ? "~" : ""}${n}s`;
}

function ImpactLabel({
  title,
  detail,
  color,
}: {
  title: string;
  detail?: string;
  color: string;
}) {
  return (
    <div className="absolute left-1/2 top-1/2 z-[2] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5">
      <span
        className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#111] shadow"
        style={{ background: color }}
      >
        {title}
      </span>
      {detail ? (
        <span className="whitespace-nowrap rounded bg-black/80 px-1 py-px font-[family-name:var(--font-code)] text-[9px] font-semibold text-[var(--foreground)]">
          {detail}
        </span>
      ) : null}
    </div>
  );
}

/** Flash: white burst at land point. */
function FlashEffect({ left, top, age, totalSec, ev }: Props) {
  const burst = Math.max(0, 1 - age / 0.18);
  const glow = Math.max(0.4, 1 - age * 0.5);
  const size = 72 + burst * 36;
  const blinds = ev.blinds?.length ?? 0;
  const detail =
    blinds > 0
      ? `blind ${blinds}${totalSec != null && totalSec > 0 ? ` · ${formatSec(totalSec)}` : ""}`
      : totalSec != null && totalSec > 0
        ? formatSec(totalSec)
        : undefined;

  return (
    <div
      className="pointer-events-none absolute z-[2] -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${left}%`, top: `${top}%`, width: size, height: size }}
      title="Flash"
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle, rgba(255,255,255,${0.98 * burst + 0.55 * glow}) 0%, rgba(255,250,210,${0.85 * glow}) 22%, rgba(255,220,80,${0.45 * glow}) 48%, rgba(255,200,40,${0.15 * glow}) 68%, transparent 78%)`,
          boxShadow: `0 0 ${24 + burst * 40}px rgba(255,245,160,${0.85 * glow})`,
          animation: burst > 0.35 ? "nade-flash-pop 0.4s ease-out" : undefined,
        }}
      />
      <ImpactLabel title="Flash" detail={detail} color="#fff3a8" />
    </div>
  );
}

/** Smoke: opaque coverage disc so the blocked area is obvious on radar. */
function SmokeEffect({
  left,
  top,
  age,
  totalSec,
  ev,
  coverRadiusPct = 8,
}: Props) {
  const expand = Math.min(1, age / 0.08);
  const hold = age < 0.82 ? 1 : 1 - (age - 0.82) / 0.18;
  // Floor diameter so it never collapses to a tiny label-only blob.
  const diameter = Math.max(14, coverRadiusPct * 2) * (0.9 + 0.1 * expand);
  const detail =
    totalSec != null && totalSec > 1
      ? formatSec(totalSec, ev.durationEstimated)
      : formatSec(18, true);

  return (
    <div
      className="pointer-events-none absolute z-[2]"
      style={{
        left: `${left}%`,
        top: `${top}%`,
        width: `${diameter}%`,
        height: `${diameter}%`,
        transform: "translate(-50%, -50%)",
      }}
      title={`Smoke cover · ${detail}`}
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{
          opacity: 0.72 + 0.2 * hold,
          background:
            "radial-gradient(circle, rgba(220,228,236,0.97) 0%, rgba(155,166,178,0.92) 40%, rgba(95,105,116,0.78) 70%, rgba(45,52,60,0.4) 88%, transparent 100%)",
          border: "2.5px solid rgba(235,240,245,0.9)",
          boxShadow:
            "0 0 0 2px rgba(0,0,0,0.55), inset 0 0 28px rgba(20,26,32,0.4)",
        }}
      />
      <div
        className="absolute inset-[16%] rounded-full"
        style={{
          opacity: 0.7 * hold,
          background:
            "radial-gradient(circle at 42% 38%, rgba(245,248,252,0.85) 0%, rgba(150,160,170,0.4) 55%, transparent 78%)",
          animation: "nade-smoke-drift 4.5s ease-in-out infinite",
        }}
      />
      <ImpactLabel title="Smoke" detail={detail} color="#d0d8e0" />
    </div>
  );
}

/** Fire: burn coverage area + lifetime + damage. */
function FireEffect({
  left,
  top,
  age,
  totalSec,
  ev,
  coverRadiusPct = 6.5,
}: Props) {
  const fade = age < 0.85 ? 1 : 1 - (age - 0.85) / 0.15;
  const diameter = Math.max(12, coverRadiusPct * 2);
  const life =
    totalSec != null && totalSec > 1
      ? formatSec(totalSec, ev.durationEstimated)
      : formatSec(7, true);
  const dmg = ev.damage != null && ev.damage > 0 ? `${ev.damage} dmg` : null;
  const detail = [dmg, life].filter(Boolean).join(" · ") || life;

  return (
    <div
      className="pointer-events-none absolute z-[2]"
      style={{
        left: `${left}%`,
        top: `${top}%`,
        width: `${diameter}%`,
        height: `${diameter}%`,
        transform: "translate(-50%, -50%)",
        opacity: fade,
      }}
      title={`Molly cover · ${detail}`}
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(255,110,25,0.82) 0%, rgba(230,50,8,0.62) 45%, rgba(140,20,0,0.35) 72%, transparent 88%)",
          border: "2.5px solid rgba(255,170,70,0.9)",
          boxShadow: "0 0 0 2px rgba(0,0,0,0.45), 0 0 22px rgba(255,70,10,0.55)",
          animation: "nade-fire-flicker 0.7s ease-in-out infinite",
        }}
      />
      <div
        className="absolute left-[10%] top-[16%] h-[64%] w-[58%] rounded-[45%]"
        style={{
          background:
            "radial-gradient(ellipse at 50% 60%, rgba(255,190,60,0.85) 0%, rgba(220,50,10,0.45) 55%, transparent 78%)",
          animation: "nade-fire-flicker 0.45s ease-in-out infinite",
        }}
      />
      <div
        className="absolute right-[8%] top-[20%] h-[60%] w-[52%] rounded-[48%]"
        style={{
          background:
            "radial-gradient(ellipse at 50% 55%, rgba(255,210,80,0.75) 0%, rgba(200,40,8,0.4) 58%, transparent 80%)",
          animation: "nade-fire-flicker 0.55s ease-in-out infinite reverse",
        }}
      />
      <ImpactLabel title="Molly" detail={detail} color="#ff7a28" />
    </div>
  );
}

/** HE: blast at land point + damage. */
function HeEffect({ left, top, age, ev }: Props) {
  const opacity = Math.max(0.35, 1 - age);
  const expand = 40 + (1 - Math.max(0, 1 - age)) * 18;
  const dmg =
    ev.damage != null && ev.damage > 0 ? `${ev.damage} dmg` : "0 dmg";

  return (
    <div
      className="pointer-events-none absolute z-[2] -translate-x-1/2 -translate-y-1/2"
      style={{
        left: `${left}%`,
        top: `${top}%`,
        width: expand,
        height: expand,
        opacity,
      }}
      title={`HE · ${dmg}`}
    >
      <div
        className="absolute inset-0 rounded-full border-[3px] border-[#ffb020]"
        style={{
          boxShadow: `0 0 ${18 + opacity * 20}px rgba(255,160,40,${0.85 * opacity})`,
          background: `radial-gradient(circle, rgba(255,230,120,${0.8 * opacity}) 0%, rgba(255,140,40,${0.45 * opacity}) 40%, transparent 75%)`,
          animation: opacity > 0.6 ? "nade-flash-pop 0.35s ease-out" : undefined,
        }}
      />
      <ImpactLabel title="HE" detail={dmg} color="#e8a838" />
    </div>
  );
}

export function NadeEffectOverlay(props: Props) {
  switch (props.ev.kind) {
    case "flash":
      return <FlashEffect {...props} />;
    case "smoke":
      return <SmokeEffect {...props} />;
    case "molotov":
      return <FireEffect {...props} />;
    case "he":
      return <HeEffect {...props} />;
    default:
      return null;
  }
}
