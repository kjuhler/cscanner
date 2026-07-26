/** Shared upload limits (safe for client + server). */

export const MAX_DEMO_BYTES = 500 * 1024 * 1024; // 500 MB

/** Concurrent chunk uploads (client). */
export const UPLOAD_PARALLEL = 6;

/**
 * Chunk size for multipart uploads.
 * Default 512 KB stays under nginx `client_max_body_size 1m`.
 * Raise via NEXT_PUBLIC_UPLOAD_CHUNK_KB (e.g. 4096) after increasing the proxy limit.
 */
function resolveChunkBytes(): number {
  const raw = process.env.NEXT_PUBLIC_UPLOAD_CHUNK_KB;
  const kb = raw != null && raw !== "" ? Number(raw) : 512;
  if (!Number.isFinite(kb) || kb < 64 || kb > 32 * 1024) {
    return 512 * 1024;
  }
  return Math.floor(kb) * 1024;
}

export const CHUNK_BYTES = resolveChunkBytes();

/** Only tiny files use a single POST; real demos always chunk. */
export const SINGLE_MAX_BYTES = 750 * 1024;
