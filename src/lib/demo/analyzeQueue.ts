import "server-only";

import { Queue } from "bullmq";
import {
  ANALYZE_QUEUE_NAME,
  type AnalyzeQueuePayload,
} from "./analyzeQueueTypes";
import { getRedisUrl } from "./redis";

export { ANALYZE_QUEUE_NAME } from "./analyzeQueueTypes";
export type { AnalyzeQueuePayload } from "./analyzeQueueTypes";

let queue: Queue<AnalyzeQueuePayload> | null = null;

export function getAnalyzeQueue(): Queue<AnalyzeQueuePayload> {
  if (queue) return queue;
  queue = new Queue<AnalyzeQueuePayload>(ANALYZE_QUEUE_NAME, {
    connection: { url: getRedisUrl(), maxRetriesPerRequest: null },
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
