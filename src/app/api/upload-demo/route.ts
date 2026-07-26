import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { analyzeDemo } from "@/lib/demo";
import {
  isDemoUploadName,
  writeDemoTempFile,
} from "@/lib/demo/decompress";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 500 * 1024 * 1024; // 500 MB

export async function POST(request: Request) {
  let tempPath: string | null = null;

  try {
    const contentLength = request.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_BYTES) {
      return NextResponse.json(
        { error: "Demo file is too large (max 500 MB)." },
        { status: 413 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("demo");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'Missing file field "demo".' },
        { status: 400 },
      );
    }

    if (!isDemoUploadName(file.name)) {
      return NextResponse.json(
        {
          error:
            "Only Counter-Strike 2 .dem or .dem.bz2 files are accepted.",
        },
        { status: 400 },
      );
    }

    if (file.size <= 0) {
      return NextResponse.json(
        { error: "Uploaded file is empty." },
        { status: 400 },
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Demo file is too large (max 500 MB)." },
        { status: 413 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    tempPath = join(tmpdir(), `cscanner-demo-${randomUUID()}.dem`);
    await writeDemoTempFile(buffer, tempPath, file.name);

    const analysis = analyzeDemo(tempPath);
    return NextResponse.json(analysis);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to parse demo.";
    console.error("[upload-demo]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    if (tempPath) {
      try {
        await unlink(tempPath);
      } catch {
        // ignore cleanup errors
      }
    }
  }
}
