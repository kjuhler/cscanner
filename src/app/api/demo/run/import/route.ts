import { NextResponse } from "next/server";
import { createDemoRun } from "@/lib/demo/demoRun";
import {
  extractAnalysisFromPayload,
  isDemoAnalysis,
  normalizeAnalysis,
} from "@/lib/demo/validateAnalysis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function extractAnalysis(raw: unknown): unknown {
  return extractAnalysisFromPayload(raw);
}

/** Import a saved rundown JSON and create a new 24h run. */
export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    let raw: unknown;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: "Missing JSON file." },
          { status: 400 },
        );
      }
      raw = JSON.parse(await file.text()) as unknown;
    } else {
      const text = await request.text();
      raw = JSON.parse(text) as unknown;
    }

    const candidate = extractAnalysis(raw);
    if (!isDemoAnalysis(candidate)) {
      return NextResponse.json(
        { error: "Invalid demo analysis JSON." },
        { status: 400 },
      );
    }

    const analysis = normalizeAnalysis(candidate);
    const meta = await createDemoRun(analysis, { type: "import" });

    return NextResponse.json({
      runId: meta.runId,
      expiresAt: meta.expiresAt,
      result: analysis,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to import demo run.";
    console.error("[demo/run import]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
