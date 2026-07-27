/** Shared queue name — safe for web and worker (no server-only). */
export const ANALYZE_QUEUE_NAME = "analyze";

export type AnalyzeUploadPayload = {
  kind?: "upload";
  jobId: string;
  uploadId: string;
  fileName: string;
  totalChunks: number;
};

export type AnalyzeShareCodePayload = {
  kind: "shareCode";
  jobId: string;
  shareCode: string;
};

export type AnalyzeQueuePayload =
  | AnalyzeUploadPayload
  | AnalyzeShareCodePayload;

export function isShareCodePayload(
  payload: AnalyzeQueuePayload,
): payload is AnalyzeShareCodePayload {
  return payload.kind === "shareCode";
}

/** Normalize legacy payloads that omit `kind`. */
export function asUploadPayload(
  payload: AnalyzeQueuePayload,
): AnalyzeUploadPayload | null {
  if (payload.kind === "shareCode") return null;
  if (
    "uploadId" in payload &&
    "fileName" in payload &&
    "totalChunks" in payload
  ) {
    return payload;
  }
  return null;
}
