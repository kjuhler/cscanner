import "server-only";

import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { analyzeDemo } from "@/lib/demo";
import {
  updateAnalyzeJob,
  writeAnalyzeJobResult,
} from "@/lib/demo/analyzeJob";
import { demosRoot } from "@/lib/demo/dataDir";
import { writeDemoTempFile } from "@/lib/demo/decompress";
import { decodeShareCode } from "@/lib/demo/shareCode";
import type { DemoAnalysis } from "@/lib/demo/types";
import { MAX_DEMO_BYTES } from "@/lib/demo/uploadLimits";
import { fetchDemoUrlFromShareCode } from "@/lib/steam/gcDemo";

function assertDemoparserLoaded(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("@laihoe/demoparser2");
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Demo parser native module failed to load on this server (${detail}). Rebuild the Docker image with Alpine/musl demoparser bindings.`,
    );
  }
}

async function downloadToBuffer(
  url: string,
  onProgress: (downloaded: number, total: number | null) => void,
): Promise<Buffer> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`Demo download failed (HTTP ${res.status}).`);
  }
  const totalHeader = res.headers.get("content-length");
  const total =
    totalHeader != null && totalHeader !== ""
      ? Number(totalHeader)
      : null;
  if (total != null && Number.isFinite(total) && total > MAX_DEMO_BYTES) {
    throw new Error("Demo file is too large (max 500 MB).");
  }
  if (!res.body) {
    throw new Error("Demo download returned an empty body.");
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let downloaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    downloaded += value.byteLength;
    if (downloaded > MAX_DEMO_BYTES) {
      throw new Error("Demo file is too large (max 500 MB).");
    }
    chunks.push(value);
    onProgress(downloaded, total);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}

/**
 * Share code → GC demo URL → download → decompress → analyze.
 */
export async function analyzeFromShareCode(opts: {
  shareCode: string;
  onProgress?: (
    stage: "fetching" | "downloading" | "decompressing" | "parsing",
    detail: string,
    pct: number,
  ) => void;
}): Promise<DemoAnalysis> {
  let tempPath: string | null = null;

  try {
    assertDemoparserLoaded();
    opts.onProgress?.("fetching", "Decoding share code…", 2);
    const decoded = decodeShareCode(opts.shareCode);

    opts.onProgress?.(
      "fetching",
      "Requesting match from Steam Game Coordinator…",
      5,
    );
    const demoUrl = await fetchDemoUrlFromShareCode(decoded.normalized);
    opts.onProgress?.("downloading", "Downloading demo from Valve…", 8);

    const buffer = await downloadToBuffer(demoUrl, (downloaded, total) => {
      const pct =
        total != null && total > 0
          ? Math.min(28, 8 + Math.round((downloaded / total) * 20))
          : 12;
      opts.onProgress?.(
        "downloading",
        `Downloading… ${(downloaded / 1024 / 1024).toFixed(0)} MB`,
        pct,
      );
    });

    opts.onProgress?.(
      "decompressing",
      `Decompressing ${(buffer.length / 1024 / 1024).toFixed(0)} MB…`,
      30,
    );

    tempPath = join(demosRoot(), `demo-share-${randomUUID()}.dem`);
    // Valve CDN serves .dem.bz2; writeDemoTempFile detects BZ magic.
    await writeDemoTempFile(buffer, tempPath, "match.dem.bz2");

    opts.onProgress?.("parsing", "Decompressed — starting parse…", 36);
    return analyzeDemo(tempPath);
  } finally {
    if (tempPath) {
      try {
        await unlink(tempPath);
      } catch {
        // ignore
      }
    }
  }
}

export async function runAnalyzeShareCodeJob(opts: {
  jobId: string;
  shareCode: string;
}): Promise<void> {
  const { jobId } = opts;
  const started = Date.now();
  try {
    console.info(`[analyze-share ${jobId}] starting`);
    const analysis = await analyzeFromShareCode({
      shareCode: opts.shareCode,
      onProgress: (stage, detail, pct) => {
        updateAnalyzeJob(jobId, { stage, detail, pct });
      },
    });
    await writeAnalyzeJobResult(jobId, analysis);
    updateAnalyzeJob(jobId, {
      stage: "done",
      detail: `Done — ${analysis.match.mapName}`,
      pct: 100,
      done: true,
    });
    console.info(
      `[analyze-share ${jobId}] done in ${Date.now() - started}ms (map=${analysis.match.mapName})`,
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch or parse demo.";
    console.error(`[analyze-share ${jobId}]`, err);
    updateAnalyzeJob(jobId, {
      stage: "error",
      detail: message,
      pct: 0,
      done: true,
      error: message,
    });
  }
}
