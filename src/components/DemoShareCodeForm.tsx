"use client";

import { useCallback, useEffect, useState } from "react";

type Props = {
  onAnalyzed: (data: unknown) => void;
  disabled?: boolean;
};

type AnalyzeStage = {
  step: number;
  title: string;
  detail: string;
  pct: number;
};

function formatElapsed(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`;
}

function stageForElapsed(ms: number): AnalyzeStage {
  const sec = ms / 1000;
  const pct = Math.min(94, Math.round(6 + Math.log1p(sec) * 22));

  if (sec < 4) {
    return {
      step: 1,
      title: "Decoding share code",
      detail: "Validating the match token…",
      pct: Math.max(6, pct),
    };
  }
  if (sec < 25) {
    return {
      step: 2,
      title: "Fetching from Steam",
      detail:
        "Requesting the demo from the Game Coordinator. This step is often the slowest.",
      pct,
    };
  }
  if (sec < 55) {
    return {
      step: 3,
      title: "Downloading demo",
      detail: "Pulling the replay file from Valve's servers…",
      pct,
    };
  }
  if (sec < 95) {
    return {
      step: 4,
      title: "Parsing demo",
      detail: "Building radar replay, stats, and round data…",
      pct,
    };
  }
  return {
    step: 5,
    title: "Running analysis",
    detail: "Cheat heuristics and player lookups — almost there.",
    pct,
  };
}

function AnalyzeWaitPanel({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsedMs = Math.max(0, now - startedAt);
  const stage = stageForElapsed(elapsedMs);
  const steps = [
    "Decode code",
    "Steam GC",
    "Download",
    "Parse demo",
    "Analyze",
  ];

  return (
    <div
      className="space-y-4 border border-[var(--amber)]/40 bg-[var(--surface)] px-4 py-5"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-[0.18em] text-[var(--amber)]">
            Working on your match
          </p>
          <p className="mt-2 text-base font-medium text-[var(--foreground)]">
            Please wait — this usually takes 1–3 minutes.
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Do not close or refresh this tab while analysis is running.
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-[family-name:var(--font-code)] text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
            Elapsed
          </p>
          <p className="mt-1 font-[family-name:var(--font-code)] text-lg text-[var(--foreground)]">
            {formatElapsed(elapsedMs)}
          </p>
        </div>
      </div>

      <ol className="grid gap-2 sm:grid-cols-5">
        {steps.map((label, index) => {
          const stepNum = index + 1;
          const active = stage.step === stepNum;
          const done = stage.step > stepNum;
          return (
            <li
              key={label}
              className={[
                "flex items-center gap-2 border px-2.5 py-2 text-xs",
                done
                  ? "border-[var(--border)] text-[var(--foreground)]"
                  : active
                    ? "border-[var(--amber)]/60 bg-[var(--amber)]/10 text-[var(--foreground)]"
                    : "border-[var(--border)] text-[var(--muted)]",
              ].join(" ")}
            >
              <span
                className={[
                  "flex h-5 w-5 shrink-0 items-center justify-center font-[family-name:var(--font-code)] text-[10px]",
                  done
                    ? "bg-[var(--foreground)] text-[var(--background)]"
                    : active
                      ? "bg-[var(--amber)] text-[var(--background)]"
                      : "border border-[var(--border)]",
                ].join(" ")}
                aria-hidden
              >
                {done ? "✓" : stepNum}
              </span>
              <span className="font-medium">{label}</span>
            </li>
          );
        })}
      </ol>

      <div className="h-2 overflow-hidden bg-[var(--border)]">
        <div
          className="h-full bg-[var(--amber)] transition-[width] duration-700 ease-out"
          style={{ width: `${stage.pct}%` }}
        />
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium text-[var(--foreground)]">
          {stage.title}
        </p>
        <p className="text-sm text-[var(--muted)]">{stage.detail}</p>
        {elapsedMs > 120_000 ? (
          <p className="text-xs text-[var(--muted)]">
            Still working — large demos or slow Steam responses can push this
            past 3 minutes.
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function DemoShareCodeForm({ onAnalyzed, disabled }: Props) {
  const [shareCode, setShareCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/upload-demo/from-share-code");
        const data = (await res.json().catch(() => ({}))) as {
          enabled?: boolean;
        };
        if (!cancelled) setEnabled(Boolean(data.enabled));
      } catch {
        if (!cancelled) setEnabled(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = useCallback(async () => {
    setError(null);
    const code = shareCode.trim();
    if (!code) {
      setError("Paste a match sharing code first.");
      return;
    }

    setLoading(true);
    setStartedAt(Date.now());

    try {
      const res = await fetch("/api/upload-demo/from-share-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareCode: code }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        result?: unknown;
        error?: string;
      };
      if (!res.ok || data.result == null) {
        throw new Error(data.error || `Analyze failed (${res.status})`);
      }

      onAnalyzed(data.result);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Share-code analyze failed.";
      setError(message);
    } finally {
      setLoading(false);
      setStartedAt(null);
    }
  }, [onAnalyzed, shareCode]);

  if (enabled === false) {
    return (
      <div className="border border-[var(--border)] bg-[var(--surface)] px-4 py-4 text-sm text-[var(--muted)]">
        <p className="font-[family-name:var(--font-display)] text-xs font-semibold uppercase tracking-[0.18em] text-[var(--amber)]">
          Match sharing code
        </p>
        <p className="mt-2 leading-relaxed">
          Share-code fetch is off. Set{" "}
          <span className="font-[family-name:var(--font-code)] text-[var(--foreground)]">
            STEAM_GC_ENABLED=true
          </span>{" "}
          on web and{" "}
          <span className="font-[family-name:var(--font-code)] text-[var(--foreground)]">
            STEAM_REFRESH_TOKEN
          </span>{" "}
          on the web service (see README).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {loading && startedAt != null ? (
        <AnalyzeWaitPanel startedAt={startedAt} />
      ) : null}

      <div
        className={[
          "border border-[var(--border)] bg-[var(--surface)] px-4 py-4",
          loading ? "opacity-60" : "",
        ].join(" ")}
        aria-hidden={loading}
      >
        <p className="font-[family-name:var(--font-display)] text-xs font-semibold uppercase tracking-[0.18em] text-[var(--amber)]">
          Match sharing code
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Paste a Valve MM code from Watch → Your Matches (
          <span className="font-[family-name:var(--font-code)] text-[var(--foreground)]">
            CSGO-…
          </span>
          ) or the full Steam copy URI. We auto-extract the `CSGO-...` token.
          Valve MM demos expire after ~30 days. FACEIT and other platforms are
          not supported.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={shareCode}
            onChange={(e) => setShareCode(e.target.value)}
            placeholder="CSGO-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
            disabled={disabled || loading || enabled === null}
            spellCheck={false}
            autoComplete="off"
            className="min-w-0 flex-1 border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-[family-name:var(--font-code)] text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--amber)]"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (!disabled && !loading) void submit();
              }
            }}
          />
          <button
            type="button"
            disabled={disabled || loading || enabled === null}
            onClick={() => void submit()}
            className="shrink-0 bg-[var(--amber)] px-4 py-2 text-sm font-semibold text-[var(--background)] transition-opacity disabled:opacity-50"
          >
            {loading ? "Analyzing…" : "Analyze"}
          </button>
        </div>
      </div>

      {!loading && error ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
