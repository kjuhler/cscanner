"use client";

import { useState } from "react";
import { DemoResults } from "@/components/DemoResults";
import { DemoUploadForm } from "@/components/DemoUploadForm";
import { SiteHeader } from "@/components/SiteHeader";
import type { DemoAnalysis } from "@/lib/demo";

function isDemoAnalysis(data: unknown): data is DemoAnalysis {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return (
    Array.isArray(d.players) &&
    Array.isArray(d.mistakes) &&
    typeof d.match === "object" &&
    d.match !== null &&
    typeof d.summary === "object" &&
    d.summary !== null
  );
}

function normalizeAnalysis(data: DemoAnalysis): DemoAnalysis {
  return {
    ...data,
    cheatScores: data.cheatScores ?? [],
    replay: data.replay ?? null,
    summary: {
      ...data.summary,
      cheatSignals: data.summary.cheatSignals ?? 0,
      highestCheatRiskPlayer: data.summary.highestCheatRiskPlayer ?? null,
    },
  };
}

export default function DemoPage() {
  const [analysis, setAnalysis] = useState<DemoAnalysis | null>(null);

  return (
    <>
      <SiteHeader />
      <main className="relative mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:py-14">
        <p className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-[0.28em] text-[var(--amber)]">
          Demo lab
        </p>
        <h1 className="mt-3 max-w-2xl font-[family-name:var(--font-display)] text-3xl font-bold leading-tight tracking-tight text-[var(--foreground)] sm:text-5xl">
          Upload a CS2 demo
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--muted)] sm:text-base">
          Parse a <span className="text-[var(--foreground)]">.dem</span> or{" "}
          <span className="text-[var(--foreground)]">.dem.bz2</span> file on
          the server — radar replay, economy/trade/utility review, and
          cheat-signal heuristics.
        </p>

        <div className="mt-8">
          {analysis ? (
            <DemoResults
              analysis={analysis}
              onReset={() => setAnalysis(null)}
            />
          ) : (
            <DemoUploadForm
              onAnalyzed={(data) => {
                if (isDemoAnalysis(data)) setAnalysis(normalizeAnalysis(data));
              }}
            />
          )}
        </div>
      </main>
    </>
  );
}
