import type { ReactNode } from "react";
import { formatDecimal, formatNumber, formatPercent } from "@/lib/format";
import {
  SKILL_LIKE_LABELS,
  clutchRawFromDisplay,
  openingRawFromDisplay,
  skillLikePremier,
  type SkillLikeKey,
} from "@/lib/leetify/skillLike";
import type { FaceitPlayer, LeetifyProfile } from "@/lib/types";
import { RankIcon } from "@/components/RankIcon";

type Props = {
  steamId: string;
  leetify: LeetifyProfile | null;
  faceitPlayer?: FaceitPlayer | null;
  /** Prefer Steam CS2 K/D, else FACEIT. */
  kd?: number | null;
};

function formatMs(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value}ms`;
}

function clampProgress(n: number | null | undefined): number | null {
  if (n == null || Number.isNaN(n)) return null;
  return Math.max(0, Math.min(100, n));
}

function ttdProgress(ms: number | null | undefined): number | null {
  if (ms == null || Number.isNaN(ms)) return null;
  // 400ms ≈ full bar, 800ms ≈ empty (aligned with recalibrated skillLike).
  return clampProgress(((800 - ms) / 400) * 100);
}

function LikeFooter({
  label,
  rating,
}: {
  label: string;
  rating: number | null;
}) {
  if (rating == null) return null;
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-[var(--muted)]">{label}:</span>
      <RankIcon kind="premier" rating={rating} size="sm" />
    </div>
  );
}

function MetricCard({
  title,
  value,
  barProgress,
  footer,
}: {
  title: string;
  value: ReactNode;
  barProgress: number | null;
  footer?: ReactNode;
}) {
  const fill =
    barProgress == null ? 0 : Math.max(0, Math.min(100, barProgress));

  return (
    <div className="bg-[var(--surface)] px-4 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold tracking-wide text-[var(--foreground)]">
          {title}
        </p>
        <div className="font-[family-name:var(--font-display)] text-xl font-bold tabular-nums text-[var(--foreground)]">
          {value}
        </div>
      </div>
      <div className="relative mt-2 h-1.5 overflow-hidden bg-[var(--border)]">
        {barProgress != null ? (
          <div
            className="absolute inset-y-0 left-0 bg-[var(--amber)]"
            style={{ width: `${fill}%` }}
          />
        ) : null}
      </div>
      {footer ? <div className="mt-2.5">{footer}</div> : null}
    </div>
  );
}

function SkillLikeRow({
  skill,
  scoreLabel,
  barProgress,
  likeRating,
}: {
  skill: SkillLikeKey;
  scoreLabel: string;
  barProgress: number | null;
  likeRating: number | null;
}) {
  const labels = SKILL_LIKE_LABELS[skill];

  return (
    <MetricCard
      title={labels.title}
      value={scoreLabel}
      barProgress={barProgress}
      footer={<LikeFooter label={labels.like} rating={likeRating} />}
    />
  );
}

export function PremierPanel({ steamId, leetify, faceitPlayer, kd }: Props) {
  if (!leetify) {
    return (
      <section className="border border-[var(--border)] bg-[var(--surface)]">
        <div className="border-b border-[var(--border)] px-5 py-3">
          <h2 className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            Aim &amp; ratings
          </h2>
        </div>
        <p className="px-5 py-6 text-sm text-[var(--muted)]">
          No Leetify data found for this Steam ID.
        </p>
        <div className="border-t border-[var(--border)] px-5 py-3">
          <a
            href={`https://leetify.com/app/profile/${steamId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--amber)] hover:underline"
          >
            Open on Leetify →
          </a>
        </div>
      </section>
    );
  }

  const premier = leetify.premier ?? leetify.premierRecent;
  const openingRaw = openingRawFromDisplay(leetify.opening);
  const clutchRaw = clutchRawFromDisplay(leetify.clutch);
  const recentGames = leetify.sampleGames ?? leetify.totalMatches;
  const faceitLevel = faceitPlayer?.skillLevel ?? leetify.faceitLevel;
  const faceitElo = faceitPlayer?.elo ?? leetify.faceitElo;

  const skills: Array<{
    skill: SkillLikeKey;
    scoreLabel: string;
    barProgress: number | null;
    likeRating: number | null;
  }> = [
    {
      skill: "aim",
      scoreLabel: formatDecimal(leetify.aim, 1),
      barProgress: leetify.aim,
      likeRating: skillLikePremier("aim", leetify.aim),
    },
    {
      skill: "positioning",
      scoreLabel: formatDecimal(leetify.positioning, 1),
      barProgress: leetify.positioning,
      likeRating: skillLikePremier("positioning", leetify.positioning),
    },
    {
      skill: "utility",
      scoreLabel: formatDecimal(leetify.utility, 1),
      barProgress: leetify.utility,
      likeRating: skillLikePremier("utility", leetify.utility),
    },
    {
      skill: "opening",
      scoreLabel: formatDecimal(leetify.opening, 2),
      barProgress:
        leetify.opening == null
          ? null
          : clampProgress(((leetify.opening + 1) / 2) * 100),
      likeRating: skillLikePremier("opening", openingRaw),
    },
    {
      skill: "clutch",
      scoreLabel: formatPercent(leetify.clutch),
      barProgress: leetify.clutch,
      likeRating: skillLikePremier("clutch", clutchRaw),
    },
    {
      skill: "ttd",
      scoreLabel: formatMs(leetify.timeToDamageMs),
      barProgress: ttdProgress(leetify.timeToDamageMs),
      likeRating: skillLikePremier("ttd", leetify.timeToDamageMs),
    },
    {
      skill: "hs",
      scoreLabel: formatPercent(leetify.hsPercent),
      barProgress: leetify.hsPercent,
      likeRating: skillLikePremier("hs", leetify.hsPercent),
    },
    {
      skill: "preaim",
      scoreLabel:
        leetify.preaim == null
          ? "—"
          : `${formatDecimal(leetify.preaim, 1)}°`,
      barProgress:
        leetify.preaim == null
          ? null
          : clampProgress(((20 - leetify.preaim) / 15) * 100),
      likeRating: skillLikePremier("preaim", leetify.preaim),
    },
    {
      skill: "kd",
      scoreLabel: formatDecimal(kd),
      barProgress:
        kd == null ? null : clampProgress(((kd - 0.5) / 1.3) * 100),
      likeRating: skillLikePremier("kd", kd),
    },
    {
      skill: "spotted",
      scoreLabel: formatPercent(leetify.accuracyEnemySpotted),
      barProgress: leetify.accuracyEnemySpotted,
      likeRating: skillLikePremier("spotted", leetify.accuracyEnemySpotted),
    },
    {
      skill: "spray",
      scoreLabel: formatPercent(leetify.sprayAccuracy),
      barProgress: leetify.sprayAccuracy,
      likeRating: skillLikePremier("spray", leetify.sprayAccuracy),
    },
    {
      skill: "counterStrafe",
      scoreLabel: formatPercent(leetify.counterStrafeRatio),
      barProgress: leetify.counterStrafeRatio,
      likeRating: skillLikePremier("counterStrafe", leetify.counterStrafeRatio),
    },
    {
      skill: "openingDuel",
      scoreLabel: formatPercent(leetify.openingDuelSuccess),
      barProgress: leetify.openingDuelSuccess,
      likeRating: skillLikePremier("openingDuel", leetify.openingDuelSuccess),
    },
    {
      skill: "trade",
      scoreLabel: formatPercent(leetify.tradeKillSuccess),
      barProgress: leetify.tradeKillSuccess,
      likeRating: skillLikePremier("trade", leetify.tradeKillSuccess),
    },
    {
      skill: "flashKill",
      scoreLabel: formatDecimal(leetify.flashbangLeadingToKill, 2),
      barProgress:
        leetify.flashbangLeadingToKill == null
          ? null
          : clampProgress((leetify.flashbangLeadingToKill / 10) * 100),
      likeRating: skillLikePremier(
        "flashKill",
        leetify.flashbangLeadingToKill,
      ),
    },
    {
      skill: "enemiesFlashed",
      scoreLabel: formatDecimal(leetify.enemiesFlashedPerFlashbang, 2),
      barProgress:
        leetify.enemiesFlashedPerFlashbang == null
          ? null
          : clampProgress((leetify.enemiesFlashedPerFlashbang / 1.5) * 100),
      likeRating: skillLikePremier(
        "enemiesFlashed",
        leetify.enemiesFlashedPerFlashbang,
      ),
    },
    {
      skill: "teammatesFlashed",
      scoreLabel: formatDecimal(leetify.teammatesFlashedPerFlashbang, 2),
      barProgress:
        leetify.teammatesFlashedPerFlashbang == null
          ? null
          : clampProgress(
              ((0.8 - leetify.teammatesFlashedPerFlashbang) / 0.75) * 100,
            ),
      likeRating: skillLikePremier(
        "teammatesFlashed",
        leetify.teammatesFlashedPerFlashbang,
      ),
    },
    {
      skill: "heDamage",
      scoreLabel: formatDecimal(leetify.heDamagePerNade, 1),
      barProgress:
        leetify.heDamagePerNade == null
          ? null
          : clampProgress((leetify.heDamagePerNade / 24) * 100),
      likeRating: skillLikePremier("heDamage", leetify.heDamagePerNade),
    },
    {
      skill: "utilityDeath",
      scoreLabel:
        leetify.utilityOnDeathAvg == null
          ? "—"
          : `$${formatNumber(leetify.utilityOnDeathAvg)}`,
      barProgress:
        leetify.utilityOnDeathAvg == null
          ? null
          : clampProgress(((450 - leetify.utilityOnDeathAvg) / 400) * 100),
      likeRating: skillLikePremier("utilityDeath", leetify.utilityOnDeathAvg),
    },
  ].filter((row): row is {
    skill: SkillLikeKey;
    scoreLabel: string;
    barProgress: number | null;
    likeRating: number | null;
  } => row.scoreLabel !== "—");

  return (
    <section className="overflow-hidden border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-5 py-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            Aim &amp; ratings
          </h2>
          {leetify.scopeFilled && leetify.scopeFilled.length > 0 ? (
            <p className="mt-1 text-[11px] text-[var(--muted)]">
              Aim details: Leetify + Scope
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-px bg-[var(--border)] lg:grid-cols-[minmax(0,160px)_minmax(0,1fr)]">
        <div className="bg-[var(--surface)] p-5">
          <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
            Leetify rating
          </p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-5xl font-bold leading-none text-[var(--amber)]">
            {formatDecimal(leetify.leetifyRating, 2)}
          </p>
          {leetify.name ? (
            <p className="mt-3 text-sm text-[var(--foreground)]">
              {leetify.name}
            </p>
          ) : null}
          <div className="mt-4">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
              Premier
            </p>
            <div className="mt-1.5">
              <RankIcon kind="premier" rating={premier} size="md" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
              FACEIT
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <RankIcon kind="faceit" level={faceitLevel} size={28} />
              <div className="min-w-0">
                <p className="font-[family-name:var(--font-display)] text-sm font-semibold text-[var(--foreground)]">
                  {faceitLevel != null ? `Level ${faceitLevel}` : "—"}
                </p>
                <p className="font-mono text-xs tabular-nums text-[var(--muted)]">
                  {faceitElo != null
                    ? `${formatNumber(faceitElo)} ELO`
                    : "No ELO"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-px bg-[var(--border)] sm:grid-cols-2 lg:grid-cols-3">
          {skills.map((row) => (
            <SkillLikeRow key={row.skill} {...row} />
          ))}

          {leetify.winrate != null ? (
            <MetricCard
              title="Win rate"
              value={formatPercent(leetify.winrate)}
              barProgress={leetify.winrate}
            />
          ) : null}
          {recentGames != null ? (
            <MetricCard
              title="Recent games"
              value={formatNumber(recentGames)}
              barProgress={clampProgress((recentGames / 30) * 100)}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}
