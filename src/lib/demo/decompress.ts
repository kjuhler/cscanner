import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import unbzip2Stream from "unbzip2-stream";

/** True if filename looks like a Valve demo (.dem or compressed .dem.bz2 / .bz2). */
export function isDemoUploadName(filename: string): boolean {
  const name = filename.toLowerCase();
  return (
    name.endsWith(".dem") ||
    name.endsWith(".dem.bz2") ||
    name.endsWith(".bz2")
  );
}

export function isBzip2DemoName(filename: string): boolean {
  const name = filename.toLowerCase();
  return name.endsWith(".dem.bz2") || name.endsWith(".bz2");
}

/**
 * Magics: bzip2 files start with "BZ". Plain CS2 demos start with "PBDEMS2"
 * (Source 2) or older "HL2DEMO".
 */
export function looksLikeBzip2(buffer: Buffer): boolean {
  return buffer.length >= 2 && buffer[0] === 0x42 && buffer[1] === 0x5a;
}

/**
 * Write uploaded bytes to a .dem path, decompressing bzip2 when needed.
 */
export async function writeDemoTempFile(
  buffer: Buffer,
  destPath: string,
  originalName: string,
): Promise<void> {
  const shouldDecompress =
    isBzip2DemoName(originalName) || looksLikeBzip2(buffer);

  if (!shouldDecompress) {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(destPath, buffer);
    return;
  }

  try {
    await pipeline(
      Readable.from(buffer),
      unbzip2Stream(),
      createWriteStream(destPath),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to decompress .bz2 demo: ${message}`);
  }
}
