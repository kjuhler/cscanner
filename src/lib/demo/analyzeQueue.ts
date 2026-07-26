import "server-only";

import { Queue } from "bullmq";
import { createBullmqConnection } from "./bullmqConnection";
import {
  ANALYZE_QUEUE_NAME,
  type AnalyzeQueuePayload,
} from "./analyzeQueueTypes";
import { getRedis } from "./redis";

export { ANALYZE_QUEUE_NAME } from "./analyzeQueueTypes";
export type { AnalyzeQueuePayload } from "./analyzeQueueTypes";

export const WORKER_HEARTBEAT_KEY = "analyze:worker:heartbeat";

let queue: Queue<AnalyzeQueuePayload> | null = null;

export function getAnalyzeQueue(): Queue<AnalyzeQueuePayload> {
  if (queue) return queue;
  queue = new Queue<AnalyzeQueuePayload>(ANALYZE_QUEUE_NAME, {
    connection: createBullmqConnection(),
    defaultJobOptions: {
      removeOnComplete: { age: 3600, count: 100 },
      removeOnFail: { age: 3600, count: 200 },
      attempts: 1,
    },
  });
  return queue;
}

export async function enqueueAnalyzeJob(
  payload: AnalyzeQueuePayload,
): Promise<void> {
  const q = getAnalyzeQueue();
  await q.add("analyze", payload, {
    jobId: payload.jobId,
  });
}

export async function getAnalyzeQueueCounts(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
} | null> {
  try {
    const q = getAnalyzeQueue();
    const counts = await q.getJobCounts(
      "waiting",
      "active",
      "completed",
      "failed",
    );
    return {
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      completed: counts.completed ?? 0,
      failed: counts.failed ?? 0,
    };
  } catch {
    return null;
  }
}

/** True if a worker wrote a heartbeat within the last ~45s. */
export async function isAnalyzeWorkerAlive(): Promise<boolean> {
  try {
    const raw = await getRedis().get(WORKER_HEARTBEAT_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < 45_000;
  } catch {
    return false;
  }
}
