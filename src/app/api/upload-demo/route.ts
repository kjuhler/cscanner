import { NextResponse } from "next/server";
import { getAnalyzeQueueCounts } from "@/lib/demo/analyzeQueue";
import { pingRedis } from "@/lib/demo/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Health check for the upload/analyze stack.
 * Demoparser lives on the worker — web only verifies Redis + queue.
 */
export async function GET() {
  const redisOk = await pingRedis();
  const queue = redisOk ? await getAnalyzeQueueCounts() : null;

  if (!redisOk) {
    return NextResponse.json(
      {
        ok: false,
        redis: false,
        error: "Redis unreachable. Start redis and set REDIS_URL.",
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    ok: true,
    redis: true,
    queue,
  });
}
