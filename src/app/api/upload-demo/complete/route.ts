import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createAnalyzeJob } from "@/lib/demo/analyzeJob";
import { isDemoUploadName } from "@/lib/demo/decompress";
import { startAnalyzeJobInBackground } from "@/lib/demo/startAnalyzeJob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

/** Start assemble → decompress → analyze as a background job; client polls for progress. */
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

    // Forked worker (prod) so demoparser does not block / crash the HTTP process.
    startAnalyzeJobInBackground({
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
