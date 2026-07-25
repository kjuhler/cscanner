"use client";

import { useState } from "react";
import {
  competitiveRankIconUrl,
  competitiveRankName,
  faceitLevelIconUrl,
  formatPremier,
  premierTierBgUrl,
  premierTierColor,
} from "@/lib/ranks";

type CompetitiveProps = {
  kind: "competitive";
  rank: number | null | undefined;
  /** Badge width in px (skill groups are wide ~32:13). */
  size?: number;
  showLabel?: boolean;
  className?: string;
};

type FaceitProps = {
  kind: "faceit";
  level: number | null | undefined;
  size?: number;
  showLabel?: boolean;
  className?: string;
};

type PremierProps = {
  kind: "premier";
  rating: number | null | undefined;
  size?: "sm" | "md" | "lg";
  className?: string;
};

type Props = CompetitiveProps | FaceitProps | PremierProps;

/** Competitive skill-group badges are ~32×13. */
const COMP_ASPECT = 13 / 32;

function Fallback({
  label,
  width,
  height,
  className,
}: {
  label: string;
  width: number;
  height: number;
  className: string;
}) {
  return (
    <span
      aria-hidden
      title={label}
      className={`inline-flex shrink-0 items-center justify-center rounded-sm bg-[var(--bg-elevated)] text-[9px] font-semibold uppercase tracking-wide text-[var(--muted)] ${className}`}
      style={{ width, height }}
    >
      —
    </span>
  );
}

function ImageRank({
  src,
  label,
  width,
  height,
  className,
}: {
  src: string;
  label: string;
  width: number;
  height: number;
  className: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <Fallback
        label={label}
        width={width}
        height={height}
        className={className}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={label}
      title={label}
      width={width}
      height={height}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`shrink-0 object-contain ${className}`}
      style={{ width, height }}
    />
  );
}

export function RankIcon(props: Props) {
  if (props.kind === "premier") {
    const { rating, size = "md", className = "" } = props;
    const hasRating = rating != null && rating > 0;
    const label = hasRating ? formatPremier(rating) : "Unranked";
    const color = hasRating ? premierTierColor(rating) : "#B5C4D0";
    const dims =
      size === "lg"
        ? { h: 34, text: "text-[16px]" }
        : size === "sm"
          ? { h: 24, text: "text-[12px]" }
          : { h: 28, text: "text-[14px]" };

    return (
      <span
        title={`Premier ${label}`}
        className={`relative inline-block shrink-0 select-none ${className}`}
        style={
          {
            height: dims.h,
            ["--pr-color" as string]: color,
          } as React.CSSProperties
        }
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={premierTierBgUrl(rating, hasRating)}
          alt=""
          aria-hidden
          className={`block h-full w-auto ${hasRating ? "" : "opacity-50"}`}
          draggable={false}
        />
        <span
          className={`absolute inset-0 grid place-items-center font-[family-name:var(--font-display)] font-extrabold tracking-[0.02em] tabular-nums ${
            hasRating ? dims.text : "text-[10px]"
          }`}
          style={{
            color: "var(--pr-color)",
            textShadow: hasRating
              ? "0 1px 0 rgba(0,0,0,0.7), 0 0 10px color-mix(in srgb, var(--pr-color) 35%, transparent)"
              : "0 1px 0 rgba(0,0,0,0.7)",
          }}
        >
          {label}
        </span>
      </span>
    );
  }

  if (props.kind === "faceit") {
    const { level, size = 28, showLabel = false, className = "" } = props;
    const src = faceitLevelIconUrl(level);
    const label = level != null ? `FACEIT Level ${level}` : "Unranked";

    if (!src) {
      return showLabel ? (
        <span className={`text-xs text-[var(--muted)] ${className}`}>—</span>
      ) : (
        <Fallback
          label={label}
          width={size}
          height={size}
          className={className}
        />
      );
    }

    return (
      <span className={`inline-flex items-center gap-1.5 ${className}`}>
        <ImageRank
          src={src}
          label={label}
          width={size}
          height={size}
          className=""
        />
        {showLabel ? (
          <span className="text-xs text-[var(--muted)]">L{level}</span>
        ) : null}
      </span>
    );
  }

  const { rank, size = 72, showLabel = false, className = "" } = props;
  const src = competitiveRankIconUrl(rank);
  const label =
    rank != null && rank > 0 ? competitiveRankName(rank) : "Unranked";
  const width = size;
  const height = Math.round(size * COMP_ASPECT);

  if (!src) {
    return showLabel ? (
      <span className={`text-xs text-[var(--muted)] ${className}`}>
        Unranked
      </span>
    ) : (
      <Fallback
        label={label}
        width={width}
        height={height}
        className={className}
      />
    );
  }

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <ImageRank
        src={src}
        label={label}
        width={width}
        height={height}
        className=""
      />
      {showLabel ? (
        <span className="truncate text-sm text-[var(--amber)]">{label}</span>
      ) : null}
    </span>
  );
}
