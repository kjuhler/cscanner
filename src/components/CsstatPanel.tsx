import {
  formatDecimal,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import type { CsstatProfile, CsstatSignal, CsstatStat } from "@/lib/types";

type Props = {
  csstat: CsstatProfile | null;
};

function signalClass(signal: CsstatSignal): string {
  if (signal === "high") return "text-[var(--danger)]";
  if (signal === "elevated") return "text-[var(--warn)]";
  return "text-[var(--foreground)]";
}

function formatStat(
  stat: CsstatStat | null | undefined,
  kind: "number" | "decimal" | "percent" | "ms" | "deg" = "decimal",
): { text: string; signal: CsstatSignal } {
  if (!stat) return { text: "—", signal: null };
  const n = stat.value;
  if (n == null) {
    return { text: stat.raw ?? "—", signal: stat.signal };
  }
  let text: string;
  switch (kind) {
    case "number":
      text = formatNumber(n);
      break;
    case "percent":
      text = formatPercent(n);
      break;
    case "ms":
      text = `${Math.round(n)}ms`;
      break;
    case "deg":
      text = `${formatDecimal(n, 2)}°`;
      break;
    default:
      text = formatDecimal(n, 1);
  }
  return { text, signal: stat.signal };
}

function StatCell({
  label,
  text,
  signal,
}: {
  label: string;
  text: string;
  signal?: CsstatSignal;
}) {
  return (
    <div className="bg-[var(--surface)] px-4 py-4">
      <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
        {label}
      </p>
      <p
        className={`mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight ${signalClass(signal ?? null)}`}
      >
        {text}
      </p>
    </div>
  );
}

export function CsstatPanel({ csstat }: Props) {
  if (!csstat) {
    return (
      <section className="border border-[var(--border)] bg-[var(--surface)]">
        <div className="border-b border-[var(--border)] px-5 py-3">
          <h2 className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            csst.at
          </h2>
        </div>
        <p className="px-5 py-6 text-sm text-[var(--muted)]">
          No csst.at snapshot available (Cloudflare block or empty profile).
        </p>
      </section>
    );
  }

  const L = csstat.leetify;
  const F = csstat.faceit;
  const G = csstat.gameCoordinator;
  const S = csstat.steam;
  const bannedMates =
    L?.bannedMatesPercent ?? csstat.leetifyExtra?.bannedMatesPercent ?? null;

  const aim = formatStat(L?.aim);
  const preaim = formatStat(L?.preaim, "deg");
  const ttd = formatStat(L?.timeToDamageMs, "ms");
  const rating = formatStat(L?.rating);
  const utility = formatStat(L?.utility);
  const positioning = formatStat(L?.positioning);

  return (
    <section className="border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-5 py-3">
        <h2 className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
          csst.at snapshot
        </h2>
        <a
          href={csstat.profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--amber)] hover:underline"
        >
          Open csst.at →
        </a>
      </div>

      <div className="grid grid-cols-2 gap-px bg-[var(--border)] sm:grid-cols-4">
        <StatCell label="Aim" text={aim.text} signal={aim.signal} />
        <StatCell label="Preaim" text={preaim.text} signal={preaim.signal} />
        <StatCell label="Time to DMG" text={ttd.text} signal={ttd.signal} />
        <StatCell label="Rating" text={rating.text} signal={rating.signal} />
        <StatCell
          label="Utility"
          text={utility.text}
          signal={utility.signal}
        />
        <StatCell
          label="Position"
          text={positioning.text}
          signal={positioning.signal}
        />
        <StatCell
          label="Banned mates"
          text={bannedMates != null ? formatPercent(bannedMates) : "—"}
          signal={
            bannedMates != null && bannedMates >= 10
              ? "high"
              : bannedMates != null && bannedMates >= 5
                ? "elevated"
                : "normal"
          }
        />
        <StatCell
          label="Leetify matches"
          text={formatNumber(L?.matches ?? null)}
        />
      </div>

      <div className="grid grid-cols-2 gap-px border-t border-[var(--border)] bg-[var(--border)] sm:grid-cols-4">
        <StatCell label="FACEIT ELO" text={formatNumber(F?.elo ?? null)} />
        <StatCell
          label="FACEIT level"
          text={F?.skillLevel != null ? String(F.skillLevel) : "—"}
        />
        <StatCell
          label="FACEIT HS%"
          text={formatPercent(F?.hsPercent ?? null)}
        />
        <StatCell label="FACEIT K/D" text={formatDecimal(F?.kd ?? null)} />
      </div>

      {F?.banReason ? (
        <p className="border-t border-[var(--border)] px-5 py-3 text-xs text-[var(--danger)]">
          FACEIT ban: {F.banReason}
          {F.banDate ? ` · ${F.banDate}` : ""}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-px border-t border-[var(--border)] bg-[var(--border)] sm:grid-cols-4">
        <StatCell label="XP level" text={formatNumber(G?.xpLevel ?? null)} />
        <StatCell
          label="Commendations"
          text={formatNumber(G?.commendationsTotal ?? null)}
        />
        <StatCell
          label="CS2 playtime"
          text={
            S?.cs2PlaytimeHours != null
              ? `${formatNumber(Math.round(S.cs2PlaytimeHours))}h`
              : "—"
          }
        />
        <StatCell
          label="Filled gaps"
          text={
            csstat.filledFields.length > 0
              ? String(csstat.filledFields.length)
              : "0"
          }
        />
      </div>
    </section>
  );
}
