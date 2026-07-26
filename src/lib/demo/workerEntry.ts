/**
 * Entry for the forked analyze worker (bundled to analyze-worker.cjs).
 * Runs demoparser off the Next.js request process so job polls stay responsive.
 */
import { runAnalyzeUploadJob } from "./runAnalyzeUploadJob";

async function main() {
  const [jobId, uploadId, fileName, totalChunksStr] = process.argv.slice(2);
  if (!jobId || !uploadId || !fileName || !totalChunksStr) {
    console.error(
      "Usage: analyze-worker <jobId> <uploadId> <fileName> <totalChunks>",
    );
    process.exit(2);
  }

  const totalChunks = Number(totalChunksStr);
  if (!Number.isInteger(totalChunks) || totalChunks <= 0) {
    console.error("Invalid totalChunks");
    process.exit(2);
  }

  console.info(
    `[analyze-worker] start job=${jobId} upload=${uploadId} file=${fileName} chunks=${totalChunks}`,
  );

  await runAnalyzeUploadJob({
    jobId,
    uploadId,
    fileName,
    totalChunks,
  });
}

main()
  .then(() => {
    console.info("[analyze-worker] exit 0");
    process.exit(0);
  })
  .catch((err) => {
    console.error("[analyze-worker] fatal", err);
    process.exit(1);
  });
