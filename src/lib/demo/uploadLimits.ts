/** Shared upload limits (safe for client + server). */

export const MAX_DEMO_BYTES = 500 * 1024 * 1024; // 500 MB

/**
 * Chunk size for multipart uploads.
 * Kept under common reverse-proxy defaults (nginx client_max_body_size 1m).
 */
export const CHUNK_BYTES = 512 * 1024;
