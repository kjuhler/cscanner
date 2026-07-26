/**
 * Long-running BullMQ consumer for demo analyze jobs.
 * Bundled to analyze-worker.cjs — owns demoparser off the Next.js HTTP process.
 */
import { Worker } from "bullmq";
import Redis from "ioredis";
import {
  createAnalyzeJob,
  updateAnalyzeJob,
} from "./analyzeJob";
import {
  ANALYZE_QUEUE_NAME,
  type AnalyzeQueuePayload,
} from "./analyzeQueueTypes";
import { runAnalyzeUploadJob } from "./runAnalyzeUploadJob";

function redisUrl(): string {
  return process.env.REDIS_URL?.trim() || "redis://127.0.0.1:6379";
}

function concurrency(): number {
  const raw = process.env.ANALYZE_CONCURRENCY;
  const n = raw != null && raw !== "" ? Number(raw) : 1;
  return Number.isInteger(n) && n > 0 ? n : 1;
}

async function waitForRedis(url: string): Promise<void> {
  const client = new Redis(url, {
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
    lazyConnect: true,
    retryStrategy: () => null,
  });
  try {
    await client.connect();
    const pong = await client.ping();
    if (pong !== "PONG") {
      throw new Error(`Unexpected PING reply: ${pong}`);
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Redis unreachable at ${url} (${detail}). Start it with: docker compose up redis -d`,
    );
  } finally {
    try {
      await client.quit();
    } catch {
      client.disconnect();
    }
  }
}

async function main() {
  const url = redisUrl();
  const conc = concurrency();

  console.info(
    `[analyze-worker] starting queue=${ANALYZE_QUEUE_NAME} concurrency=${conc} dataDir=${process.env.DATA_DIR || ".data"}`,
  );

  await waitForRedis(url);
  console.info(`[analyze-worker] redis ok`);

  let lastErrorLog = 0;
  const worker = new Worker<AnalyzeQueuePayload>(
    ANALYZE_QUEUE_NAME,
    async (job) => {
      const { jobId, uploadId, fileName, totalChunks } = job.data;
      console.info(
        `[analyze-worker] job=${jobId} upload=${uploadId} file=${fileName} chunks=${totalChunks}`,
      );
      await createAnalyzeJob(jobId);
      await runAnalyzeUploadJob({
        jobId,
        uploadId,
        fileName,
        totalChunks,
      });
    },
    {
      connection: { url, maxRetriesPerRequest: null },
      concurrency: conc,
    },
  );

  worker.on("failed", (job, err) => {
    const jobId = job?.data?.jobId ?? job?.id ?? "unknown";
    console.error(`[analyze-worker] failed job=${jobId}`, err);
    if (job?.data?.jobId) {
      updateAnalyzeJob(job.data.jobId, {
        stage: "error",
        detail: err.message,
        pct: 0,
        done: true,
        error: err.message,
      });
    }
  });

  worker.on("error", (err) => {
    const now = Date.now();
    // Avoid flooding the terminal when Redis flaps.
    if (now - lastErrorLog < 5000) return;
    lastErrorLog = now;
    console.error("[analyze-worker] worker error", err.message);
  });

  const shutdown = async (signal: string) => {
    console.info(`[analyze-worker] ${signal} — closing…`);
    await worker.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error(
    "[analyze-worker] fatal",
    err instanceof Error ? err.message : err,
  );
  process.exit(1);
});
