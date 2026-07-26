import {
  parseEvent,
  parseGrenades,
  parseHeader,
  parsePlayerInfo,
  parseTicks,
} from "@laihoe/demoparser2";
import type { DemoEventRow, ParsedDemo } from "./types";

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
 */
export function parseDemoFile(path: string): ParsedDemo {
  const header = (parseHeader(path) ?? {}) as Record<string, unknown>;
  const playerInfo = asPlayerInfo(parsePlayerInfo(path));

  const deaths = asRows(
    parseEvent(path, "player_death", [], [
      "total_rounds_played",
      "round",
    ]),
  );
  const hurts = asRows(
    parseEvent(path, "player_hurt", [], ["total_rounds_played"]),
  );
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
  const roundStarts = asRows(
    parseEvent(path, "round_start", [], ["total_rounds_played"]),
  );
  const roundFreezeEnds = asRows(
    parseEvent(path, "round_freeze_end", [], ["total_rounds_played"]),
  );
  const roundEnds = asRows(
    parseEvent(path, "round_end", [], ["total_rounds_played"]),
  );
  let roundMvps: DemoEventRow[] = [];
  try {
    roundMvps = asRows(
      parseEvent(path, "round_mvp", [], ["total_rounds_played"]),
    );
  } catch {
    roundMvps = [];
  }

  const freezeTickNumbers = roundFreezeEnds
    .map((row) => Number(row.tick ?? row.Tick ?? NaN))
    .filter((t) => Number.isFinite(t));

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
  // Denser samples for radar replay (~2–4k frames).
  let motionTicks: DemoEventRow[] = [];
  const sampleTicks = buildSampleTicks(duration, 2800);
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

  let grenadeTrajectories: DemoEventRow[] = [];
  try {
    grenadeTrajectories = asRows(parseGrenades(path));
  } catch {
    grenadeTrajectories = [];
  }

  return {
    path,
    header,
    playerInfo,
    deaths,
    hurts,
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
    motionTicks,
    grenadeTrajectories,
  };
}
