import { NextResponse } from "next/server";
import {
  CHUNK_BYTES,
  initUploadSession,
  MAX_DEMO_BYTES,
  writeUploadChunk,
} from "@/lib/demo/uploadSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Receive one small chunk of a demo upload.
 * Chunks are kept under ~512KB so nginx/Cloudflare 1MB defaults still work.
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const uploadId = String(formData.get("uploadId") ?? "");
    const index = Number(formData.get("index"));
    const total = Number(formData.get("total"));
    const chunk = formData.get("chunk");

    if (!uploadId) {
      return NextResponse.json({ error: "Missing uploadId." }, { status: 400 });
    }
    if (!Number.isInteger(index) || index < 0) {
      return NextResponse.json({ error: "Invalid chunk index." }, { status: 400 });
    }
    if (!Number.isInteger(total) || total <= 0) {
      return NextResponse.json({ error: "Invalid chunk total." }, { status: 400 });
    }
    if (!(chunk instanceof Blob)) {
      return NextResponse.json({ error: "Missing chunk blob." }, { status: 400 });
    }
    if (chunk.size <= 0 || chunk.size > CHUNK_BYTES + 64 * 1024) {
      return NextResponse.json(
        { error: `Chunk too large (max ~${CHUNK_BYTES} bytes).` },
        { status: 413 },
      );
    }
    if (total * CHUNK_BYTES > MAX_DEMO_BYTES + CHUNK_BYTES) {
      return NextResponse.json(
        { error: "Demo file is too large (max 500 MB)." },
        { status: 413 },
      );
    }

    if (index === 0) await initUploadSession(uploadId);

    const data = Buffer.from(await chunk.arrayBuffer());
    await writeUploadChunk(uploadId, index, data);

    return NextResponse.json({
      ok: true,
      index,
      received: data.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Chunk upload failed.";
    console.error("[upload-demo/chunk]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
