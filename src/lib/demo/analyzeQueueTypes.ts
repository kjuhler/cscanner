/** Shared queue name — safe for web and worker (no server-only). */
export const ANALYZE_QUEUE_NAME = "analyze";

export type AnalyzeQueuePayload = {
  jobId: string;
  uploadId: string;
  fileName: string;
  totalChunks: number;
};
