import type { DemoAnalysis } from "@/lib/demo";
import { EXAMPLE_DEMO_PUBLIC_URL } from "@/lib/demo/exampleDemo";
import {
  extractAnalysisFromPayload,
  isDemoAnalysis,
  normalizeAnalysis,
} from "@/lib/demo/validateAnalysis";
import type { DemoLinkSource } from "@/lib/demo/demoLink";

export async function fetchExampleDemo(): Promise<DemoAnalysis> {
  const res = await fetch(EXAMPLE_DEMO_PUBLIC_URL);
  const data = (await res.json().catch(() => ({}))) as unknown;
  if (!res.ok) {
    throw new Error(`Example load failed (${res.status})`);
  }
  const result = extractAnalysisFromPayload(data);
  if (!isDemoAnalysis(result)) {
    throw new Error("Bundled example JSON is invalid.");
  }
  return normalizeAnalysis(result);
}

export async function fetchShareCodeDemo(shareCode: string): Promise<DemoAnalysis> {
  const res = await fetch("/api/upload-demo/from-share-code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shareCode }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    result?: unknown;
    error?: string;
  };
  if (!res.ok || data.result == null) {
    throw new Error(data.error || `Analyze failed (${res.status})`);
  }
  if (!isDemoAnalysis(data.result)) {
    throw new Error("Invalid analysis result.");
  }
  return normalizeAnalysis(data.result);
}

export async function fetchDemoRun(runId: string): Promise<{
  result: DemoAnalysis;
  expiresAt: number;
}> {
  const res = await fetch(`/api/demo/run/${encodeURIComponent(runId)}`);
  const data = (await res.json().catch(() => ({}))) as {
    result?: unknown;
    expiresAt?: number;
    error?: string;
  };
  if (!res.ok || data.result == null) {
    throw new Error(data.error || `Failed to load rundown (${res.status})`);
  }
  if (!isDemoAnalysis(data.result)) {
    throw new Error("Invalid rundown data.");
  }
  return {
    result: normalizeAnalysis(data.result),
    expiresAt: data.expiresAt ?? 0,
  };
}

export async function persistDemoRun(
  analysis: DemoAnalysis,
  source: DemoLinkSource,
): Promise<{ runId: string; expiresAt: number }> {
  const res = await fetch("/api/demo/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ analysis, source }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    runId?: string;
    expiresAt?: number;
    error?: string;
  };
  if (!res.ok || !data.runId || !data.expiresAt) {
    throw new Error(data.error || `Failed to save rundown (${res.status})`);
  }
  return { runId: data.runId, expiresAt: data.expiresAt };
}
