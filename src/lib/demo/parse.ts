import {
  parseEvent,
  parseGrenades,
  parseHeader,
  parsePlayerInfo,
  parseTicks,
} from "@laihoe/demoparser2";
import type { DemoEventRow, ParsedDemo } from "./types";

export type ParseProgressFn = (detail: string, pct: number) => void;

function asRows(value: unknown): DemoEventRow[] {
  if (!Array.isArray(value)) return [];
  return value as DemoEventRow[];
}

function asPlayerInfo(value: unknown): ParsedDemo["playerInfo"] {
  if (!Array.isArray(value)) return [];
  return value as ParsedDemo["playerInfo"];
}

function estimateDuration(
  header: Record<string, unknown>,
  deaths: DemoEventRow[],
  roundEnds: DemoEventRow[],
): number {
  let duration = Number(header.playback_ticks);
  if (!Number.isFinite(duration) || duration <= 0) {
    duration = 0;
    for (const row of deaths) {
      const t = Number(row.tick ?? row.Tick ?? 0);
      if (t > duration) duration = t;
    }
    for (const row of roundEnds) {
      const t = Number(row.tick ?? row.Tick ?? 0);
      if (t > duration) duration = t;
    }
  }
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
}

function buildSampleTicks(duration: number, maxSamples: number): number[] {
  if (duration <= 0) return [];
  const step = Math.max(4, Math.ceil(duration / maxSamples));
  const ticks: number[] = [];
  for (let t = 0; t <= duration; t += step) {
    ticks.push(t);
  }
  return ticks;
}

/**
 * Parse a CS2 .dem file into the event tables needed for analysis.
 * Uses demoparser2's query API (not a streaming event loop).
 * Progress pct is absolute within the post-upload pipeline (≈15–75).
 */
