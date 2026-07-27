import type { DemoAnalysis } from "./types";

/** Loose shape check for parsed demo analysis JSON. */
export function isDemoAnalysis(data: unknown): data is DemoAnalysis {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return (
    Array.isArray(d.players) &&
    Array.isArray(d.mistakes) &&
    typeof d.match === "object" &&
    d.match !== null &&
    typeof d.summary === "object" &&
    d.summary !== null
  );
}

export function normalizeAnalysis(data: DemoAnalysis): DemoAnalysis {
  return {
    ...data,
    cheatScores: data.cheatScores ?? [],
    replay: data.replay ?? null,
    highlights: data.highlights ?? [],
    summary: {
      ...data.summary,
      cheatSignals: data.summary.cheatSignals ?? 0,
      highestCheatRiskPlayer: data.summary.highestCheatRiskPlayer ?? null,
    },
  };
}

/** Unwrap exported run JSON (`{ analysis }`) or return raw analysis. */
export function extractAnalysisFromPayload(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const d = raw as Record<string, unknown>;
  if (isDemoAnalysis(d.analysis)) return d.analysis;
  return raw;
}
