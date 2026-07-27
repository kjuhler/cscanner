"use client";

import { useState } from "react";
import { DemoResults } from "@/components/DemoResults";
import { DemoShareCodeForm } from "@/components/DemoShareCodeForm";
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

  const onAnalyzed = (data: unknown) => {
    if (isDemoAnalysis(data)) setAnalysis(normalizeAnalysis(data));
  };

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
          Paste a Valve match sharing code (plain <span className="text-[var(--foreground)]">CSGO-…</span> or full
          <span className="text-[var(--foreground)]"> steam://...</span> copy).
          We fetch the replay from Steam and run radar replay, economy/trade/utility
          review, and cheat-signal heuristics.
        </p>

        <div className="mt-8">
          {analysis ? (
            <DemoResults
              analysis={analysis}
              onReset={() => setAnalysis(null)}
            />
          ) : (
            <DemoShareCodeForm onAnalyzed={onAnalyzed} />
          )}
        </div>
      </main>
    </>
  );
}
