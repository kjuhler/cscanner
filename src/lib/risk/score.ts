import type {
  FaceitPlayer,
  FaceitStats,
  LeetifyProfile,
  PlayerBans,
  RiskAssessment,
  RiskLevel,
  RiskProtectiveFactor,
  RiskSignal,
  SteamCs2Stats,
  SteamExtras,
  SteamProfile,
} from "@/lib/types";

const DISCLAIMER =
  "Heuristic risk only — based on public Steam / FACEIT / Leetify patterns. Not VAC, FACEIT AC, or proof of cheating.";

/** Pillar weights for the composite score (bans are additive on top). */
const PILLAR_WEIGHT = {
  trust: 0.35,
  stats: 0.4,
  consistency: 0.25,
} as const;

type RiskInput = {
  steam: SteamProfile | null;
  steamExtras: SteamExtras;
  cs2: SteamCs2Stats | null;
  faceitPlayer: FaceitPlayer | null;
  faceitStats: FaceitStats | null;
  leetify: LeetifyProfile | null;
  bans: PlayerBans;
};

type Pillar = RiskSignal["pillar"];

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function push(
  signals: RiskSignal[],
  signal: Omit<RiskSignal, "contribution"> & { contribution: number },
) {
  signals.push(signal);
}

function levelFromScore(score: number | null): RiskLevel {
  if (score == null) return "unknown";
  if (score >= 75) return "critical";
  if (score >= 55) return "high";
  if (score >= 35) return "elevated";
  if (score >= 15) return "moderate";
  return "low";
}

function pillarCap(signals: RiskSignal[], pillar: Pillar, cap: number): number {
  const sum = signals
    .filter((s) => s.pillar === pillar)
    .reduce((acc, s) => acc + s.contribution, 0);
  return clamp(sum, 0, cap);
}

