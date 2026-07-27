"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { DemoImportForm } from "@/components/DemoImportForm";
import { DemoResults } from "@/components/DemoResults";
import { DemoShareCodeForm } from "@/components/DemoShareCodeForm";
import { SiteHeader } from "@/components/SiteHeader";
import {
  buildExamplePath,
  buildRunPath,
  parseDemoLink,
  type DemoLinkSource,
} from "@/lib/demo/demoLink";
import type { DemoAnalysis } from "@/lib/demo";
import {
  fetchShareCodeDemo,
  persistDemoRun,
} from "@/app/demo/demoShared";
import { isDemoAnalysis, normalizeAnalysis } from "@/lib/demo/validateAnalysis";

function DemoLabContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [analysis, setAnalysis] = useState<DemoAnalysis | null>(null);
  const [autoError, setAutoError] = useState<string | null>(null);
  const [autoLoading, setAutoLoading] = useState(false);
  const autoStartedRef = useRef(false);

  useEffect(() => {
    const parsed = parseDemoLink(searchParams);
    if (!parsed) return;

    if (parsed.source.type === "run") {
      router.replace(buildRunPath(parsed.source.runId, parsed.playerId));
      return;
    }
    if (parsed.source.type === "example") {
      router.replace(buildExamplePath(parsed.playerId));
    }
  }, [router, searchParams]);

  useEffect(() => {
    if (analysis || autoStartedRef.current) return;
    const parsed = parseDemoLink(searchParams);
    if (parsed?.source.type !== "code") return;

    autoStartedRef.current = true;
    setAutoLoading(true);
    setAutoError(null);

    void (async () => {
      try {
        if (parsed.source.type !== "code") return;
        const data = await fetchShareCodeDemo(parsed.source.shareCode);
        const saved = await persistDemoRun(data, parsed.source);
        router.replace(buildRunPath(saved.runId, parsed.playerId));
      } catch (err) {
        setAutoError(
          err instanceof Error ? err.message : "Failed to analyze share code.",
        );
        autoStartedRef.current = false;
      } finally {
        setAutoLoading(false);
      }
    })();
  }, [analysis, router, searchParams]);

  const onAnalyzed = useCallback(
    async (data: unknown, source: DemoLinkSource) => {
      if (!isDemoAnalysis(data)) return;
      const normalized = normalizeAnalysis(data);

      if (source.type === "example") {
        setAnalysis(normalized);
        return;
      }

      try {
        const saved = await persistDemoRun(normalized, source);
        router.push(buildRunPath(saved.runId));
      } catch (err) {
        setAutoError(
          err instanceof Error ? err.message : "Failed to save rundown.",
        );
        setAnalysis(normalized);
      }
    },
    [router],
  );

  const onImported = useCallback(
    (_data: unknown, _source: DemoLinkSource, importedRunId: string) => {
      router.push(buildRunPath(importedRunId));
    },
    [router],
  );

  const onReset = useCallback(() => {
    setAnalysis(null);
    setAutoError(null);
    autoStartedRef.current = false;
    router.replace("/demo");
  }, [router]);

  return (
    <>
      <SiteHeader />
      <main className="relative mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:py-14">
        <p className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-[0.28em] text-[var(--amber)]">
          Demo lab
        </p>
        <h1 className="mt-3 max-w-2xl font-[family-name:var(--font-display)] text-3xl font-bold leading-tight tracking-tight text-[var(--foreground)] sm:text-5xl">
          Analyze a CS2 match
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--muted)] sm:text-base">
          Paste a Valve match sharing code to start a new review. Shared game
          links use{" "}
          <span className="font-[family-name:var(--font-code)] text-[var(--foreground)]">
            /demo/r/…
          </span>
          .
        </p>

        <div className="mt-8">
          {analysis ? (
            <DemoResults
              analysis={analysis}
              linkSource={{ type: "example" }}
              initialFocusId="all"
              onReset={onReset}
            />
          ) : (
            <div className="space-y-4">
              {autoLoading ? (
                <p className="border border-[var(--border)] bg-[var(--surface)] px-4 py-4 text-sm text-[var(--muted)]">
                  Analyzing match from share code…
                </p>
              ) : null}
              {autoError ? (
                <p className="text-sm text-[var(--danger)]" role="alert">
                  {autoError}
                </p>
              ) : null}
              <DemoShareCodeForm
                onAnalyzed={(data, source) => void onAnalyzed(data, source)}
                disabled={autoLoading}
              />
              <div className="border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
                <p className="font-[family-name:var(--font-display)] text-xs font-semibold uppercase tracking-[0.18em] text-[var(--amber)]">
                  Example demo
                </p>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Browse a pre-analyzed pro match rundown without running the
                  analyzer.
                </p>
                <Link
                  href="/demo/example"
                  className="mt-4 inline-block border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition-colors hover:border-[var(--amber)]/60"
                >
                  Open example rundown
                </Link>
              </div>
              <DemoImportForm
                onImported={onImported}
                disabled={autoLoading}
              />
            </div>
          )}
        </div>
      </main>
    </>
  );
}

export default function DemoPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 text-sm text-[var(--muted)]">
          Loading demo lab…
        </main>
      }
    >
      <DemoLabContent />
    </Suspense>
  );
}
