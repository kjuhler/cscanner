"use client";

import { useCallback, useState } from "react";
import {
  EXAMPLE_DEMO_LABEL,
  EXAMPLE_DEMO_PUBLIC_URL,
} from "@/lib/demo/exampleDemo";
import type { DemoLinkSource } from "@/lib/demo/demoLink";
import {
  extractAnalysisFromPayload,
  isDemoAnalysis,
} from "@/lib/demo/validateAnalysis";

type Props = {
  onAnalyzed: (data: unknown, source: DemoLinkSource) => void;
  disabled?: boolean;
};

export function DemoExampleButton({ onAnalyzed, disabled }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadExample = useCallback(async () => {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(EXAMPLE_DEMO_PUBLIC_URL);
      const data = (await res.json().catch(() => ({}))) as unknown;
      if (!res.ok) {
        throw new Error(`Example load failed (${res.status})`);
      }
      const result = extractAnalysisFromPayload(data);
      if (!isDemoAnalysis(result)) {
        throw new Error("Bundled example JSON is invalid.");
      }
      onAnalyzed(result, { type: "example" });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Example demo load failed.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [onAnalyzed]);

  return (
    <div className="space-y-3">
      <div
        className={[
          "border border-[var(--border)] bg-[var(--surface)] px-4 py-4",
          loading ? "opacity-60" : "",
        ].join(" ")}
      >
        <p className="font-[family-name:var(--font-display)] text-xs font-semibold uppercase tracking-[0.18em] text-[var(--amber)]">
          Example demo
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Try the analyzer without a share code or Steam login. Uses the bundled
          pro match{" "}
          <span className="text-[var(--foreground)]">{EXAMPLE_DEMO_LABEL}</span>
          .
        </p>
        <button
          type="button"
          disabled={disabled || loading}
          onClick={() => void loadExample()}
          className="mt-4 border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition-colors hover:border-[var(--amber)]/60 disabled:opacity-50"
        >
          {loading ? "Loading example…" : "Reload example demo"}
        </button>
      </div>

      {!loading && error ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