export function assessRisk(input: RiskInput): RiskAssessment {
  const signals: RiskSignal[] = [];
  const protective: RiskProtectiveFactor[] = [];
  let dataPoints = 0;

  const ageDays = input.steam?.accountAgeDays ?? null;
  const elo = input.faceitPlayer?.elo ?? input.leetify?.faceitElo ?? null;
  const faceitLevel =
    input.faceitPlayer?.skillLevel ?? input.leetify?.faceitLevel ?? null;
  const faceitKd = input.faceitStats?.kd ?? null;
  const faceitHs =
    input.faceitStats?.hsPercent ?? input.leetify?.hsPercent ?? null;
  const faceitMatches =
    input.faceitStats?.matches ?? input.leetify?.totalMatches ?? null;
  const faceitWr = input.faceitStats?.winRate ?? null;
  const steamKd = input.cs2?.kd ?? null;
  const steamHs = input.cs2?.hsPercent ?? null;
  const playtime = input.steamExtras.cs2PlaytimeHours;
  const premier =
    input.leetify?.premier ?? input.leetify?.premierRecent ?? null;
  const aim = input.leetify?.aim ?? null;
  const ttd = input.leetify?.timeToDamageMs ?? null;
  const preaim = input.leetify?.preaim ?? null;
  const leetifyWr = input.leetify?.winrate ?? null;
  const seasons = input.leetify?.seasonRanksCs2 ?? [];
  const stack = input.leetify?.stackStats ?? null;

  // ─── Bans (hard additive, outside the three soft pillars) ───────────────
  dataPoints += 1;
  const steamBan = input.bans.steam;
  if (steamBan) {
    if (steamBan.vacBanned || steamBan.numberOfVacBans > 0) {
      push(signals, {
        id: "vac-ban",
        label: "VAC ban on record",
        pillar: "bans",
        weight: 45,
        contribution: 45,
        detail: `${steamBan.numberOfVacBans} VAC ban(s); last ban ${steamBan.daysSinceLastBan} day(s) ago.`,
      });
    }
    if (steamBan.numberOfGameBans > 0) {
      push(signals, {
        id: "game-ban",
        label: "Steam game ban on record",
        pillar: "bans",
        weight: 38,
        contribution: 35,
        detail: `${steamBan.numberOfGameBans} game ban(s); last ban ${steamBan.daysSinceLastBan} day(s) ago.`,
      });
    }
    if (steamBan.communityBanned) {
      push(signals, {
        id: "community-ban",
        label: "Steam community ban",
        pillar: "bans",
        weight: 15,
        contribution: 12,
        detail: "Account is community banned on Steam.",
      });
    }
  }

  if (input.bans.faceit.length > 0) {
    push(signals, {
      id: "faceit-ban",
      label: "FACEIT ban history",
      pillar: "bans",
      weight: 38,
      contribution: clamp(input.bans.faceit.length * 12, 12, 38),
      detail: `${input.bans.faceit.length} FACEIT ban record(s) found.`,
    });
  }

  if (input.bans.leetify.length > 0) {
    push(signals, {
      id: "leetify-platform-ban",
      label: "Platform bans (via Leetify)",
      pillar: "bans",
      weight: 25,
      contribution: clamp(input.bans.leetify.length * 10, 10, 25),
      detail: input.bans.leetify
        .map((b) => `${b.platform}${b.reason ? `: ${b.reason}` : ""}`)
        .join("; "),
    });
  }

  // ─── 1. Account Trust & History ─────────────────────────────────────────
  const friendSteam = input.bans.friends.steam;
  const friendTotal = input.bans.friends.friendCount;
  if (friendTotal != null) dataPoints += 1;
  if (friendSteam && friendTotal != null && friendTotal > 0) {
    const ratio = friendSteam.banned / friendTotal;
    if (friendSteam.banned >= 3 && ratio >= 0.08) {
      push(signals, {
        id: "banned-steam-friends",
        label: "Many banned Steam friends",
        pillar: "trust",
        weight: 22,
        contribution: clamp(
          Math.round(friendSteam.banned * 1.2 + ratio * 45),
          8,
          22,
        ),
        detail: `${friendSteam.banned} of ${friendTotal} friends have VAC/game bans (${friendSteam.vacBanned} VAC, ${friendSteam.gameBanned} game).`,
      });
    } else if (friendSteam.banned === 0 && friendTotal >= 20) {
      protective.push({
        id: "clean-friends",
        label: "Clean friend list",
        detail: `0 VAC/game-banned friends among ${friendTotal}.`,
      });
    } else if (ratio < 0.04 && friendTotal >= 30) {
      protective.push({
        id: "low-banned-friends",
        label: "Low banned-friend rate",
        detail: `${friendSteam.banned}/${friendTotal} friends banned (${Math.round(ratio * 1000) / 10}%).`,
      });
    }
  }

  const friendFaceit = input.bans.friends.faceit;
  if (friendFaceit && friendFaceit.withFaceit > 0) {
    dataPoints += 1;
    const ratio = friendFaceit.banned / friendFaceit.withFaceit;
    if (friendFaceit.banned >= 2 && ratio >= 0.1) {
      push(signals, {
        id: "banned-faceit-friends",
        label: "Many FACEIT-banned friends",
        pillar: "trust",
        weight: 16,
        contribution: clamp(
          Math.round(friendFaceit.banned * 3 + ratio * 28),
          6,
          16,
        ),
        detail: `${friendFaceit.banned} of ${friendFaceit.withFaceit} sampled FACEIT friends have bans.`,
      });
    }
  }

  if (ageDays != null) {
    dataPoints += 1;
    if (ageDays >= 1500) {
      protective.push({
        id: "old-account",
        label: "Long Steam account history",
        detail: `Account age ~${Math.round(ageDays / 365)} years.`,
      });
    }
  }

  if (ageDays != null && elo != null) {
    dataPoints += 1;
    if (ageDays < 180 && elo >= 2000) {
      push(signals, {
        id: "young-high-elo",
        label: "Young account + high FACEIT ELO",
        pillar: "trust",
        weight: 28,
        contribution: clamp(
          Math.round((elo - 1800) / 40 + (180 - ageDays) / 8),
          10,
          28,
        ),
        detail: `Account ~${ageDays} days old with FACEIT ELO ${elo}.`,
      });
    } else if (ageDays < 365 && elo >= 2500) {
      push(signals, {
        id: "young-high-elo",
        label: "Relatively new account + high ELO",
        pillar: "trust",
        weight: 18,
        contribution: clamp(Math.round((elo - 2300) / 50), 6, 18),
        detail: `Account ~${ageDays} days old with FACEIT ELO ${elo}.`,
      });
    } else if (ageDays >= 730 && elo >= 1500) {
      protective.push({
        id: "aged-ranked",
        label: "Rank fits account age",
        detail: `Multi-year account with FACEIT ELO ${elo}.`,
      });
    }
  }

  if (ageDays != null && premier != null) {
    dataPoints += 1;
    if (ageDays < 365 && premier >= 20000) {
      push(signals, {
        id: "young-high-premier",
        label: "Young account + high Premier",
        pillar: "trust",
        weight: 20,
        contribution: clamp(Math.round((premier - 18000) / 500), 8, 20),
        detail: `Account ~${ageDays} days old with Premier ~${premier}.`,
      });
    }
  }

  if (
    playtime != null &&
    playtime > 0 &&
    (elo != null || steamKd != null || premier != null || faceitLevel != null)
  ) {
    dataPoints += 1;
    const strongPerf =
      (elo != null && elo >= 2000) ||
      (steamKd != null && steamKd >= 1.6) ||
      (premier != null && premier >= 20000) ||
      (faceitLevel != null && faceitLevel >= 8);
    if (playtime < 200 && strongPerf) {
      push(signals, {
        id: "low-playtime-high-perf",
        label: "Low CS2 playtime vs strong performance",
        pillar: "trust",
        weight: 20,
        contribution: clamp(Math.round((200 - playtime) / 9), 8, 20),
        detail: `${playtime}h CS2 playtime with elevated competitive performance.`,
      });
    } else if (playtime >= 800 && strongPerf) {
      protective.push({
        id: "playtime-matches-rank",
        label: "Playtime supports rank",
        detail: `${Math.round(playtime)}h on record with competitive performance in a plausible range.`,
      });
    } else if (playtime >= 1500) {
      protective.push({
        id: "deep-playtime",
        label: "Deep CS2 playtime",
        detail: `${Math.round(playtime)}h CS2 playtime on Steam.`,
      });
    }
  }

  if (elo != null && faceitMatches != null && faceitMatches < 30 && elo >= 1800) {
    dataPoints += 1;
    push(signals, {
      id: "few-matches-high-elo",
      label: "High ELO on small sample",
      pillar: "trust",
      weight: 14,
      contribution: 10,
      detail: `ELO ${elo} across only ${faceitMatches} FACEIT matches.`,
    });
  }

  // ─── 2. Statistical deviations ──────────────────────────────────────────
  if (aim != null) {
    dataPoints += 1;
    if (aim >= 95) {
      push(signals, {
        id: "extreme-aim",
        label: "Extreme Leetify Aim rating",
        pillar: "stats",
        weight: 26,
        contribution: clamp(Math.round((aim - 92) * 4), 14, 26),
        detail: `Aim rating ${aim} is in the extreme outlier range (>95).`,
      });
    } else if (aim >= 88) {
      push(signals, {
        id: "very-high-aim",
        label: "Very high Leetify Aim rating",
        pillar: "stats",
        weight: 14,
        contribution: clamp(Math.round((aim - 85) * 2), 6, 14),
        detail: `Aim rating ${aim} is elevated vs typical public samples.`,
      });
    } else if (aim >= 40 && aim <= 78) {
      protective.push({
        id: "plausible-aim",
        label: "Plausible Aim rating",
        detail: `Aim ${aim} sits in a common public range.`,
      });
    }
  }

  if (ttd != null && ttd > 0) {
    dataPoints += 1;
    if (ttd < 250) {
      push(signals, {
        id: "inhuman-ttd",
        label: "Inhumanly low time to damage",
        pillar: "stats",
        weight: 24,
        contribution: clamp(Math.round((250 - ttd) / 6), 12, 24),
        detail: `Average time to damage ${ttd}ms is far below typical human ranges.`,
      });
    } else if (ttd < 300) {
      push(signals, {
        id: "low-time-to-dmg",
        label: "Very low time to damage",
        pillar: "stats",
        weight: 16,
        contribution: clamp(Math.round((300 - ttd) / 8), 8, 16),
        detail: `Average time to damage ${ttd}ms is unusually fast.`,
      });
    } else if (ttd >= 380 && ttd <= 700) {
      protective.push({
        id: "plausible-ttd",
        label: "Plausible time to damage",
        detail: `TTD ${ttd}ms is within a normal human band.`,
      });
    }
  }

  if (preaim != null && preaim > 0 && preaim < 5) {
    dataPoints += 1;
    push(signals, {
      id: "extreme-crosshair",
      label: "Extreme crosshair placement",
      pillar: "stats",
      weight: 14,
      contribution: clamp(Math.round((5.5 - preaim) * 4), 6, 14),
      detail: `Crosshair placement ${preaim}° is exceptionally tight.`,
    });
  }

  if (faceitHs != null && (faceitMatches == null || faceitMatches >= 20)) {
    dataPoints += 1;
    if (faceitHs >= 65) {
      push(signals, {
        id: "extreme-hs",
        label: "Extreme FACEIT headshot %",
        pillar: "stats",
        weight: 22,
        contribution: clamp(Math.round((faceitHs - 60) * 1.2), 10, 22),
        detail: `Average HS% ${faceitHs} is far above typical ranges.`,
      });
    } else if (faceitHs >= 55) {
      push(signals, {
        id: "high-hs",
        label: "Very high FACEIT headshot %",
        pillar: "stats",
        weight: 12,
        contribution: 8,
        detail: `Average HS% ${faceitHs} is elevated.`,
      });
    } else if (faceitHs >= 35 && faceitHs <= 52) {
      protective.push({
        id: "plausible-hs",
        label: "Plausible headshot rate",
        detail: `FACEIT HS% ${faceitHs} looks ordinary for the skill bracket.`,
      });
    }
  }

  if (faceitKd != null && (faceitMatches == null || faceitMatches >= 20)) {
    dataPoints += 1;
    if (faceitKd >= 2.2) {
      push(signals, {
        id: "extreme-kd",
        label: "Extreme FACEIT K/D",
        pillar: "stats",
        weight: 18,
        contribution: clamp(Math.round((faceitKd - 1.8) * 15), 8, 18),
        detail: `Average K/D ${faceitKd} with ${faceitMatches ?? "unknown"} matches.`,
      });
    } else if (faceitKd >= 1.7) {
      push(signals, {
        id: "high-kd",
        label: "High FACEIT K/D",
        pillar: "stats",
        weight: 10,
        contribution: 5,
        detail: `Average K/D ${faceitKd}.`,
      });
    }
  }

  if (steamHs != null && input.cs2 && !input.cs2.privateOrUnavailable) {
    dataPoints += 1;
    if (steamHs >= 60) {
      push(signals, {
        id: "steam-extreme-hs",
        label: "Extreme Steam lifetime HS%",
        pillar: "stats",
        weight: 12,
        contribution: 9,
        detail: `Lifetime headshot rate ${steamHs}%.`,
      });
    }
  }

  const wr =
    faceitWr != null && (faceitMatches == null || faceitMatches >= 25)
      ? faceitWr
      : leetifyWr != null &&
          (input.leetify?.sampleGames == null ||
            input.leetify.sampleGames >= 20)
        ? leetifyWr
        : null;
  if (wr != null) {
    dataPoints += 1;
    if (wr >= 72) {
      push(signals, {
        id: "wild-winrate",
        label: "Extreme win-rate cluster",
        pillar: "stats",
        weight: 16,
        contribution: clamp(Math.round((wr - 65) * 1.1), 8, 16),
        detail: `Recent/average win rate ${wr}% is an extreme public outlier.`,
      });
    } else if (wr >= 45 && wr <= 60) {
      protective.push({
        id: "plausible-wr",
        label: "Balanced win rate",
        detail: `Win rate ${wr}% does not show an extreme streak profile.`,
      });
    }
  }

  // Extreme aim + low TTD stack (compound)
  if (aim != null && aim >= 90 && ttd != null && ttd > 0 && ttd < 320) {
    push(signals, {
      id: "aim-ttd-compound",
      label: "High aim + very fast TTD",
      pillar: "stats",
      weight: 12,
      contribution: 10,
      detail: `Aim ${aim} combined with TTD ${ttd}ms is a strong anomaly pair.`,
    });
  }

  // ─── 3. Consistency ─────────────────────────────────────────────────────
  if (seasons.length >= 2) {
    dataPoints += 1;
    const withPremier = seasons.filter(
      (s) => s.premierMax != null && s.premierMax > 0,
    );
    if (withPremier.length >= 2) {
      const chron = [...withPremier].sort(
        (a, b) => a.seasonNumber - b.seasonNumber,
      );

      // Peak-to-peak jump between consecutive seasons
      let maxJump = 0;
      let jumpFrom = chron[0];
      let jumpTo = chron[1];
      for (let i = 1; i < chron.length; i++) {
        const prev = chron[i - 1].premierMax ?? 0;
        const cur = chron[i].premierMax ?? 0;
        const jump = cur - prev;
        if (jump > maxJump) {
          maxJump = jump;
          jumpFrom = chron[i - 1];
          jumpTo = chron[i];
        }
      }
      if (maxJump >= 8000) {
        push(signals, {
          id: "season-premier-spike",
          label: "Abrupt Premier season spike",
          pillar: "consistency",
          weight: 22,
          contribution: clamp(Math.round(maxJump / 700), 8, 22),
          detail: `${jumpFrom.title} peak ${jumpFrom.premierMax} → ${jumpTo.title} peak ${jumpTo.premierMax} (+${maxJump}).`,
        });
      }

      // Career arc: early floor → latest peak (catches 1k → 22k across seasons)
      const early = chron.slice(0, Math.min(3, chron.length));
      const earlyFloor = Math.min(
        ...early.map((s) => s.premierMin ?? s.premierMax ?? Number.POSITIVE_INFINITY),
      );
      const latest = chron[chron.length - 1];
      const careerPeak = latest.premierMax ?? 0;
      const careerRise =
        Number.isFinite(earlyFloor) && earlyFloor > 0
          ? careerPeak - earlyFloor
          : 0;
      const totalMatches = chron.reduce((sum, s) => sum + (s.matches || 0), 0);

      if (careerRise >= 12000) {
        const sparse = totalMatches > 0 && totalMatches < 250;
        const verySparse = totalMatches > 0 && totalMatches < 160;
        push(signals, {
          id: "career-premier-rocket",
          label: sparse
            ? "Huge Premier climb on limited games"
            : "Huge Premier career climb",
          pillar: "consistency",
          weight: 24,
          contribution: clamp(
            Math.round(careerRise / 900) + (verySparse ? 6 : sparse ? 3 : 0),
            10,
            24,
          ),
          detail: `Premier ~${earlyFloor} → ${careerPeak} (+${careerRise}) across ${chron.length} seasons / ${totalMatches} matches.`,
        });
      } else if (maxJump <= 4000 && careerRise < 8000) {
        protective.push({
          id: "steady-seasons",
          label: "Steady season progression",
          detail: `Premier peaks move gradually across seasons (max jump ~${maxJump}).`,
        });
      }
    }
  }

  // Within-season swings + rapid rating gain per match
  let worstSwing: {
    title: string;
    seasonNumber: number;
    min: number;
    max: number;
    matches: number;
    swing: number;
  } | null = null;

  for (const season of seasons) {
    if (
      season.premierMin == null ||
      season.premierMax == null ||
      season.matches < 10
    ) {
      continue;
    }
    const swing = season.premierMax - season.premierMin;
    if (
      swing >= 7000 &&
      (!worstSwing || swing > worstSwing.swing)
    ) {
      worstSwing = {
        title: season.title,
        seasonNumber: season.seasonNumber,
        min: season.premierMin,
        max: season.premierMax,
        matches: season.matches,
        swing,
      };
    }

    // Few games, big climb inside one season (e.g. 14.5k→22k in 24 matches)
    const perMatch = swing / season.matches;
    if (season.matches <= 35 && swing >= 6000 && perMatch >= 200) {
      push(signals, {
        id: `rapid-season-${season.seasonNumber}`,
        label: `Rapid Premier climb (${season.title})`,
        pillar: "consistency",
        weight: 18,
        contribution: clamp(
          Math.round(swing / 1000 + (35 - season.matches) / 4),
          8,
          18,
        ),
        detail: `${season.title}: ${season.premierMin}→${season.premierMax} (+${swing}) in only ${season.matches} matches (~${Math.round(perMatch)}/game).`,
      });
    }
  }

  if (worstSwing && worstSwing.swing >= 10000) {
    dataPoints += 1;
    push(signals, {
      id: `season-swing-${worstSwing.seasonNumber}`,
      label: `Wild Premier swing (${worstSwing.title})`,
      pillar: "consistency",
      weight: 14,
      contribution: clamp(Math.round(worstSwing.swing / 1200), 6, 14),
      detail: `${worstSwing.title}: Premier ${worstSwing.min}→${worstSwing.max} across ${worstSwing.matches} matches.`,
    });
  }

  // Solo-heavy + extreme aim can look like isolated boosting/smurf sessions
  if (stack && stack.sampleSize >= 30 && stack.soloPercent >= 85 && aim != null && aim >= 90) {
    dataPoints += 1;
    push(signals, {
      id: "solo-extreme-aim",
      label: "Near-solo queue + extreme aim",
      pillar: "consistency",
      weight: 10,
      contribution: 8,
      detail: `${stack.soloPercent}% solo with Aim ${aim} — worth watching, not proof.`,
    });
  }

  if (input.steam?.profilePrivate || input.cs2?.privateOrUnavailable) {
    dataPoints += 1;
  }

  // ─── Score composition ──────────────────────────────────────────────────
  if (dataPoints === 0) {
    return {
      score: null,
      confidence: "low",
      level: "unknown",
      signals: [],
      redFlags: [],
      protective: [],
      disclaimer: DISCLAIMER,
    };
  }

  const trustScore = pillarCap(signals, "trust", 100);
  const statsScore = pillarCap(signals, "stats", 100);
  const consistencyScore = pillarCap(signals, "consistency", 100);
  const bansScore = pillarCap(signals, "bans", 100);

  const soft = Math.round(
    trustScore * PILLAR_WEIGHT.trust +
      statsScore * PILLAR_WEIGHT.stats +
      consistencyScore * PILLAR_WEIGHT.consistency,
  );
  // Bans dominate when present; soft pillars fill the rest.
  const score = clamp(Math.round(soft * 0.65 + bansScore * 0.85), 0, 100);

  let confidence: RiskAssessment["confidence"] = "low";
  if (dataPoints >= 6) confidence = "high";
  else if (dataPoints >= 3) confidence = "medium";

  const concerning = signals
    .filter((s) => s.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution);

  if (concerning.length === 0) {
    return {
      score: 0,
      confidence,
      level: "low",
      signals: [
        {
          id: "clean",
          label: "No elevated public signals",
          pillar: "stats",
          weight: 0,
          contribution: 0,
          detail:
            "Available public Steam / FACEIT / Leetify data does not show common heuristic risk patterns.",
        },
      ],
      redFlags: [],
      protective: protective.slice(0, 5),
      disclaimer: DISCLAIMER,
    };
  }

  return {
    score,
    confidence,
    level: levelFromScore(score),
    signals: concerning,
    redFlags: concerning.slice(0, 4),
    protective: protective.slice(0, 5),
    disclaimer: DISCLAIMER,
  };
}
