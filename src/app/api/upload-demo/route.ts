import { NextResponse } from "next/server";
import {
  getAnalyzeQueueCounts,
  isAnalyzeWorkerAlive,
} from "@/lib/demo/analyzeQueue";
import { pingRedis } from "@/lib/demo/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Health check for the upload/analyze stack.
 * Demoparser lives on the worker — web verifies Redis + queue + worker heartbeat.
 */
export async function GET() {
  const redisOk = await pingRedis();
  const queue = redisOk ? await getAnalyzeQueueCounts() : null;
  const workerAlive = redisOk ? await isAnalyzeWorkerAlive() : false;

  if (!redisOk) {
    return NextResponse.json(
      {
        ok: false,
        redis: false,
        workerAlive: false,
        error: "Redis unreachable. Start redis and set REDIS_URL.",
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    ok: workerAlive,
    redis: true,
    workerAlive,
    queue,
    hint: workerAlive
      ? undefined
      : "Analyze worker is not heartbeating. In Portainer check that cscanner-worker is running and read its logs.",
  });
}
