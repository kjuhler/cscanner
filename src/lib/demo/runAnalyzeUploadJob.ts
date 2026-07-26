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
import {
  isBzip2DemoName,
  writeDemoTempFile,
} from "@/lib/demo/decompress";
import {
  assembleUploadChunks,
  assembleUploadChunksToFile,
  cleanupUploadSession,
} from "@/lib/demo/uploadSession";

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

/**
 * Assemble chunks → decompress → analyze, writing live progress to the job store.
 */
export async function runAnalyzeUploadJob(opts: {
  jobId: string;
  uploadId: string;
  fileName: string;
  totalChunks: number;
}): Promise<void> {
  const { jobId, fileName, totalChunks } = opts;
  let uploadId = opts.uploadId;
  let tempPath: string | null = null;
  const started = Date.now();

  try {
    assertDemoparserLoaded();

    updateAnalyzeJob(jobId, {
      stage: "assembling",
      detail: `Assembling ${totalChunks} chunks…`,
      pct: 2,
    });

    tempPath = join(demosRoot(), `demo-${jobId}-${randomUUID()}.dem`);

    if (isBzip2DemoName(fileName)) {
      const buffer = await assembleUploadChunks(uploadId, totalChunks);
      updateAnalyzeJob(jobId, {
        stage: "decompressing",
        detail: `Decompressing ${(buffer.length / 1024 / 1024).toFixed(0)} MB…`,
        pct: 8,
      });
      console.info(
        `[analyze-job ${jobId}] assembled ${(buffer.length / 1024 / 1024).toFixed(1)} MB, decompressing… (+${Date.now() - started}ms)`,
      );
      await writeDemoTempFile(buffer, tempPath, fileName);
      updateAnalyzeJob(jobId, {
        stage: "parsing",
        detail: "Decompressed — starting parse…",
        pct: 14,
      });
    } else {
      const bytes = await assembleUploadChunksToFile(
        uploadId,
        totalChunks,
        tempPath,
      );
      console.info(
        `[analyze-job ${jobId}] assembled ${(bytes / 1024 / 1024).toFixed(1)} MB… (+${Date.now() - started}ms)`,
      );
      updateAnalyzeJob(jobId, {
        stage: "parsing",
        detail: "Assembled — starting parse…",
        pct: 12,
      });
    }

    await cleanupUploadSession(uploadId);
    uploadId = "";

    console.info(
      `[analyze-job ${jobId}] analyzing… (+${Date.now() - started}ms)`,
    );

    const analysis = analyzeDemo(tempPath, (stage, detail, pct) => {
      updateAnalyzeJob(jobId, { stage, detail, pct });
    });

    await writeAnalyzeJobResult(jobId, analysis);
    updateAnalyzeJob(jobId, {
      stage: "done",
      detail: `Done — ${analysis.match.mapName}`,
      pct: 100,
      done: true,
    });
    console.info(
      `[analyze-job ${jobId}] done in ${Date.now() - started}ms (map=${analysis.match.mapName})`,
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to parse demo.";
    console.error(`[analyze-job ${jobId}]`, err);
    updateAnalyzeJob(jobId, {
      stage: "error",
      detail: message,
      pct: 0,
      done: true,
      error: message,
    });
  } finally {
    if (uploadId) await cleanupUploadSession(uploadId);
    if (tempPath) {
      try {
        await unlink(tempPath);
      } catch {
        // ignore
      }
    }
  }
}
