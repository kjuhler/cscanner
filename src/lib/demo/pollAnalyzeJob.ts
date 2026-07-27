"use client";

/** Shared helpers for polling analyze jobs (upload + share-code). */

export const ANALYZE_POLL_MS = 400;

export function analyzeStageTitle(stage: string): string {
  switch (stage) {
    case "queued":
      return "Queued";
    case "fetching":
      return "Fetching match";
    case "downloading":
      return "Downloading demo";
    case "assembling":
      return "Assembling";
    case "decompressing":
      return "Decompressing";
    case "parsing":
      return "Parsing demo";
    case "analyzing":
      return "Analyzing";
    case "replay":
      return "Building replay";
    case "done":
      return "Done";
    case "error":
      return "Failed";
    default:
      return stage;
  }
}

export async function pollAnalyzeJob(
  jobId: string,
  onProgress: (pct: number, detail: string, stage: string) => void,
): Promise<unknown> {
  let transientFailures = 0;
  const maxTransient = 20;
  const startedAt = Date.now();
  const queuedTooLongMs = 90_000;

  for (;;) {
    let res: Response;
    try {
      res = await fetch(
        `/api/upload-demo/job/${encodeURIComponent(jobId)}`,
      );
    } catch {
      transientFailures += 1;
      if (transientFailures > maxTransient) {
        throw new Error(
          "Lost connection while analyzing. The server may have restarted — try again.",
        );
      }
      onProgress(
        0,
        `Waiting for server… (retry ${transientFailures}/${maxTransient})`,
        "analyzing",
      );
      await new Promise((r) =>
        setTimeout(r, Math.min(5000, 500 * transientFailures)),
      );
      continue;
    }

    if (res.status === 502 || res.status === 503 || res.status === 504) {
      transientFailures += 1;
      if (transientFailures > maxTransient) {
        throw new Error(
          "Server unavailable during analysis (502). Often out-of-memory or a crash — redeploy with more RAM and check Docker logs.",
        );
      }
      onProgress(
        0,
        `Server busy or restarting… (retry ${transientFailures}/${maxTransient})`,
        "analyzing",
      );
      await new Promise((r) =>
        setTimeout(r, Math.min(5000, 800 * transientFailures)),
      );
      continue;
    }

    const data = (await res.json().catch(() => ({}))) as {
      done?: boolean;
      pct?: number;
      detail?: string;
      stage?: string;
      error?: string;
      result?: unknown;
    };

    if (!res.ok) {
      throw new Error(data.error || `Job poll failed (${res.status})`);
    }

    transientFailures = 0;

    onProgress(
      typeof data.pct === "number" ? data.pct : 0,
      data.detail || "Processing…",
      data.stage || "processing",
    );

    if (data.done) {
      if (data.error || data.stage === "error") {
        throw new Error(data.error || data.detail || "Analyze failed.");
      }
      if (data.result == null) {
        throw new Error("Analyze finished without a result.");
      }
      return data.result;
    }

    if (
      (data.stage === "queued" || !data.stage) &&
      Date.now() - startedAt > queuedTooLongMs
    ) {
      throw new Error(
        "Analyze worker is not picking up the job (still Queued). In Portainer check that the cscanner-worker container is running, then open its logs. Health: GET /api/upload-demo should show workerAlive:true.",
      );
    }

    await new Promise((r) => setTimeout(r, ANALYZE_POLL_MS));
  }
}
