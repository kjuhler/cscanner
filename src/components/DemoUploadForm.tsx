"use client";

import { useCallback, useRef, useState } from "react";

type Props = {
  onAnalyzed: (data: unknown) => void;
  disabled?: boolean;
};

function uploadWithProgress(
  file: File,
  onProgress: (pct: number) => void,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload-demo");
    xhr.timeout = 10 * 60 * 1000; // 10 min for large demos

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable || e.total <= 0) return;
      onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.upload.onload = () => onProgress(100);

    xhr.onerror = () =>
      reject(new Error("Network error while uploading (proxy/timeout?)."));
    xhr.ontimeout = () =>
      reject(
        new Error(
          "Upload timed out after 10 minutes. Try a smaller demo or check reverse-proxy timeouts.",
        ),
      );

    xhr.onload = () => {
      let data: unknown = null;
      try {
        data = JSON.parse(xhr.responseText || "{}");
      } catch {
        data = { error: xhr.responseText || "Invalid server response." };
      }
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, data });
    };

    const body = new FormData();
    body.append("demo", file);
    xhr.send(body);
  });
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
      setProgress(
        sizeMb >= 1
          ? `Uploading demo (0% of ${sizeMb.toFixed(0)} MB)…`
          : "Uploading demo…",
      );

      try {
        const { ok: httpOk, status, data } = await uploadWithProgress(
          file,
          (pct) => {
            if (pct < 100) {
              setProgress(
                `Uploading demo (${pct}% of ${sizeMb.toFixed(0)} MB)…`,
              );
            } else {
              setProgress("Uploaded — parsing & analyzing on server…");
            }
          },
        );

        const payload = data as { error?: string };
        if (!httpOk) {
          throw new Error(
            payload.error || `Upload failed (${status || "unknown"})`,
          );
        }

        onAnalyzed(data);
        setProgress(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed.");
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
