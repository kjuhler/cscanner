import "server-only";

import { readFile, rm, writeFile } from "node:fs/promises";
import Redis from "ioredis";
import { jobResultPath } from "./dataDir";
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

function jobTtlMs(): number {
  const raw = process.env.ANALYZE_JOB_TTL_MS;
  const n = raw != null && raw !== "" ? Number(raw) : 60 * 60 * 1000;
  return Number.isFinite(n) && n > 0 ? n : 60 * 60 * 1000;
}

function statusKey(jobId: string): string {
  return `analyze:job:${jobId}`;
}

/** In-process cache so demoparser sync progress callbacks stay ordered. */
const localCache = new Map<string, AnalyzeJobStatus>();

let redis: Redis | null = null;

function getClient(): Redis {
  if (redis) return redis;
  const url = process.env.REDIS_URL?.trim() || "redis://127.0.0.1:6379";
  redis = new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
  redis.on("error", (err) => {
    console.error("[analyzeJob redis]", err.message);
  });
  return redis;
}

function assertJobId(jobId: string): void {
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(jobId)) {
    throw new Error("Invalid job id.");
  }
}

async function persistStatus(status: AnalyzeJobStatus): Promise<void> {
  const ttlSec = Math.max(60, Math.ceil(jobTtlMs() / 1000));
  await getClient().set(
    statusKey(status.jobId),
    JSON.stringify(status),
    "EX",
    ttlSec,
  );
}

export async function createAnalyzeJob(
  jobId: string,
): Promise<AnalyzeJobStatus> {
  assertJobId(jobId);
  const existingRaw = await getClient().get(statusKey(jobId));
  if (existingRaw) {
    const existing = JSON.parse(existingRaw) as AnalyzeJobStatus;
    localCache.set(jobId, existing);
    return existing;
  }
  const status: AnalyzeJobStatus = {
    jobId,
    stage: "queued",
    detail: "Queued…",
    pct: 0,
    done: false,
    updatedAt: Date.now(),
  };
  localCache.set(jobId, status);
  await persistStatus(status);
  return status;
}

/** Sync so progress callbacks from demoparser stay ordered; Redis write is async. */
export function updateAnalyzeJob(
  jobId: string,
  patch: Partial<
    Pick<AnalyzeJobStatus, "stage" | "detail" | "pct" | "done" | "error">
  >,
): void {
  const current = localCache.get(jobId);
  if (!current) {
    // Worker may have restarted mid-job — seed from patch.
    const seeded: AnalyzeJobStatus = {
      jobId,
      stage: patch.stage ?? "analyzing",
      detail: patch.detail ?? "",
      pct: patch.pct ?? 0,
      done: patch.done ?? false,
      error: patch.error,
      updatedAt: Date.now(),
    };
    localCache.set(jobId, seeded);
    void persistStatus(seeded);
    return;
  }
  const next: AnalyzeJobStatus = {
    ...current,
    ...patch,
    pct:
      patch.pct != null && patch.pct < current.pct && !patch.done
        ? current.pct
        : (patch.pct ?? current.pct),
    updatedAt: Date.now(),
  };
  localCache.set(jobId, next);
  void persistStatus(next);
}

export async function readAnalyzeJob(
  jobId: string,
): Promise<AnalyzeJobStatus | null> {
  assertJobId(jobId);
  try {
    const raw = await getClient().get(statusKey(jobId));
    if (!raw) return null;
    const status = JSON.parse(raw) as AnalyzeJobStatus;
    if (Date.now() - status.updatedAt > jobTtlMs()) {
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
  assertJobId(jobId);
  await writeFile(jobResultPath(jobId), JSON.stringify(result));
}

export async function readAnalyzeJobResult(
  jobId: string,
): Promise<DemoAnalysis | null> {
  assertJobId(jobId);
  try {
    const raw = await readFile(jobResultPath(jobId), "utf8");
    return JSON.parse(raw) as DemoAnalysis;
  } catch {
    return null;
  }
}

export async function cleanupAnalyzeJob(jobId: string): Promise<void> {
  localCache.delete(jobId);
  try {
    await getClient().del(statusKey(jobId));
  } catch {
    // ignore
  }
  try {
    await rm(jobResultPath(jobId), { force: true });
  } catch {
    // ignore
  }
}
