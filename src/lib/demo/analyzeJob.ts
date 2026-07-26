import "server-only";

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DemoAnalysis } from "./types";

export type AnalyzeJobStage =
  | "queued"
  | "assembling"
  | "decompressing"
  | "parsing"
  | "analyzing"
  | "replay"
  | "done"
  | "error";

export type AnalyzeJobStatus = {
  jobId: string;
  stage: AnalyzeJobStage;
  detail: string;
  /** 0–100 of the post-upload processing pipeline */
  pct: number;
  done: boolean;
  error?: string;
  updatedAt: number;
};

const JOB_TTL_MS = 60 * 60 * 1000; // 1 hour

function jobsRoot(): string {
  return join(tmpdir(), "cscanner-jobs");
}

function jobDir(jobId: string): string {
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(jobId)) {
    throw new Error("Invalid job id.");
  }
  return join(jobsRoot(), jobId);
}

function statusPath(jobId: string): string {
  return join(jobDir(jobId), "status.json");
}

function resultPath(jobId: string): string {
  return join(jobDir(jobId), "result.json");
}

export async function createAnalyzeJob(jobId: string): Promise<AnalyzeJobStatus> {
  await mkdir(jobsRoot(), { recursive: true });
  mkdirSync(jobDir(jobId), { recursive: true });
  const status: AnalyzeJobStatus = {
    jobId,
    stage: "queued",
    detail: "Queued…",
    pct: 0,
    done: false,
    updatedAt: Date.now(),
  };
  writeFileSync(statusPath(jobId), JSON.stringify(status));
  return status;
}

/** Sync so progress callbacks from demoparser stay ordered. */
export function updateAnalyzeJob(
  jobId: string,
  patch: Partial<
    Pick<AnalyzeJobStatus, "stage" | "detail" | "pct" | "done" | "error">
  >,
): void {
  let current: AnalyzeJobStatus | null = null;
  try {
    current = JSON.parse(
      readFileSync(statusPath(jobId), "utf8"),
    ) as AnalyzeJobStatus;
  } catch {
    return;
  }
  const next: AnalyzeJobStatus = {
    ...current,
    ...patch,
    // Never let pct go backwards unless finishing/erroring.
    pct:
      patch.pct != null && patch.pct < current.pct && !patch.done
        ? current.pct
        : (patch.pct ?? current.pct),
    updatedAt: Date.now(),
  };
  writeFileSync(statusPath(jobId), JSON.stringify(next));
}

export async function readAnalyzeJob(
  jobId: string,
): Promise<AnalyzeJobStatus | null> {
  try {
    const raw = await readFile(statusPath(jobId), "utf8");
    const status = JSON.parse(raw) as AnalyzeJobStatus;
    if (Date.now() - status.updatedAt > JOB_TTL_MS) {
      await cleanupAnalyzeJob(jobId);
      return null;
    }
    return status;
  } catch {
    return null;
  }
}

export async function writeAnalyzeJobResult(
  jobId: string,
  result: DemoAnalysis,
): Promise<void> {
  await writeFile(resultPath(jobId), JSON.stringify(result));
}

export async function readAnalyzeJobResult(
  jobId: string,
): Promise<DemoAnalysis | null> {
  try {
    const raw = await readFile(resultPath(jobId), "utf8");
    return JSON.parse(raw) as DemoAnalysis;
  } catch {
    return null;
  }
}

export async function cleanupAnalyzeJob(jobId: string): Promise<void> {
  try {
    await rm(jobDir(jobId), { recursive: true, force: true });
  } catch {
    // ignore
  }
}
