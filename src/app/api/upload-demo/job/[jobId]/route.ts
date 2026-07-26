import { NextResponse } from "next/server";
import {
  readAnalyzeJob,
  readAnalyzeJobResult,
} from "@/lib/demo/analyzeJob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Poll analyze job progress; include result when done. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  try {
    const { jobId } = await context.params;
    if (!jobId || !/^[a-zA-Z0-9_-]{8,80}$/.test(jobId)) {
      return NextResponse.json({ error: "Invalid job id." }, { status: 400 });
    }

    const status = await readAnalyzeJob(jobId);
    if (!status) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    if (status.done && status.stage === "done" && !status.error) {
      const result = await readAnalyzeJobResult(jobId);
      if (!result) {
        return NextResponse.json(
          {
            ...status,
            error: "Analysis finished but result is missing.",
            done: true,
            stage: "error",
          },
          { status: 500 },
        );
      }
      return NextResponse.json({ ...status, result });
    }

    return NextResponse.json(status);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to read job.";
    console.error("[upload-demo/job]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