export function parseDemoFile(
  path: string,
  onProgress?: ParseProgressFn,
): ParsedDemo {
  const report = onProgress ?? (() => {});

  report("Reading demo header…", 15);
  const header = (parseHeader(path) ?? {}) as Record<string, unknown>;
  const playerInfo = asPlayerInfo(parsePlayerInfo(path));

  report("Parsing kill & damage events…", 18);
  const deaths = asRows(
    parseEvent(path, "player_death", [], [
      "total_rounds_played",
      "round",
    ]),
  );
  const hurts = asRows(
    parseEvent(path, "player_hurt", [], ["total_rounds_played"]),
  );
  let weaponFires: DemoEventRow[] = [];
  try {
    weaponFires = asRows(
      parseEvent(path, "weapon_fire", [], ["total_rounds_played", "round"]),
    );
  } catch {
    weaponFires = [];
  }

  report("Parsing utility events…", 25);
  const blinds = asRows(
    parseEvent(path, "player_blind", [], ["total_rounds_played"]),
  );
  const flashDetonates = asRows(
    parseEvent(path, "flashbang_detonate", [], ["total_rounds_played"]),
  );
  const heDetonates = asRows(
    parseEvent(path, "hegrenade_detonate", [], ["total_rounds_played"]),
  );
  const smokeDetonates = asRows(
    parseEvent(path, "smokegrenade_detonate", [], ["total_rounds_played"]),
  );
  let smokeExpires: DemoEventRow[] = [];
  try {
    smokeExpires = asRows(
      parseEvent(path, "smokegrenade_expired", [], ["total_rounds_played"]),
    );
  } catch {
    smokeExpires = [];
  }
  const molotovDetonates = asRows(
    parseEvent(path, "inferno_startburn", [], ["total_rounds_played"]),
  );
  let molotovExpires: DemoEventRow[] = [];
  try {
    molotovExpires = asRows(
      parseEvent(path, "inferno_expire", [], ["total_rounds_played"]),
    );
  } catch {
    molotovExpires = [];
  }
  try {
    const extinguish = asRows(
      parseEvent(path, "inferno_extinguish", [], ["total_rounds_played"]),
    );
    if (extinguish.length > 0) {
      molotovExpires = [...molotovExpires, ...extinguish];
    }
  } catch {
    // optional event — ignore
  }

  report("Parsing round timeline…", 35);
  const roundStarts = asRows(
    parseEvent(path, "round_start", [], ["total_rounds_played"]),
  );
  const roundFreezeEnds = asRows(
    parseEvent(path, "round_freeze_end", [], ["total_rounds_played"]),
  );
  const roundEnds = asRows(
    parseEvent(path, "round_end", [], [
      "total_rounds_played",
      "t_score",
      "ct_score",
    ]),
  );
  let roundMvps: DemoEventRow[] = [];
  try {
    roundMvps = asRows(
      parseEvent(path, "round_mvp", [], ["total_rounds_played"]),
    );
  } catch {
    roundMvps = [];
  }

  let bombPlanted: DemoEventRow[] = [];
  let bombDefused: DemoEventRow[] = [];
  let bombExploded: DemoEventRow[] = [];
  try {
    bombPlanted = asRows(
      parseEvent(path, "bomb_planted", [], ["total_rounds_played"]),
    );
  } catch {
    bombPlanted = [];
  }
  try {
    bombDefused = asRows(
      parseEvent(path, "bomb_defused", [], ["total_rounds_played"]),
    );
  } catch {
    bombDefused = [];
  }
  try {
    bombExploded = asRows(
      parseEvent(path, "bomb_exploded", [], ["total_rounds_played"]),
    );
  } catch {
    bombExploded = [];
  }

  const freezeTickNumbers = roundFreezeEnds
    .map((row) => Number(row.tick ?? row.Tick ?? NaN))
    .filter((t) => Number.isFinite(t));

  report("Parsing freeze-time economy…", 40);
  let freezeTicks: DemoEventRow[] = [];
  if (freezeTickNumbers.length > 0) {
    try {
      freezeTicks = asRows(
        parseTicks(
          path,
          [
            "balance",
            "armor_value",
            "has_helmet",
            "equipment_value_this_round",
            "team_num",
            "is_alive",
            "total_rounds_played",
          ],
          freezeTickNumbers,
        ),
      );
    } catch {
      freezeTicks = [];
    }
  }

  const duration = estimateDuration(header, deaths, roundEnds);
  // ~1200 frames keeps replay smooth enough while staying faster on small hosts.
  let motionTicks: DemoEventRow[] = [];
  const sampleTicks = buildSampleTicks(duration, 1200);
  report("Parsing motion frames (slowest step)…", 45);
  if (sampleTicks.length > 0) {
    try {
      motionTicks = asRows(
        parseTicks(
          path,
          ["X", "Y", "Z", "pitch", "yaw", "team_num", "health", "is_alive"],
          sampleTicks,
        ),
      );
    } catch {
      motionTicks = [];
    }
  }

  report("Parsing grenade trajectories…", 70);
  let grenadeTrajectories: DemoEventRow[] = [];
  try {
    grenadeTrajectories = asRows(parseGrenades(path));
  } catch {
    grenadeTrajectories = [];
  }

  report("Sampling flash blind ticks…", 72);
  let flashTickSamples: DemoEventRow[] = [];
  const flashSampleTicks = new Set<number>();
  const flashOffsets = [0, 8, 16, 32, 64, 96];
  for (const row of flashDetonates) {
    const t = Number(row.tick ?? row.Tick ?? 0);
    if (!Number.isFinite(t) || t <= 0) continue;
    for (const off of flashOffsets) flashSampleTicks.add(t + off);
  }
  const flashTickList = [...flashSampleTicks].sort((a, b) => a - b);
  if (flashTickList.length > 0) {
    try {
      flashTickSamples = asRows(
        parseTicks(
          path,
          [
            "flash_duration",
            "flash_max_alpha",
            "team_num",
            "is_alive",
          ],
          flashTickList,
        ),
      );
    } catch {
      flashTickSamples = [];
    }
  }

  report("Parse complete", 75);

  return {
    path,
    header,
    playerInfo,
    deaths,
    hurts,
    weaponFires,
    blinds,
    flashDetonates,
    heDetonates,
    smokeDetonates,
    smokeExpires,
    molotovDetonates,
    molotovExpires,
    roundStarts,
    roundFreezeEnds,
    roundEnds,
    roundMvps,
    freezeTicks,
    bombPlanted,
    bombDefused,
    bombExploded,
    flashTickSamples,
    motionTicks,
    grenadeTrajectories,
  };
}
