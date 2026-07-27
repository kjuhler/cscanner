"use client";

import { useCallback, useRef, useState } from "react";
import type { DemoLinkSource } from "@/lib/demo/demoLink";

type Props = {
  onImported: (
    data: unknown,
    source: DemoLinkSource,
    runId: string,
    expiresAt: number,
  ) => void;
  disabled?: boolean;
};

export function DemoImportForm({ onImported, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reanalyze, setReanalyze] = useState(true);

  const onSubmit = useCallback(
    async (file: File) => {
      setLoading(true);
      setError(null);
      try {
        const form = new FormData();
        form.append("file", file);
        if (reanalyze) form.append("reanalyze", "true");
        const res = await fetch("/api/demo/run/import", {
          method: "POST",
          body: form,
        });
        const data = (await res.json().catch(() => ({}))) as {
          result?: unknown;
          runId?: string;
          expiresAt?: number;
          error?: string;
        };
        if (!res.ok || data.result == null || !data.runId || !data.expiresAt) {
          throw new Error(data.error || `Import failed (${res.status})`);
        }
        onImported(
          data.result,
          { type: "run", runId: data.runId },
          data.runId,
          data.expiresAt,
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Import failed.");
      } finally {
        setLoading(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [onImported, reanalyze],
  );

  return (
    <div className="border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
      <p className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
        Import saved rundown
      </p>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Load a previously downloaded JSON export. A new 24-hour share link is
        created.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
          <input
            type="checkbox"
            checked={reanalyze}
            onChange={(e) => setReanalyze(e.target.checked)}
            disabled={disabled || loading}
            className="accent-[var(--amber)]"
          />
          Apply latest coaching rules
        </label>
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          disabled={disabled || loading}
          className="max-w-full text-xs text-[var(--muted)] file:mr-3 file:border file:border-[var(--border)] file:bg-[var(--bg-elevated)] file:px-3 file:py-2 file:text-xs file:font-semibold file:uppercase file:tracking-[0.12em] file:text-[var(--foreground)]"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onSubmit(file);
          }}
        />
        {loading ? (
          <span className="text-xs text-[var(--muted)]">Importing…</span>
        ) : null}
      </div>
      {error ? (
        <p className="mt-2 text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
