import { createWriteStream } from "node:fs";
import {
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { MAX_DEMO_BYTES } from "./uploadLimits";

export { CHUNK_BYTES, MAX_DEMO_BYTES } from "./uploadLimits";

export function uploadSessionDir(uploadId: string): string {
  // Only allow UUID-like ids in path segments.
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(uploadId)) {
    throw new Error("Invalid upload id.");
  }
  return join(tmpdir(), "cscanner-uploads", uploadId);
}

export async function initUploadSession(uploadId: string): Promise<void> {
  await mkdir(uploadSessionDir(uploadId), { recursive: true });
}

export async function writeUploadChunk(
  uploadId: string,
  index: number,
  data: Buffer,
): Promise<void> {
  if (!Number.isInteger(index) || index < 0 || index > 200_000) {
    throw new Error("Invalid chunk index.");
  }
  const dir = uploadSessionDir(uploadId);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${index}.part`), data);
}

export async function assembleUploadChunks(
  uploadId: string,
  totalChunks: number,
): Promise<Buffer> {
  if (!Number.isInteger(totalChunks) || totalChunks <= 0 || totalChunks > 200_000) {
    throw new Error("Invalid chunk count.");
  }
  const dir = uploadSessionDir(uploadId);
  const parts: Buffer[] = [];
  let total = 0;
  for (let i = 0; i < totalChunks; i++) {
    const partPath = join(dir, `${i}.part`);
    const buf = await readFile(partPath);
    total += buf.length;
    if (total > MAX_DEMO_BYTES) {
      throw new Error("Demo file is too large (max 500 MB).");
    }
    parts.push(buf);
  }
  return Buffer.concat(parts, total);
}

export async function cleanupUploadSession(uploadId: string): Promise<void> {
  try {
    await rm(uploadSessionDir(uploadId), { recursive: true, force: true });
  } catch {
    // ignore
  }
}

/** Debug helper — list part files in a session. */
export async function listUploadParts(uploadId: string): Promise<string[]> {
  try {
    return await readdir(uploadSessionDir(uploadId));
  } catch {
    return [];
  }
}

export async function writeBufferToPath(
  buffer: Buffer,
  destPath: string,
): Promise<void> {
  await pipeline(Readable.from(buffer), createWriteStream(destPath));
}
