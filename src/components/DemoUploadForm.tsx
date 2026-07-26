"use client";

import { useCallback, useRef, useState } from "react";

type Props = {
  onAnalyzed: (data: unknown) => void;
  disabled?: boolean;
};

/**
 * Stay under common nginx `client_max_body_size 1m` (multipart overhead included).
 * Single POSTs of large demos stall around ~1% behind that default.
 */
const CHUNK_BYTES = 512 * 1024;
const PARALLEL = 3;
/** Only tiny files use one request; real demos always chunk. */
const SINGLE_MAX_BYTES = 750 * 1024;
const SINGLE_TIMEOUT_MS = 2 * 60 * 1000;

function newUploadId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `up_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function uploadSingle(
  file: File,
  onProgress: (pct: number) => void,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload-demo");
    xhr.timeout = SINGLE_TIMEOUT_MS;

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable || e.total <= 0) return;
      onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.upload.onload = () => onProgress(100);

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

async function postChunk(
  uploadId: string,
  index: number,
  total: number,
  blob: Blob,
): Promise<void> {
  const body = new FormData();
  body.append("uploadId", uploadId);
  body.append("index", String(index));
  body.append("total", String(total));
  body.append("chunk", blob, `part-${index}`);

  const res = await fetch("/api/upload-demo/chunk", {
    method: "POST",
    body,
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    throw new Error(
      data.error || `Chunk ${index + 1}/${total} failed (${res.status})`,
    );
  }
}

async function completeUpload(
  uploadId: string,
  fileName: string,
  totalChunks: number,
): Promise<unknown> {
  const res = await fetch("/api/upload-demo/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uploadId, fileName, totalChunks }),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Analyze failed (${res.status})`);
  }
  return data;
}

async function uploadChunked(
  file: File,
  onProgress: (label: string) => void,
): Promise<unknown> {
  const sizeMb = file.size / (1024 * 1024);
  const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_BYTES));
  const uploadId = newUploadId();
  let next = 0;
  let done = 0;

  onProgress(
    `Uploading in ${totalChunks} chunks (0% of ${sizeMb.toFixed(0)} MB)…`,
  );

  async function worker() {
    while (next < totalChunks) {
      const i = next;
      next += 1;
      const start = i * CHUNK_BYTES;
      const end = Math.min(file.size, start + CHUNK_BYTES);
      await postChunk(uploadId, i, totalChunks, file.slice(start, end));
      done += 1;
      const pct = Math.round((done / totalChunks) * 100);
      onProgress(
        `Uploading ${pct}% (${done}/${totalChunks} chunks · ${sizeMb.toFixed(0)} MB)…`,
      );
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(PARALLEL, totalChunks) }, () => worker()),
  );

  onProgress("Uploaded — parsing & analyzing on server (can take 1–3 min)…");
  return completeUpload(uploadId, file.name, totalChunks);
}

export function DemoUploadForm({ onAnalyzed, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

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

      const sizeMb = file.size / (1024 * 1024);
      setLoading(true);

      try {
        // Real demos are >> 1 MB; single POST hangs at ~1% behind nginx 1m.
        if (file.size > SINGLE_MAX_BYTES) {
          const analysis = await uploadChunked(file, setProgress);
          onAnalyzed(analysis);
          setProgress(null);
          return;
        }

        setProgress(
          sizeMb >= 0.1
            ? `Uploading demo (0% of ${sizeMb.toFixed(1)} MB)…`
            : "Uploading demo…",
        );

        const result = await uploadSingle(file, (pct) => {
          if (pct < 100) {
            setProgress(
              `Uploading demo (${pct}% of ${sizeMb.toFixed(1)} MB)…`,
            );
          } else {
            setProgress(
              "Uploaded — parsing & analyzing on server (can take 1–3 min)…",
            );
          }
        });

        if (!result.ok) {
          const payload = result.data as { error?: string };
          throw new Error(payload.error || `Upload failed (${result.status})`);
        }

        onAnalyzed(result.data);
        setProgress(null);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Upload failed.";
        setError(message);
        setProgress(null);
      } finally {
        setLoading(false);
      }
    },
    [onAnalyzed],
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
        <p className="text-sm text-[var(--amber)]">{progress}</p>
      ) : null}
      {error ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
