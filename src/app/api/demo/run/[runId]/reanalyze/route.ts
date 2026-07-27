import { NextResponse } from "next/server";
import { readDemoRun, updateDemoRun } from "@/lib/demo/demoRun";
import { reanalyzeFromStored } from "@/lib/demo/reanalyze";
import { normalizeAnalysis } from "@/lib/demo/validateAnalysis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ runId: string }> };

/** Recompute replay-derived coaching from stored analysis JSON. */
export async function POST(_request: Request, context: RouteContext) {
  try {
    const { runId } = await context.params;
    const record = await readDemoRun(runId);
    if (!record) {
      return NextResponse.json({ error: "Run not found or expired." }, { status: 404 });
    }

    const analysis = reanalyzeFromStored(record.analysis);
    const updated = await updateDemoRun(runId, analysis);
    if (!updated) {
      return NextResponse.json({ error: "Run not found or expired." }, { status: 404 });
    }

    return NextResponse.json({
      runId: updated.runId,
      expiresAt: updated.expiresAt,
      result: normalizeAnalysis(analysis),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to reanalyze demo run.";
    console.error("[demo/run reanalyze]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
