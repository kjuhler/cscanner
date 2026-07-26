"use client";

import { useCallback, useRef, useState } from "react";
import { CHUNK_BYTES } from "@/lib/demo/uploadLimits";

type Props = {
  onAnalyzed: (data: unknown) => void;
  disabled?: boolean;
};

function newUploadId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `up_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
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
    throw new Error(data.error || `Chunk ${index + 1}/${total} failed (${res.status})`);
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
      const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_BYTES));
      const uploadId = newUploadId();

      setLoading(true);
      setProgress(
        `Uploading in ${totalChunks} chunks (0% of ${sizeMb.toFixed(0)} MB)…`,
      );

      try {
        for (let i = 0; i < totalChunks; i++) {
          const start = i * CHUNK_BYTES;
          const end = Math.min(file.size, start + CHUNK_BYTES);
          const blob = file.slice(start, end);
          await postChunk(uploadId, i, totalChunks, blob);

          const pct = Math.round(((i + 1) / totalChunks) * 100);
          setProgress(
            `Uploading in chunks (${pct}% · ${i + 1}/${totalChunks} · ${sizeMb.toFixed(0)} MB)…`,
          );
        }

        setProgress("Uploaded — parsing & analyzing on server…");
        const analysis = await completeUpload(uploadId, file.name, totalChunks);
        onAnalyzed(analysis);
        setProgress(null);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Upload failed.";
        setError(
          /fail|network|413|proxy|timeout/i.test(message)
            ? `${message} If this keeps happening behind nginx, set client_max_body_size 500m;`
            : message,
        );
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
          or click to browse. Large files upload in small chunks (proxy-safe).
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
