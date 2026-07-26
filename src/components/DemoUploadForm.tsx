"use client";

import { useCallback, useRef, useState } from "react";
import {
  CHUNK_BYTES,
  MAX_DEMO_BYTES,
  SINGLE_MAX_BYTES,
  UPLOAD_PARALLEL,
} from "@/lib/demo/uploadLimits";

type Props = {
  onAnalyzed: (data: unknown) => void;
  disabled?: boolean;
};

type Phase = "idle" | "upload" | "process";

type ProgressState = {
  phase: Phase;
  label: string;
  pct: number;
  detail: string;
};

const SINGLE_TIMEOUT_MS = 2 * 60 * 1000;
const CHUNK_RETRIES = 2;
const POLL_MS = 400;

function stageTitle(stage: string): string {
  switch (stage) {
    case "queued":
      return "Queued";
    case "assembling":
      return "Assembling";
    case "decompressing":
      return "Decompressing";
    case "parsing":
      return "Parsing demo";
    case "analyzing":
      return "Analyzing";
    case "replay":
      return "Building replay";
    case "done":
      return "Done";
    case "error":
      return "Failed";
    default:
      return stage;
  }
}

function newUploadId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `up_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function formatMb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1);
}

function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "…";
  if (seconds < 5) return "<5s";
  if (seconds < 60) return `~${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `~${m}m ${s}s`;
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function uploadSingle(
  file: File,
  onBytes: (loaded: number, total: number) => void,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload-demo");
    xhr.timeout = SINGLE_TIMEOUT_MS;

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable || e.total <= 0) return;
      onBytes(e.loaded, e.total);
    };
    xhr.upload.onload = () => onBytes(file.size, file.size);

    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.ontimeout = () =>
      reject(new Error("Upload timed out — try again or use a smaller file."));
    xhr.onload = () => {
      let data: unknown = {};
      try {
        data = JSON.parse(xhr.responseText || "{}");
      } catch {
        data = { error: xhr.responseText || "Invalid server response." };
      }
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        data,
      });
    };

    const body = new FormData();
    body.append("demo", file);
    xhr.send(body);
  });
}

function postChunkXhr(
  uploadId: string,
  index: number,
  total: number,
  blob: Blob,
  onLoaded: (loaded: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload-demo/chunk");
    xhr.timeout = 120_000;

    let lastLoaded = 0;
    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const delta = Math.max(0, e.loaded - lastLoaded);
      lastLoaded = e.loaded;
      if (delta > 0) onLoaded(delta);
    };
    xhr.upload.onload = () => {
      const remaining = Math.max(0, blob.size - lastLoaded);
      if (remaining > 0) onLoaded(remaining);
      lastLoaded = blob.size;
    };

    xhr.onerror = () => reject(new Error("network"));
    xhr.ontimeout = () => reject(new Error("timeout"));
    xhr.onload = () => {
      let data: { error?: string } = {};
      try {
        data = JSON.parse(xhr.responseText || "{}") as { error?: string };
      } catch {
        data = {};
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(
          new Error(
            data.error || `Chunk ${index + 1}/${total} failed (${xhr.status})`,
          ),
        );
        return;
      }
      resolve();
    };

    const body = new FormData();
    body.append("uploadId", uploadId);
    body.append("index", String(index));
    body.append("total", String(total));
    body.append("chunk", blob, `part-${index}`);
    xhr.send(body);
  });
}

