"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DemoResults } from "@/components/DemoResults";
import { SiteHeader } from "@/components/SiteHeader";
import {
  buildExamplePath,
  buildRunPath,
  type DemoLinkSource,
} from "@/lib/demo/demoLink";
import type { DemoAnalysis } from "@/lib/demo";
import { fetchDemoRun, fetchExampleDemo } from "@/app/demo/demoShared";

type ViewerProps = {
  mode: "run" | "example";
  runId?: string;
};

function DemoViewerContent({ mode, runId }: ViewerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [analysis, setAnalysis] = useState<DemoAnalysis | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [focusPlayerId, setFocusPlayerId] = useState<string | null>(
    () => searchParams.get("player")?.trim() || null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const startedRef = useRef(false);

  const linkSource: DemoLinkSource | null =
    mode === "run" && runId
      ? { type: "run", runId }
      : mode === "example"
        ? { type: "example" }
        : null;

  const syncPlayerUrl = useCallback(
    (playerId: string | null) => {
      const path =
        mode === "run" && runId
          ? buildRunPath(runId, playerId)
          : buildExamplePath(playerId);
      router.replace(path, { scroll: false });
    },
    [mode, runId, router],
  );

  useEffect(() => {
    if (analysis || startedRef.current) return;
    startedRef.current = true;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        if (mode === "run" && runId) {
          const loaded = await fetchDemoRun(runId);
          setAnalysis(loaded.result);
          setExpiresAt(loaded.expiresAt);
          return;
        }
        if (mode === "example") {
          setAnalysis(await fetchExampleDemo());
          return;
        }
        throw new Error("Missing rundown id.");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load rundown.",
        );
        startedRef.current = false;
      } finally {
        setLoading(false);
      }
    })();
  }, [analysis, mode, runId]);

  const onFocusChange = useCallback(
    (playerId: string) => {
      const next = playerId === "all" ? null : playerId;
      setFocusPlayerId(next);
      syncPlayerUrl(next);
    },
    [syncPlayerUrl],
  );

  const onReset = useCallback(() => {
    router.push("/demo");
  }, [router]);

  return (
    <>
      <SiteHeader />
      <main className="relative mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:py-14">
        {loading ? (
          <p className="text-sm text-[var(--muted)]">Loading rundown…</p>
        ) : null}
        {error ? (
          <p className="text-sm text-[var(--danger)]" role="alert">
            {error}
          </p>
        ) : null}
        {analysis && linkSource ? (
          <DemoResults
            analysis={analysis}
            linkSource={linkSource}
            runId={mode === "run" ? runId : null}
            expiresAt={expiresAt}
            initialFocusId={focusPlayerId ?? "all"}
            onFocusChange={onFocusChange}
            onReset={onReset}
            onAnalysisUpdate={setAnalysis}
          />
        ) : null}
      </main>
    </>
  );
}

export function DemoViewer(props: ViewerProps) {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 text-sm text-[var(--muted)]">
          Loading rundown…
        </main>
      }
    >
      <DemoViewerContent {...props} />
    </Suspense>
  );
}
