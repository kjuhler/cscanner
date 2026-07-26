import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createAnalyzeJob } from "@/lib/demo/analyzeJob";
import { enqueueAnalyzeJob } from "@/lib/demo/analyzeQueue";
import { isDemoUploadName } from "@/lib/demo/decompress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Enqueue assemble → decompress → analyze; worker picks up the job. */
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
    await createAnalyzeJob(jobId);
    await enqueueAnalyzeJob({
      jobId,
      uploadId,
      fileName,
      totalChunks,
    });

    return NextResponse.json({ jobId });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to start analyze job.";
    console.error("[upload-demo/complete]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
