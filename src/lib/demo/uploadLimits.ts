/** Shared upload limits (safe for client + server). */

export const MAX_DEMO_BYTES = 500 * 1024 * 1024; // 500 MB

/** Prefer one request; fallback chunks stay under common 5–10m proxy limits. */
export const CHUNK_BYTES = 2 * 1024 * 1024;
