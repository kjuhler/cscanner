import "server-only";

import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { updateAnalyzeJob } from "@/lib/demo/analyzeJob";
import { runAnalyzeUploadJob } from "@/lib/demo/runAnalyzeUploadJob";

export type AnalyzeJobArgs = {
  jobId: string;
  uploadId: string;
  fileName: string;
  totalChunks: number;
};

export type AnalyzeShareCodeJobArgs = {
  jobId: string;
  shareCode: string;
};

/**
 * Resolve the worker script at runtime only.
 * Do NOT pass a string literal like "analyze-worker.cjs" into path.join —
 * Next/Turbopack treats that as a file dependency and fails the build.
 */
function workerScriptPath(): string {
  const fromEnv = process.env.ANALYZE_WORKER_PATH;
  if (fromEnv) return fromEnv;
  const fileName = Buffer.from(
    "YW5hbHl6ZS13b3JrZXIuY2pz",
    "base64",
  ).toString("utf8");
  return join(/*turbopackIgnore: true*/ process.cwd(), fileName);
}

function watchChild(jobId: string, child: ChildProcess): void {
  child.on("error", (err) => {
    updateAnalyzeJob(jobId, {
      stage: "error",
      detail: err.message,
      pct: 0,
      done: true,
      error: err.message,
    });
  });

  child.on("exit", (code, signal) => {
    void (async () => {
      const { readAnalyzeJob } = await import("@/lib/demo/analyzeJob");
      const status = await readAnalyzeJob(jobId);
      if (!status || status.done) return;
      const reason =
        signal != null
          ? `Analyze worker killed (${signal}). Often out-of-memory — raise container RAM.`
          : `Analyze worker exited with code ${code}. Check container logs.`;
      updateAnalyzeJob(jobId, {
        stage: "error",
        detail: reason,
        pct: 0,
        done: true,
        error: reason,
      });
    })();
  });
}

/**
 * One-shot child (or in-process) for a single upload job when no BullMQ worker is alive.
 * Prefer the long-running worker service; this is a safety net.
 */
export function startAnalyzeJobInBackground(opts: AnalyzeJobArgs): void {
  const script = workerScriptPath();

  if (existsSync(script)) {
    let child: ChildProcess;
    try {
      child = spawn(
        process.execPath,
        [
          script,
          "--once",
          opts.jobId,
          opts.uploadId,
          opts.fileName,
          String(opts.totalChunks),
        ],
        {
          env: process.env,
          stdio: ["ignore", "inherit", "inherit"],
          windowsHide: true,
        },
      );
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

    watchChild(opts.jobId, child);
    return;
  }

  console.warn(
    "[analyze] analyze-worker.cjs not found — running in-process. Run `pnpm build:analyze-worker`.",
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

/**
 * One-shot for share-code jobs via the worker script.
 * Does not import steam-user into the Next.js web process — GC stays on the worker.
 */
export function startAnalyzeShareCodeJobInBackground(
  opts: AnalyzeShareCodeJobArgs,
): void {
  const script = workerScriptPath();

  if (!existsSync(script)) {
    const message =
      "analyze-worker.cjs not found. Run `pnpm build:analyze-worker` and start the worker with STEAM_REFRESH_TOKEN.";
    updateAnalyzeJob(opts.jobId, {
      stage: "error",
      detail: message,
      pct: 0,
      done: true,
      error: message,
    });
    return;
  }

  let child: ChildProcess;
  try {
    child = spawn(
      process.execPath,
      [script, "--once-share", opts.jobId, opts.shareCode],
      {
        env: process.env,
        stdio: ["ignore", "inherit", "inherit"],
        windowsHide: true,
      },
    );
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

  watchChild(opts.jobId, child);
}
