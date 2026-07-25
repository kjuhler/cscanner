type Props = {
  label: string;
  value: string;
  /** 0–100 fill for the ring. Null hides progress. */
  progress: number | null;
  hint?: string;
  accent?: string;
  size?: "sm" | "md";
};

function clampProgress(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export function MetricRing({
  label,
  value,
  progress,
  hint,
  accent = "var(--amber)",
  size = "md",
}: Props) {
  const dim = size === "sm" ? 72 : 88;
  const stroke = size === "sm" ? 5 : 6;
  const radius = (dim - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const fill = progress == null ? 0 : clampProgress(progress);
  const offset = circumference - (fill / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2 px-2 py-3 text-center">
      <div className="relative" style={{ width: dim, height: dim }}>
        <svg
          width={dim}
          height={dim}
          viewBox={`0 0 ${dim} ${dim}`}
          className="-rotate-90"
          aria-hidden
        >
          <circle
            cx={dim / 2}
            cy={dim / 2}
            r={radius}
            fill="none"
            stroke="var(--border)"
            strokeWidth={stroke}
          />
          {progress != null ? (
            <circle
              cx={dim / 2}
              cy={dim / 2}
              r={radius}
              fill="none"
              stroke={accent}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="transition-[stroke-dashoffset] duration-700 ease-out"
            />
          ) : null}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={`font-[family-name:var(--font-display)] font-bold tracking-tight text-[var(--foreground)] ${
              size === "sm" ? "text-sm" : "text-base"
            }`}
          >
            {value}
          </span>
        </div>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
          {label}
        </p>
        {hint ? (
          <p className="mt-0.5 text-[10px] text-[var(--muted)]">{hint}</p>
        ) : null}
      </div>
    </div>
  );
}
