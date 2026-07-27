import { access, readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { exampleDemoJsonPath } from "@/lib/demo/exampleDemo";
import {
  extractAnalysisFromPayload,
  isDemoAnalysis,
  normalizeAnalysis,
} from "@/lib/demo/validateAnalysis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadExampleAnalysis() {
  const path = exampleDemoJsonPath();
  await access(path);
  const raw = JSON.parse(await readFile(path, "utf8")) as unknown;
  const candidate = extractAnalysisFromPayload(raw);
  if (!isDemoAnalysis(candidate)) {
    throw new Error("Bundled example JSON is invalid.");
  }
  return normalizeAnalysis(candidate);
}

/** Load the bundled pre-analyzed example rundown (no demoparser). */
export async function GET() {
  try {
    const result = await loadExampleAnalysis();
    return NextResponse.json({ result });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load example demo.";
    console.error("[demo/example]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  return GET();
}
