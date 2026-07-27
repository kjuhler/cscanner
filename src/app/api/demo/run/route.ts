import { NextResponse } from "next/server";
import { createDemoRun } from "@/lib/demo/demoRun";
import type { DemoLinkSource } from "@/lib/demo/demoLink";
import {
  isDemoAnalysis,
  normalizeAnalysis,
} from "@/lib/demo/validateAnalysis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseSource(raw: unknown): DemoLinkSource | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  if (s.type === "example") return { type: "example" };
  if (s.type === "import") return { type: "import" };
  if (s.type === "code" && typeof s.shareCode === "string") {
    return { type: "code", shareCode: s.shareCode };
  }
  if (s.type === "run" && typeof s.runId === "string") {
    return { type: "run", runId: s.runId };
  }
  return null;
}

/** Persist a completed analysis for 24h shareable access. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      analysis?: unknown;
      source?: unknown;
    };

    if (!isDemoAnalysis(body.analysis)) {
      return NextResponse.json(
        { error: "Invalid or missing analysis payload." },
        { status: 400 },
      );
    }

    const source = parseSource(body.source) ?? { type: "import" as const };
    const analysis = normalizeAnalysis(body.analysis);
    const meta = await createDemoRun(analysis, source);

    return NextResponse.json({
      runId: meta.runId,
      expiresAt: meta.expiresAt,
      mapName: meta.mapName,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to save demo run.";
    console.error("[demo/run POST]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
