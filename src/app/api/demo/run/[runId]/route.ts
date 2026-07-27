import { NextResponse } from "next/server";
import { readDemoRun } from "@/lib/demo/demoRun";
import { normalizeAnalysis } from "@/lib/demo/validateAnalysis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ runId: string }> };

/** Load a cached demo rundown by run id. */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { runId } = await context.params;
    const record = await readDemoRun(runId);
    if (!record) {
      return NextResponse.json(
        {
          error:
            "This rundown link has expired or does not exist. Links are kept for 24 hours.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      runId: record.runId,
      expiresAt: record.expiresAt,
      source: record.source,
      result: normalizeAnalysis(record.analysis),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load demo run.";
    console.error("[demo/run GET]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
