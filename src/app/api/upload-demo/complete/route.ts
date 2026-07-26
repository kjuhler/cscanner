import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { analyzeDemo } from "@/lib/demo";
import {
  isBzip2DemoName,
  isDemoUploadName,
  writeDemoTempFile,
} from "@/lib/demo/decompress";
import {
  assembleUploadChunks,
  assembleUploadChunksToFile,
  cleanupUploadSession,
} from "@/lib/demo/uploadSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

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

/** Assemble uploaded chunks, decompress if needed, then analyze. */
export async function POST(request: Request) {
  let tempPath: string | null = null;
  let uploadId = "";
  const started = Date.now();

  try {
    assertDemoparserLoaded();

    const body = (await request.json()) as {
      uploadId?: string;
      fileName?: string;
      totalChunks?: number;
    };
    uploadId = String(body.uploadId ?? "");
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

    console.info(
      `[upload-demo/complete] assembling ${totalChunks} chunks for ${fileName}`,
    );

    tempPath = join(tmpdir(), `cscanner-demo-${randomUUID()}.dem`);

    if (isBzip2DemoName(fileName)) {
      // Need the full buffer for bzip2 stream helper.
      const buffer = await assembleUploadChunks(uploadId, totalChunks);
      console.info(
        `[upload-demo/complete] assembled ${(buffer.length / 1024 / 1024).toFixed(1)} MB, decompressing… (+${Date.now() - started}ms)`,
      );
      await writeDemoTempFile(buffer, tempPath, fileName);
    } else {
      const bytes = await assembleUploadChunksToFile(
        uploadId,
        totalChunks,
        tempPath,
      );
      console.info(
        `[upload-demo/complete] assembled ${(bytes / 1024 / 1024).toFixed(1)} MB… (+${Date.now() - started}ms)`,
      );
    }

    // Free chunk files before the heavy parse.
    await cleanupUploadSession(uploadId);
    uploadId = "";

    console.info(
      `[upload-demo/complete] analyzing… (+${Date.now() - started}ms)`,
    );
    const analysis = analyzeDemo(tempPath);
    console.info(
      `[upload-demo/complete] done in ${Date.now() - started}ms (map=${analysis.match.mapName})`,
    );
    return NextResponse.json(analysis);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to parse demo.";
    console.error("[upload-demo/complete]", err);
    return NextResponse.json({ error: message }, { status: 500 });
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
