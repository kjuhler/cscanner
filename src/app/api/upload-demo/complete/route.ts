import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createAnalyzeJob } from "@/lib/demo/analyzeJob";
import {
  enqueueAnalyzeJob,
  getAnalyzeQueue,
  isAnalyzeWorkerAlive,
} from "@/lib/demo/analyzeQueue";
import { isDemoUploadName } from "@/lib/demo/decompress";
import { startAnalyzeJobInBackground } from "@/lib/demo/startAnalyzeJob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Enqueue assemble → decompress → analyze; spawn fallback if no worker is online. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      uploadId?: string;
      fileName?: string;
      totalChunks?: number;
    };
    const uploadId = String(body.uploadId ?? "");
    const fileName = String(body.fileName ?? "");
    const totalChunks = Number(body.totalChunks);

    if (!uploadId || !fileName || !Number.isInteger(totalChunks)) {
      return NextResponse.json(
        { error: "Missing uploadId, fileName, or totalChunks." },
        { status: 400 },
      );
    }
    if (!isDemoUploadName(fileName)) {
      return NextResponse.json(
        {
          error:
            "Only Counter-Strike 2 .dem or .dem.bz2 files are accepted.",
        },
        { status: 400 },
      );
    }

    const jobId = randomUUID();
    const payload = {
      kind: "upload" as const,
      jobId,
      uploadId,
      fileName,
      totalChunks,
    };
    await createAnalyzeJob(jobId);

    let workerAlive = false;
    try {
      workerAlive = await isAnalyzeWorkerAlive();
      if (!workerAlive) {
        const workers = await getAnalyzeQueue().getWorkers();
        workerAlive = workers.length > 0;
      }
    } catch {
      workerAlive = false;
    }

    if (workerAlive) {
      await enqueueAnalyzeJob(payload);
    } else {
      // No BullMQ consumer — process in a one-shot child (same image has the script).
      console.warn(
        `[upload-demo/complete] no analyze worker online — spawning one-shot for job=${jobId}`,
      );
      startAnalyzeJobInBackground(payload);
    }

    return NextResponse.json({ jobId, workerAlive });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to start analyze job.";
    console.error("[upload-demo/complete]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
