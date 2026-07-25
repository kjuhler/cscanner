"use client";

import { useState } from "react";
import { mapDisplayName, mapIconUrl } from "@/lib/maps";

type Props = {
  map: string | null | undefined;
  size?: number;
  className?: string;
};

export function MapIcon({ map, size = 28, className = "" }: Props) {
  const src = mapIconUrl(map);
  const label = mapDisplayName(map);
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <span
        aria-hidden
        className={`inline-flex shrink-0 items-center justify-center rounded-sm bg-[var(--bg-elevated)] text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)] ${className}`}
        style={{ width: size, height: size }}
        title={label}
      >
        {label.slice(0, 2)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      title={label}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`shrink-0 object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
