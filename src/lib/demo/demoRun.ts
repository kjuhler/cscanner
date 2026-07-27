import "server-only";

import { randomUUID } from "node:crypto";
import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { DemoLinkSource } from "./demoLink";
import { runsRoot } from "./dataDir";
import type { DemoAnalysis } from "./types";

export type DemoRunRecord = {
  runId: string;
  createdAt: number;
  expiresAt: number;
  source: DemoLinkSource;
  analysis: DemoAnalysis;
};

export type DemoRunMeta = {
  runId: string;
  createdAt: number;
  expiresAt: number;
  source: DemoLinkSource;
  mapName: string;
};

function demoRunTtlMs(): number {
  const raw = process.env.DEMO_RUN_TTL_MS;
  const n = raw != null && raw !== "" ? Number(raw) : 24 * 60 * 60 * 1000;
  return Number.isFinite(n) && n > 0 ? n : 24 * 60 * 60 * 1000;
}

function assertRunId(runId: string): void {
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(runId)) {
    throw new Error("Invalid run id.");
  }
}

function runFilePath(runId: string): string {
  assertRunId(runId);
  return join(runsRoot(), `${runId}.json`);
}

async function deleteRunFile(runId: string): Promise<void> {
  try {
    await rm(runFilePath(runId), { force: true });
  } catch {
    // ignore
  }
}

export async function createDemoRun(
  analysis: DemoAnalysis,
  source: DemoLinkSource,
): Promise<DemoRunMeta> {
  const runId = randomUUID().replace(/-/g, "").slice(0, 24);
  const createdAt = Date.now();
  const expiresAt = createdAt + demoRunTtlMs();
  const record: DemoRunRecord = {
    runId,
    createdAt,
    expiresAt,
    source,
    analysis,
  };

  await writeFile(runFilePath(runId), JSON.stringify(record));

  return {
    runId,
    createdAt,
    expiresAt,
    source,
    mapName: analysis.match.mapName,
  };
}

export async function updateDemoRun(
  runId: string,
  analysis: DemoAnalysis,
): Promise<DemoRunRecord | null> {
  const existing = await readDemoRun(runId);
  if (!existing) return null;

  const record: DemoRunRecord = {
    ...existing,
    analysis,
  };
  await writeFile(runFilePath(runId), JSON.stringify(record));
  return record;
}

export async function readDemoRun(
  runId: string,
): Promise<DemoRunRecord | null> {
  assertRunId(runId);

  try {
    const raw = await readFile(runFilePath(runId), "utf8");
    const record = JSON.parse(raw) as DemoRunRecord;
    if (!record.expiresAt || record.expiresAt < Date.now()) {
      await deleteRunFile(runId);
      return null;
    }
    return record;
  } catch {
    return null;
  }
}

export async function deleteDemoRun(runId: string): Promise<void> {
  await deleteRunFile(runId);
}

/** Remove expired run files from disk. */
export async function sweepExpiredDemoRuns(): Promise<number> {
  let removed = 0;
  const now = Date.now();
  let names: string[] = [];
  try {
    names = await readdir(runsRoot());
  } catch {
    return 0;
  }

  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const runId = name.slice(0, -5);
    try {
      const raw = await readFile(join(runsRoot(), name), "utf8");
      const record = JSON.parse(raw) as DemoRunRecord;
      if (!record.expiresAt || record.expiresAt < now) {
        await deleteRunFile(runId);
        removed += 1;
      }
    } catch {
      try {
        await rm(join(runsRoot(), name), { force: true });
        removed += 1;
      } catch {
        // ignore
      }
    }
  }

  if (removed > 0) {
    console.info(`[demoRun] swept ${removed} expired run(s)`);
  }
  return removed;
}

export function demoRunExportFilename(
  mapName: string,
  runId: string,
): string {
  const safeMap = mapName.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 40);
  return `cscanner-${safeMap || "demo"}-${runId}.json`;
}
