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
export const dynamic = "force-dynamic";
/** Large demos + dense tick parse can exceed 2 minutes on small hosts. */
export const maxDuration = 600;

const MAX_BYTES = 500 * 1024 * 1024; // 500 MB

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

export async function POST(request: Request) {
  let tempPath: string | null = null;
  const started = Date.now();

  try {
    assertDemoparserLoaded();

    const contentLength = request.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_BYTES) {
      return NextResponse.json(
        { error: "Demo file is too large (max 500 MB)." },
        { status: 413 },
      );
    }

    console.info("[upload-demo] receiving formData…");
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

    console.info(
      `[upload-demo] got ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB) after ${Date.now() - started}ms`,
    );

    const buffer = Buffer.from(await file.arrayBuffer());
    tempPath = join(tmpdir(), `cscanner-demo-${randomUUID()}.dem`);
    await writeDemoTempFile(buffer, tempPath, file.name);

    console.info(
      `[upload-demo] written temp demo, analyzing… (+${Date.now() - started}ms)`,
    );
    const analysis = analyzeDemo(tempPath);
    console.info(
      `[upload-demo] done in ${Date.now() - started}ms (map=${analysis.match.mapName})`,
    );
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

/** Quick health check: confirms the route + native parser are alive. */
export async function GET() {
  try {
    assertDemoparserLoaded();
    return NextResponse.json({ ok: true, demoparser: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
