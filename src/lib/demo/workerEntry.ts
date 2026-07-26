/**
 * Long-running BullMQ consumer for demo analyze jobs.
 * Also supports one-shot: node analyze-worker.cjs --once <jobId> <uploadId> <fileName> <chunks>
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

const WORKER_HEARTBEAT_KEY = "analyze:worker:heartbeat";

function redisUrl(): string {
  return process.env.REDIS_URL?.trim() || "redis://127.0.0.1:6379";
}

function concurrency(): number {
  const raw = process.env.ANALYZE_CONCURRENCY;
  const n = raw != null && raw !== "" ? Number(raw) : 1;
  return Number.isInteger(n) && n > 0 ? n : 1;
}

function createConnection(url: string): Redis {
  // Pass URL as first arg — `{ url }` options are unreliable with BullMQ/ioredis.
  return new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
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
      `Redis unreachable at ${url} (${detail}). Start it with: pnpm run dev:redis`,
    );
  } finally {
    try {
      await client.quit();
    } catch {
      client.disconnect();
    }
  }
}

async function runOnce(args: string[]): Promise<void> {
  const [jobId, uploadId, fileName, totalChunksStr] = args;
  if (!jobId || !uploadId || !fileName || !totalChunksStr) {
    console.error(
      "Usage: analyze-worker --once <jobId> <uploadId> <fileName> <totalChunks>",
    );
    process.exit(2);
  }
  const totalChunks = Number(totalChunksStr);
  if (!Number.isInteger(totalChunks) || totalChunks <= 0) {
    console.error("Invalid totalChunks");
    process.exit(2);
  }

  // One-shot does not need Redis for BullMQ, but status writes go to Redis.
  const url = redisUrl();
  try {
    await waitForRedis(url);
  } catch (err) {
    console.warn(
      "[analyze-worker] redis check failed (status updates may fail):",
      err instanceof Error ? err.message : err,
    );
  }

  console.info(
    `[analyze-worker] once job=${jobId} upload=${uploadId} file=${fileName} chunks=${totalChunks}`,
  );
  await createAnalyzeJob(jobId);
  await runAnalyzeUploadJob({
    jobId,
    uploadId,
    fileName,
    totalChunks,
  });
}

async function runDaemon(): Promise<void> {
  const url = redisUrl();
  const conc = concurrency();

  console.info(
    `[analyze-worker] starting queue=${ANALYZE_QUEUE_NAME} concurrency=${conc} dataDir=${process.env.DATA_DIR || ".data"}`,
  );

  await waitForRedis(url);
  console.info(`[analyze-worker] redis ok`);

  const heartbeat = createConnection(url);
  const beat = async () => {
    try {
      await heartbeat.set(WORKER_HEARTBEAT_KEY, String(Date.now()), "EX", 60);
    } catch (err) {
      console.error(
        "[analyze-worker] heartbeat failed",
        err instanceof Error ? err.message : err,
      );
    }
  };
  await beat();
  const beatTimer = setInterval(() => void beat(), 15_000);

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
      connection: createConnection(url),
      concurrency: conc,
    },
  );

  worker.on("ready", () => {
    console.info("[analyze-worker] ready — waiting for jobs");
  });

  worker.on("active", (job) => {
    console.info(`[analyze-worker] active job=${job.id}`);
  });

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
    if (now - lastErrorLog < 5000) return;
    lastErrorLog = now;
    console.error("[analyze-worker] worker error", err.message);
  });

  const shutdown = async (signal: string) => {
    console.info(`[analyze-worker] ${signal} — closing…`);
    clearInterval(beatTimer);
    try {
      await heartbeat.del(WORKER_HEARTBEAT_KEY);
      await heartbeat.quit();
    } catch {
      // ignore
    }
    await worker.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv[0] === "--once") {
    await runOnce(argv.slice(1));
    console.info("[analyze-worker] once exit 0");
    process.exit(0);
    return;
  }
  await runDaemon();
}

main().catch((err) => {
  console.error(
    "[analyze-worker] fatal",
    err instanceof Error ? err.message : err,
  );
  process.exit(1);
});
