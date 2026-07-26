import "server-only";

import { fork, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  readAnalyzeJob,
  updateAnalyzeJob,
} from "@/lib/demo/analyzeJob";
import { runAnalyzeUploadJob } from "@/lib/demo/runAnalyzeUploadJob";

export type AnalyzeJobArgs = {
  jobId: string;
  uploadId: string;
  fileName: string;
  totalChunks: number;
};

function workerScriptPath(): string {
  return join(process.cwd(), "analyze-worker.cjs");
}

/**
 * Run assemble/parse/analyze in a child process when the bundled worker exists
 * (production Docker). Falls back to in-process for local `next dev`.
 *
 * Demoparser is CPU-bound and blocks the event loop; doing it in-process made
 * Cloudflare return 502 on job polls while analysis ran.
 */
export function startAnalyzeJobInBackground(opts: AnalyzeJobArgs): void {
  const script = workerScriptPath();

  if (existsSync(script)) {
    let child: ChildProcess;
    try {
      child = fork(script, [
        opts.jobId,
        opts.uploadId,
        opts.fileName,
        String(opts.totalChunks),
      ], {
        env: process.env,
        stdio: ["ignore", "inherit", "inherit", "ipc"],
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to start analyze worker.";
      updateAnalyzeJob(opts.jobId, {
        stage: "error",
        detail: message,
        pct: 0,
        done: true,
        error: message,
      });
      return;
    }

    child.on("exit", (code, signal) => {
      void (async () => {
        const status = await readAnalyzeJob(opts.jobId);
        if (!status || status.done) return;
        const reason =
          signal != null
            ? `Analyze worker killed (${signal}). Often out-of-memory — raise container RAM.`
            : `Analyze worker exited with code ${code}. Check container logs.`;
        updateAnalyzeJob(opts.jobId, {
          stage: "error",
          detail: reason,
          pct: 0,
          done: true,
          error: reason,
        });
      })();
    });
    return;
  }

  // Dev / missing bundle: run in-process (will block polls during parse).
  console.warn(
    "[analyze] analyze-worker.cjs not found — running in-process (dev). Run `pnpm build` for the worker bundle.",
  );
  void runAnalyzeUploadJob(opts).catch((err) => {
    const message =
      err instanceof Error ? err.message : "Failed to parse demo.";
    updateAnalyzeJob(opts.jobId, {
      stage: "error",
      detail: message,
      pct: 0,
      done: true,
      error: message,
    });
  });
}
