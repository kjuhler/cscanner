import { NextResponse } from "next/server";
import {
  demoRunExportFilename,
  readDemoRun,
} from "@/lib/demo/demoRun";
import { normalizeAnalysis } from "@/lib/demo/validateAnalysis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ runId: string }> };

/** Download full demo analysis JSON for a saved run. */
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

    const analysis = normalizeAnalysis(record.analysis);
    const filename = demoRunExportFilename(analysis.match.mapName, runId);
    const body = JSON.stringify(
      {
        runId: record.runId,
        createdAt: record.createdAt,
        expiresAt: record.expiresAt,
        source: record.source,
        analysis,
      },
      null,
      2,
    );

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to export demo run.";
    console.error("[demo/run export]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