async function postChunkWithRetry(
  uploadId: string,
  index: number,
  total: number,
  blob: Blob,
  onLoaded: (loaded: number) => void,
): Promise<void> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= CHUNK_RETRIES; attempt++) {
    let credited = 0;
    try {
      await postChunkXhr(uploadId, index, total, blob, (delta) => {
        credited += delta;
        onLoaded(delta);
      });
      return;
    } catch (err) {
      lastErr = err;
      // Roll back optimistic bytes so retries don't inflate progress.
      if (credited > 0) onLoaded(-credited);
      if (attempt < CHUNK_RETRIES) {
        await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
      }
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error(`Chunk ${index + 1}/${total} failed`);
}

async function startCompleteJob(
  uploadId: string,
  fileName: string,
  totalChunks: number,
): Promise<string> {
  const res = await fetch("/api/upload-demo/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uploadId, fileName, totalChunks }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    jobId?: string;
    error?: string;
  };
  if (!res.ok || !data.jobId) {
    throw new Error(data.error || `Analyze failed to start (${res.status})`);
  }
  return data.jobId;
}

async function pollJob(
  jobId: string,
  onProgress: (pct: number, detail: string, stage: string) => void,
): Promise<unknown> {
  for (;;) {
    const res = await fetch(`/api/upload-demo/job/${encodeURIComponent(jobId)}`);
    const data = (await res.json().catch(() => ({}))) as {
      done?: boolean;
      pct?: number;
      detail?: string;
      stage?: string;
      error?: string;
      result?: unknown;
    };
    if (!res.ok) {
      throw new Error(data.error || `Job poll failed (${res.status})`);
    }

    onProgress(
      typeof data.pct === "number" ? data.pct : 0,
      data.detail || "Processing…",
      data.stage || "processing",
    );

    if (data.done) {
      if (data.error || data.stage === "error") {
        throw new Error(data.error || data.detail || "Analyze failed.");
      }
      if (data.result == null) {
        throw new Error("Analyze finished without a result.");
      }
      return data.result;
    }

    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

function ProgressPanel({
  progress,
  startedAt,
}: {
  progress: ProgressState;
  startedAt: number | null;
}) {
  const elapsed =
    startedAt != null ? formatElapsed(Date.now() - startedAt) : null;
  const uploadDone = progress.phase === "process" || progress.pct >= 100;
  const analyzing = progress.phase === "process";

  return (
    <div className="space-y-3 border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
      <ol className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-0">
        <li
          className={[
            "flex items-center gap-2 text-sm font-medium",
            uploadDone
              ? "text-[var(--foreground)]"
              : "text-[var(--amber)]",
          ].join(" ")}
        >
          <span
            className={[
              "flex h-6 w-6 shrink-0 items-center justify-center text-xs font-[family-name:var(--font-code)]",
              uploadDone
                ? "bg-[var(--foreground)] text-[var(--background)]"
                : "bg-[var(--amber)] text-[var(--background)]",
            ].join(" ")}
            aria-hidden
          >
            {uploadDone ? "✓" : "1"}
          </span>
          <span>
            {uploadDone ? "Upload complete" : "Uploading file"}
            {!uploadDone ? (
              <span className="ml-1.5 font-normal text-[var(--muted)]">
                {Math.round(progress.pct)}%
              </span>
            ) : null}
          </span>
        </li>

        <li
          className="mx-3 hidden h-px flex-1 bg-[var(--border)] sm:block"
          aria-hidden
        />

        <li
          className={[
            "flex items-center gap-2 text-sm font-medium",
            analyzing
              ? "text-[var(--amber)]"
              : "text-[var(--muted)]",
          ].join(" ")}
        >
          <span
            className={[
              "flex h-6 w-6 shrink-0 items-center justify-center text-xs font-[family-name:var(--font-code)]",
              analyzing
                ? "bg-[var(--amber)] text-[var(--background)]"
                : "border border-[var(--border)] text-[var(--muted)]",
            ].join(" ")}
            aria-hidden
          >
            {analyzing && progress.pct >= 100 ? "✓" : "2"}
          </span>
          <span>
            {analyzing ? "Analyzing on server" : "Analyze (waiting)"}
            {analyzing ? (
              <span className="ml-1.5 font-normal text-[var(--muted)]">
                {Math.round(progress.pct)}%
              </span>
            ) : null}
          </span>
        </li>

        {elapsed ? (
          <li className="ml-auto font-[family-name:var(--font-code)] text-xs text-[var(--muted)]">
            {elapsed}
          </li>
        ) : null}
      </ol>

      <div className="h-1.5 overflow-hidden bg-[var(--border)]">
        <div
          className="h-full bg-[var(--amber)] transition-[width] duration-200 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, progress.pct))}%` }}
        />
      </div>

      {analyzing ? (
        <p className="text-sm text-[var(--foreground)]">
          Upload is done. Server is working — this can take 1–3 minutes.
        </p>
      ) : null}

      <p className="text-sm text-[var(--muted)]">{progress.label}</p>
      {progress.detail ? (
        <p className="font-[family-name:var(--font-code)] text-xs text-[var(--foreground)]/80">
          {progress.detail}
        </p>
      ) : null}
    </div>
  );
}

export function DemoUploadForm({ onAnalyzed, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  // Force re-render so elapsed clock ticks while loading.
  const [, setTick] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startClock = useCallback(() => {
    const t0 = Date.now();
    setStartedAt(t0);
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => setTick((n) => n + 1), 1000);
    return t0;
  }, []);

  const stopClock = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const uploadChunked = useCallback(
    async (
      file: File,
      onUploadProgress: (state: ProgressState) => void,
    ): Promise<unknown> => {
      const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_BYTES));
      const uploadId = newUploadId();
      let next = 0;
      let uploadedBytes = 0;
      const t0 = Date.now();
      let lastReport = 0;

      const report = () => {
        const now = Date.now();
        if (now - lastReport < 80 && uploadedBytes < file.size) return;
        lastReport = now;
        const elapsedSec = Math.max(0.001, (now - t0) / 1000);
        const speed = uploadedBytes / elapsedSec;
        const remaining = Math.max(0, file.size - uploadedBytes);
        const eta = speed > 0 ? remaining / speed : Number.POSITIVE_INFINITY;
        const pct = Math.min(
          99,
          Math.round((uploadedBytes / file.size) * 100),
        );
        onUploadProgress({
          phase: "upload",
          pct,
          label: `${formatMb(uploadedBytes)} / ${formatMb(file.size)} MB · ${formatMb(speed)} MB/s · ETA ${formatEta(eta)}`,
          detail: `${totalChunks} × ${formatMb(CHUNK_BYTES)} MB chunks · ${UPLOAD_PARALLEL} parallel`,
        });
      };

      report();

      async function worker() {
        while (next < totalChunks) {
          const i = next;
          next += 1;
          const start = i * CHUNK_BYTES;
          const end = Math.min(file.size, start + CHUNK_BYTES);
          await postChunkWithRetry(
            uploadId,
            i,
            totalChunks,
            file.slice(start, end),
            (delta) => {
              uploadedBytes = Math.max(
                0,
                Math.min(file.size, uploadedBytes + delta),
              );
              report();
            },
          );
        }
      }

      await Promise.all(
        Array.from(
          { length: Math.min(UPLOAD_PARALLEL, totalChunks) },
          () => worker(),
        ),
      );

      onUploadProgress({
        phase: "process",
        pct: 0,
        label: "Upload finished — starting analysis on the server…",
        detail: "Queued",
      });

      const jobId = await startCompleteJob(uploadId, file.name, totalChunks);

      return pollJob(jobId, (pct, detail, stage) => {
        onUploadProgress({
          phase: "process",
          pct,
          label: detail,
          detail: stageTitle(stage),
        });
      });
    },
    [],
  );

  const upload = useCallback(
    async (file: File) => {
      setError(null);
      setFileName(file.name);

      const lower = file.name.toLowerCase();
      const ok =
        lower.endsWith(".dem") ||
        lower.endsWith(".dem.bz2") ||
        lower.endsWith(".bz2");
      if (!ok) {
        setError("Please choose a .dem or .dem.bz2 file.");
        return;
      }
      if (file.size > MAX_DEMO_BYTES) {
        setError("Demo file is too large (max 500 MB).");
        return;
      }

      setLoading(true);
      startClock();

      try {
        if (file.size > SINGLE_MAX_BYTES) {
          const analysis = await uploadChunked(file, setProgress);
          onAnalyzed(analysis);
          setProgress(null);
          return;
        }

        setProgress({
          phase: "upload",
          pct: 0,
          label: `Uploading ${formatMb(file.size)} MB…`,
          detail: "Single request",
        });

        const t0 = Date.now();
        const result = await uploadSingle(file, (loaded, total) => {
          const elapsedSec = Math.max(0.001, (Date.now() - t0) / 1000);
          const speed = loaded / elapsedSec;
          const eta =
            speed > 0
              ? (total - loaded) / speed
              : Number.POSITIVE_INFINITY;
          setProgress({
            phase: "upload",
            pct: Math.min(99, Math.round((loaded / total) * 100)),
            label: `${formatMb(loaded)} / ${formatMb(total)} MB · ${formatMb(speed)} MB/s · ETA ${formatEta(eta)}`,
            detail: "Single request",
          });
        });

        if (!result.ok) {
          const payload = result.data as { error?: string };
          throw new Error(payload.error || `Upload failed (${result.status})`);
        }

        setProgress({
          phase: "process",
          pct: 100,
          label: "Uploaded — analysis complete",
          detail: "done",
        });
        onAnalyzed(result.data);
        setProgress(null);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Upload failed.";
        setError(message);
        setProgress(null);
      } finally {
        stopClock();
        setLoading(false);
        setStartedAt(null);
      }
    },
    [onAnalyzed, startClock, stopClock, uploadChunked],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (disabled || loading) return;
      const file = e.dataTransfer.files?.[0];
      if (file) void upload(file);
    },
    [disabled, loading, upload],
  );

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragging(false);
        }}
        onDrop={onDrop}
        onClick={() => {
          if (!disabled && !loading) inputRef.current?.click();
        }}
        className={[
          "cursor-pointer border border-dashed px-6 py-12 text-center transition-colors",
          dragging
            ? "border-[var(--amber)] bg-[var(--amber)]/10"
            : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--amber)]/50",
          disabled || loading ? "pointer-events-none opacity-60" : "",
        ].join(" ")}
      >
        <p className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-[0.18em] text-[var(--amber)]">
          Upload CS2 demo
        </p>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Drag &amp; drop a{" "}
          <span className="text-[var(--foreground)]">.dem</span> or{" "}
          <span className="text-[var(--foreground)]">.dem.bz2</span> file here,
          or click to browse.
        </p>
        {fileName ? (
          <p className="mt-4 font-[family-name:var(--font-code)] text-xs text-[var(--foreground)]">
            {fileName}
          </p>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          accept=".dem,.bz2,.dem.bz2,application/octet-stream,application/x-bzip2"
          className="hidden"
          disabled={disabled || loading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
            e.target.value = "";
          }}
        />
      </div>

      {loading && progress ? (
        <ProgressPanel progress={progress} startedAt={startedAt} />
      ) : null}
      {error ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
