"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CheatCategory,
  CoachingHighlight,
  DemoAnalysis,
  Mistake,
  MistakeType,
  PlayerCheatScore,
  PlayerStats,
} from "@/lib/demo";
import { DemoRadarScene } from "@/components/DemoRadarScene";
import {
  DemoReplayPlayer,
  type DemoReplayHandle,
} from "@/components/DemoReplayPlayer";
import { DemoHighlightsPanel } from "@/components/DemoHighlightsPanel";
import { DemoReviewGuide } from "@/components/DemoReviewGuide";
import { buildPlayerCoachingTips } from "@/lib/demo/coaching";
import { buildCoachingHighlights } from "@/lib/demo/highlights";
import { buildDemoWatchCommand } from "@/lib/demo/watchCommand";
import { buildDemoUrl } from "@/lib/demo/demoLink";
import type { DemoLinkSource } from "@/lib/demo/demoLink";
import { PlayerCoachingPanel } from "@/components/PlayerCoachingPanel";
import { StatsGrid } from "@/components/StatsGrid";

type Props = {
  analysis: DemoAnalysis;
  linkSource?: DemoLinkSource | null;
  runId?: string | null;
  expiresAt?: number | null;
  initialFocusId?: string;
  onFocusChange?: (playerId: string) => void;
  onReset: () => void;
  onAnalysisUpdate?: (analysis: DemoAnalysis) => void;
};

type PlayerContext = {
  steamId: string;
  steam: {
    personaName: string | null;
    profileUrl: string | null;
    accountAgeDays: number | null;
    profilePrivate: boolean | null;
    cs2PlaytimeHours: number | null;
    kd: number | null;
    hsPercent: number | null;
    winRate: number | null;
  };
  leetify: {
    profileUrl: string | null;
    premier: number | null;
    aim: number | null;
    preaim: number | null;
    timeToDamageMs: number | null;
    winrate: number | null;
  };
};

const TYPE_LABEL: Record<MistakeType, string> = {
  cheat: "Cheat signals",
  economy: "Economy",
  opening: "Opening",
  trade: "Trade",
  utility: "Utility",
};

function severityClass(severity: Mistake["severity"]): string {
  if (severity === "danger") return "text-[var(--danger)]";
  if (severity === "warn") return "text-[var(--warn)]";
  return "text-[var(--muted)]";
}

function teamLabel(team: number): string {
  if (team === 3) return "CT";
  if (team === 2) return "T";
  return "—";
}

function mistakeMatchesPlayer(m: Mistake, playerId: string): boolean {
  return m.steamId === playerId;
}

function cheatCategoryOf(m: Mistake): CheatCategory | "all" {
  if (m.cheatCategory) return m.cheatCategory;
  if (m.message.startsWith("[Wall]")) return "wall";
  if (m.message.startsWith("[Aim]")) return "aim";
  if (m.message.startsWith("[Context]")) return "context";
  return "wall";
}

export function DemoResults({
  analysis,
  linkSource,
  runId,
  expiresAt,
  initialFocusId = "all",
  onFocusChange,
  onReset,
  onAnalysisUpdate,
}: Props) {
  const [focusId, setFocusId] = useState<string>(initialFocusId);
  const [susCategory, setSusCategory] = useState<"all" | CheatCategory>("all");
  const [copiedMoments, setCopiedMoments] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [refreshingCoaching, setRefreshingCoaching] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const replayRef = useRef<DemoReplayHandle>(null);
  const [playerContext, setPlayerContext] = useState<Map<string, PlayerContext>>(
    () => new Map(),
  );

  useEffect(() => {
    setFocusId(initialFocusId);
  }, [initialFocusId]);

  const setPlayerFocus = (playerId: string) => {
    setFocusId(playerId);
    onFocusChange?.(playerId);
  };

  const shareUrl =
    linkSource != null
      ? buildDemoUrl(linkSource, focusId === "all" ? null : focusId)
      : null;

  const copyShareLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1600);
    } catch {
      // ignore clipboard failures
    }
  };

  const downloadJson = () => {
    if (runId) {
      window.location.href = `/api/demo/run/${encodeURIComponent(runId)}/export`;
      return;
    }
    const safeMap = analysis.match.mapName.replace(/[^a-zA-Z0-9_-]+/g, "-");
    const filename = `cscanner-${safeMap || "demo"}.json`;
    const body = JSON.stringify({ analysis }, null, 2);
    const blob = new Blob([body], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const refreshCoaching = async () => {
    if (!runId) return;
    setRefreshingCoaching(true);
    setRefreshError(null);
    try {
      const res = await fetch(
        `/api/demo/run/${encodeURIComponent(runId)}/reanalyze`,
        { method: "POST" },
      );
      const data = (await res.json().catch(() => ({}))) as {
        result?: DemoAnalysis;
        error?: string;
      };
      if (!res.ok || !data.result) {
        throw new Error(data.error || `Refresh failed (${res.status})`);
      }
      onAnalysisUpdate?.(data.result);
    } catch (err) {
      setRefreshError(
        err instanceof Error ? err.message : "Failed to refresh coaching.",
      );
    } finally {
      setRefreshingCoaching(false);
    }
  };

  const expiryLabel = useMemo(() => {
    if (!expiresAt) return null;
    const remainingMs = expiresAt - Date.now();
    if (remainingMs <= 0) return "Link expired";
    const hours = Math.ceil(remainingMs / (60 * 60 * 1000));
    if (hours <= 1) return "Link expires in less than 1 hour";
    return `Link expires in ~${hours} hours`;
  }, [expiresAt]);

  const focusedPlayer = useMemo(
    () =>
      focusId === "all"
        ? null
        : (analysis.players.find((p) => p.steamId === focusId) ?? null),
    [analysis.players, focusId],
  );

  const highlights = useMemo(() => {
    if (analysis.highlights && analysis.highlights.length > 0) {
      return analysis.highlights;
    }
    if (analysis.replay) {
      return buildCoachingHighlights(analysis.replay, analysis.players);
    }
    return [];
  }, [analysis.highlights, analysis.replay, analysis.players]);

  const watchHighlight = (h: CoachingHighlight) => {
    replayRef.current?.jumpTo({
      tick: h.tick,
      focusSteamId: h.focusSteamId ?? h.actorSteamIds[0],
      zoom: true,
      followAction: true,
      x: h.x,
      y: h.y,
    });
  };

  const watchScene = (
    tick: number | undefined,
    steamId: string,
    scene?: Mistake["scene"],
  ) => {
    if (tick == null) return;
    const marker = scene?.markers.find((m) => m.steamId === steamId);
    replayRef.current?.jumpTo({
      tick,
      focusSteamId: steamId,
      zoom: true,
      x: marker?.x,
      y: marker?.y,
    });
  };

  const filteredMistakes = useMemo(() => {
    if (focusId === "all") return analysis.mistakes;
    return analysis.mistakes.filter((m) => mistakeMatchesPlayer(m, focusId));
  }, [analysis.mistakes, focusId]);

  const displayPlayers = useMemo(() => {
    if (focusId === "all") return analysis.players;
    return analysis.players.filter((p) => p.steamId === focusId);
  }, [analysis.players, focusId]);

  const displayCheatScores = useMemo(() => {
    const scores = analysis.cheatScores ?? [];
    if (focusId === "all") return scores;
    return scores.filter((c) => c.steamId === focusId);
  }, [analysis.cheatScores, focusId]);

  const grouped = useMemo(() => {
    const order: MistakeType[] = [
      "cheat",
      "economy",
      "trade",
      "utility",
      "opening",
    ];
    const map = new Map<MistakeType, Mistake[]>();
    for (const t of order) map.set(t, []);
    for (const m of filteredMistakes) {
      const list = map.get(m.type) ?? [];
      list.push(m);
      map.set(m.type, list);
    }
    return order
      .map((type) => ({ type, items: map.get(type) ?? [] }))
      .filter((g) => g.items.length > 0);
  }, [filteredMistakes]);

  const cheatMistakeCount = useMemo(
    () => filteredMistakes.filter((m) => m.type === "cheat").length,
    [filteredMistakes],
  );

  const susMoments = useMemo(() => {
    return filteredMistakes
      .filter((m) => m.type === "cheat")
      .filter((m) => susCategory === "all" || cheatCategoryOf(m) === susCategory)
      .map((m) => ({
        round: m.round,
        tick: m.scene?.tick ?? null,
        steamId: m.steamId,
        player: m.playerName,
        severity: m.severity,
        category: cheatCategoryOf(m),
        message: m.message,
      }))
      .slice(0, 40);
  }, [filteredMistakes, susCategory]);

  const cheatById = useMemo(() => {
    const map = new Map<string, PlayerCheatScore>();
    for (const c of analysis.cheatScores ?? []) {
      map.set(c.steamId, c);
    }
    return map;
  }, [analysis.cheatScores]);

  const { match, players, summary } = analysis;
  const mapName = match.mapName;

  const coachingTips = useMemo(() => {
    if (!focusedPlayer) return [];
    const ctx = playerContext.get(focusId);
    return buildPlayerCoachingTips({
      player: focusedPlayer,
      mistakes: analysis.mistakes,
      rounds: match.rounds,
      leetify: ctx?.leetify ?? null,
      steam: ctx?.steam ?? null,
    });
  }, [
    analysis.mistakes,
    focusId,
    focusedPlayer,
    match.rounds,
    playerContext,
  ]);

  const findingsItems = useMemo(() => {
    if (focusId === "all") {
      return [
        { label: "Total issues", value: String(summary.totalMistakes) },
        {
          label: "Cheat signals",
          value: String(summary.cheatSignals ?? 0),
        },
        { label: "Economy", value: String(summary.economyMistakes) },
        { label: "Trades", value: String(summary.tradeMistakes) },
      ];
    }

    const cheat = cheatById.get(focusId);
    const cheatCount = filteredMistakes.filter((m) => m.type === "cheat").length;
    const economyCount = filteredMistakes.filter(
      (m) => m.type === "economy",
    ).length;
    const tradeCount = filteredMistakes.filter((m) => m.type === "trade").length;

    return [
      { label: "Issues", value: String(filteredMistakes.length) },
      { label: "Cheat signals", value: String(cheatCount) },
      { label: "Cheat risk", value: String(cheat?.cheatRisk ?? 0) },
      { label: "ADR", value: String(focusedPlayer?.adr ?? "—") },
      { label: "Economy", value: String(economyCount) },
      { label: "Trades", value: String(tradeCount) },
    ];
  }, [
    cheatById,
    filteredMistakes,
    focusId,
    focusedPlayer?.adr,
    summary.cheatSignals,
    summary.economyMistakes,
    summary.totalMistakes,
    summary.tradeMistakes,
  ]);

  const findingsFooter = useMemo(() => {
    if (focusId === "all") {
      return (
        <div className="space-y-1 text-xs text-[var(--muted)]">
          {summary.highestCheatRiskPlayer ? (
            <p>
              Highest demo cheat risk:{" "}
              <span className="text-[var(--danger)]">
                {summary.highestCheatRiskPlayer}
              </span>
            </p>
          ) : null}
          {summary.topMistakePlayer ? (
            <p>
              Most flags:{" "}
              <span className="text-[var(--foreground)]">
                {summary.topMistakePlayer}
              </span>
            </p>
          ) : null}
          <p>
            Cheat signals are heuristics from aim/angles — not VAC or proof.
            Trade/cheat items with radar show positions at that moment.
          </p>
        </div>
      );
    }

    const ctx = playerContext.get(focusId);
    return (
      <div className="space-y-1 text-xs text-[var(--muted)]">
        <p>
          Showing only{" "}
          <span className="text-[var(--foreground)]">
            {focusedPlayer?.name ?? "this player"}
          </span>
          . Replay above still shows the full match.
        </p>
        {ctx ? (
          <p>
            Steam:{" "}
            {ctx.steam.cs2PlaytimeHours != null
              ? `${ctx.steam.cs2PlaytimeHours}h`
              : "—"}
            {" · "}KD {ctx.steam.kd != null ? ctx.steam.kd.toFixed(2) : "—"}
            {" · "}HS{" "}
            {ctx.steam.hsPercent != null ? `${ctx.steam.hsPercent}%` : "—"}
            {ctx.leetify.premier != null ? ` · Premier ${ctx.leetify.premier}` : ""}
          </p>
        ) : null}
        <p>
          Cheat signals are heuristics from aim/angles — not VAC or proof.
        </p>
      </div>
    );
  }, [
    focusId,
    focusedPlayer?.name,
    playerContext,
    summary.highestCheatRiskPlayer,
    summary.topMistakePlayer,
  ]);

  const copySusMoments = async () => {
    if (susMoments.length === 0) return;
    const lines = [
      `Map: ${match.mapName}`,
      `Tickrate: ${match.tickRate ?? "unknown"}`,
      "",
      ...susMoments.map((s) => {
        const tickText = s.tick != null ? `tick ${s.tick}` : "tick ?";
        const watchCmd =
          s.tick != null
            ? buildDemoWatchCommand(
                s.tick,
                s.steamId,
                s.player,
                match.tickRate,
              )
            : null;
        const cmdText = watchCmd ? ` | ${watchCmd}` : "";
        return `R${s.round} | ${tickText} | ${s.category.toUpperCase()} | ${s.player} | ${s.severity.toUpperCase()} | ${s.message}${cmdText}`;
      }),
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopiedMoments(true);
      setTimeout(() => setCopiedMoments(false), 1600);
    } catch {
      // ignore clipboard failures
    }
  };

  const copyWatchCommand = async (
    tick: number | null,
    steamId: string,
    playerName: string,
  ) => {
    if (tick == null || tick <= 0) return;
    try {
      await navigator.clipboard.writeText(
        buildDemoWatchCommand(tick, steamId, playerName, match.tickRate),
      );
      setCopiedMoments(true);
      setTimeout(() => setCopiedMoments(false), 1200);
    } catch {
      // ignore clipboard failures
    }
  };

  useEffect(() => {
    const steamIds = players
      .map((p) => p.steamId)
      .filter((id) => /^7656119\d{10}$/.test(id));
    if (steamIds.length === 0) {
      setPlayerContext(new Map());
      return;
    }

    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetch("/api/upload-demo/player-context", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ steamIds }),
          signal: controller.signal,
        });
        const data = (await res.json().catch(() => ({}))) as {
          contexts?: PlayerContext[];
        };
        if (!res.ok || !Array.isArray(data.contexts)) return;
        const map = new Map<string, PlayerContext>();
        for (const item of data.contexts) {
          map.set(item.steamId, item);
        }
        setPlayerContext(map);
      } catch {
        // optional enrichment only
      }
    })();

    return () => controller.abort();
  }, [players]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-[0.18em] text-[var(--amber)]">
            Match overview
          </p>
          <h2 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            {match.mapName}
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {match.rounds} rounds
            {match.tickRate ? ` · ${match.tickRate} tick` : ""}
            {expiryLabel ? ` · ${expiryLabel}` : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {runId ? (
            <button
              type="button"
              onClick={() => void refreshCoaching()}
              disabled={refreshingCoaching}
              className="border border-[var(--amber)]/40 bg-[var(--amber)]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--amber-bright)] hover:bg-[var(--amber)]/20 disabled:opacity-50"
            >
              {refreshingCoaching ? "Refreshing…" : "Refresh coaching"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={downloadJson}
            className="border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--foreground)] hover:border-[var(--amber)]/60"
          >
            Download JSON
          </button>
          {shareUrl ? (
            <button
              type="button"
              onClick={() => void copyShareLink()}
              className="border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--foreground)] hover:border-[var(--amber)]/60"
            >
              {copiedLink ? "Link copied" : "Copy link"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onReset}
            className="border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--foreground)] hover:border-[var(--amber)]/60"
          >
            Analyze another
          </button>
        </div>
      </div>
      {refreshError ? (
        <p className="text-xs text-[var(--danger)]" role="alert">
          {refreshError}
        </p>
      ) : null}
      {runId ? (
        <p className="text-xs text-[var(--muted)]">
          Refresh coaching updates highlights and utility flags from stored replay
          data. Economy and cheat signals are unchanged.
        </p>
      ) : null}

      {analysis.replay && analysis.replay.frames.length > 1 ? (
        <DemoReplayPlayer
          ref={replayRef}
          replay={analysis.replay}
          mapName={analysis.match.mapName}
        />
      ) : null}

      {highlights.length > 0 ? (
        <DemoHighlightsPanel
          highlights={highlights}
          focusPlayerId={focusId === "all" ? null : focusId}
          onWatch={watchHighlight}
        />
      ) : null}

      <div className="flex flex-col gap-2 border border-[var(--border)] bg-[var(--surface)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            Results view
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Filter everything below to one player. Match replay stays full.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
          Player
          <select
            value={focusId}
            onChange={(e) => setPlayerFocus(e.target.value)}
            className="min-w-[10rem] border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1.5 text-sm text-[var(--foreground)]"
          >
            <option value="all">All players</option>
            {players.map((p) => (
              <option key={p.steamId} value={p.steamId}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <StatsGrid
        title={focusedPlayer ? `${focusedPlayer.name} — findings` : "Findings"}
        items={findingsItems}
        footer={findingsFooter}
      />

      <PlayerTable
        players={displayPlayers}
        focusId={focusId}
        cheatById={cheatById}
        contextById={playerContext}
        onViewPlayer={setPlayerFocus}
      />

      {focusedPlayer ? (
        <PlayerCoachingPanel
          playerName={focusedPlayer.name}
          tips={coachingTips}
        />
      ) : null}

      {displayCheatScores.length > 0 ? (
        <CheatScoreTable
          scores={displayCheatScores}
          singlePlayer={focusId !== "all"}
        />
      ) : null}

      <DemoReviewGuide />

      {cheatMistakeCount > 0 ? (
        <section className="space-y-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              {focusedPlayer ? `${focusedPlayer.name} — sus moments` : "Sus moments"}
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              {(["all", "wall", "aim", "context"] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSusCategory(cat)}
                  className={[
                    "border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em]",
                    susCategory === cat
                      ? "border-[var(--amber)] bg-[var(--amber)]/15 text-[var(--foreground)]"
                      : "border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--muted)]",
                  ].join(" ")}
                >
                  {cat}
                </button>
              ))}
              <button
                type="button"
                onClick={() => void copySusMoments()}
                className="border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--foreground)] hover:border-[var(--amber)]/60"
              >
                {copiedMoments ? "Copied" : "Copy moments"}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto border border-[var(--border)]">
            {susMoments.length === 0 ? (
              <p className="px-4 py-5 text-sm text-[var(--muted)]">
                No sus moments for this category filter.
              </p>
            ) : (
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead className="bg-[var(--bg-elevated)] text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
                <tr>
                  <th className="px-3 py-2 font-medium">Round</th>
                  <th className="px-3 py-2 font-medium">Tick</th>
                  {focusId === "all" ? (
                    <th className="px-3 py-2 font-medium">Player</th>
                  ) : null}
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Severity</th>
                  <th className="px-3 py-2 font-medium">Signal</th>
                  <th className="px-3 py-2 font-medium">Watch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] bg-[var(--surface)]">
                {susMoments.map((s, i) => (
                  <tr key={`${s.player}-${s.round}-${s.tick ?? "na"}-${i}`}>
                    <td className="px-3 py-2 font-[family-name:var(--font-code)]">
                      {s.round > 0 ? `R${s.round}` : "—"}
                    </td>
                    <td className="px-3 py-2 font-[family-name:var(--font-code)]">
                      {s.tick ?? "—"}
                    </td>
                    {focusId === "all" ? (
                      <td className="px-3 py-2 font-medium text-[var(--foreground)]">
                        {s.player}
                      </td>
                    ) : null}
                    <td className="px-3 py-2 font-[family-name:var(--font-code)] uppercase text-[var(--muted)]">
                      {s.category}
                    </td>
                    <td
                      className={`px-3 py-2 font-[family-name:var(--font-code)] ${
                        s.severity === "danger"
                          ? "text-[var(--danger)]"
                          : s.severity === "warn"
                            ? "text-[var(--warn)]"
                            : "text-[var(--muted)]"
                      }`}
                    >
                      {s.severity}
                    </td>
                    <td className="px-3 py-2 text-[var(--muted)]">{s.message}</td>
                    <td className="px-3 py-2">
                      {s.tick != null ? (
                        <div className="flex flex-wrap gap-1">
                          {analysis.replay ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (s.tick == null) return;
                                watchScene(s.tick, s.steamId, undefined);
                              }}
                              className="border border-[var(--amber)]/40 bg-[var(--amber)]/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--amber-bright)] hover:bg-[var(--amber)]/20"
                            >
                              Watch
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() =>
                              void copyWatchCommand(s.tick, s.steamId, s.player)
                            }
                            className="border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--foreground)] hover:border-[var(--amber)]/60"
                            title={buildDemoWatchCommand(
                              s.tick,
                              s.steamId,
                              s.player,
                              match.tickRate,
                            )}
                          >
                            Copy cmd
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-[var(--muted)]">No tick</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </div>
          <p className="text-xs text-[var(--muted)]">
            In CS2: open the demo, close the demo UI (Shift+F2), then paste the
            copied command in console. It jumps 15s before the flagged moment
            and locks onto that player.
          </p>
        </section>
      ) : null}

      <section className="space-y-4">
        <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
          {focusedPlayer
            ? `${focusedPlayer.name} — mistakes & improvements`
            : "Mistakes & improvements"}
        </h3>
        {grouped.length === 0 ? (
          <p className="border border-[var(--border)] bg-[var(--surface)] px-5 py-6 text-sm text-[var(--muted)]">
            {focusedPlayer
              ? `No issues flagged for ${focusedPlayer.name}.`
              : "No issues flagged for this filter. Heuristics are v1 signals — not every play is covered."}
          </p>
        ) : (
          grouped.map(({ type, items }) => (
            <div
              key={type}
              className="border border-[var(--border)] bg-[var(--surface)]"
            >
              <div className="border-b border-[var(--border)] px-5 py-3">
                <h4 className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-[0.14em] text-[var(--foreground)]">
                  {TYPE_LABEL[type]}{" "}
                  <span className="text-[var(--muted)]">({items.length})</span>
                </h4>
              </div>
              <ul className="divide-y divide-[var(--border)]">
                {items.map((m, i) => (
                  <li
                    key={`${m.steamId}-${m.round}-${m.message}-${i}`}
                    className="px-5 py-3"
                  >
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-4">
                      <span className="shrink-0 font-[family-name:var(--font-code)] text-xs text-[var(--muted)]">
                        {m.round > 0 ? `R${m.round}` : "—"}
                      </span>
                      {focusId === "all" ? (
                        <span className="shrink-0 text-sm font-medium text-[var(--foreground)] sm:w-36">
                          {m.playerName}
                        </span>
                      ) : null}
                      <span
                        className={`text-sm ${severityClass(m.severity)}`}
                      >
                        {m.message}
                      </span>
                      {m.scene?.tick != null && analysis.replay ? (
                        <button
                          type="button"
                          onClick={() =>
                            watchScene(m.scene?.tick, m.steamId, m.scene)
                          }
                          className="shrink-0 border border-[var(--amber)]/40 bg-[var(--amber)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--amber-bright)]"
                        >
                          Watch
                        </button>
                      ) : null}
                    </div>
                    {m.scene && m.scene.markers.length > 0 ? (
                      <DemoRadarScene
                        mapName={mapName}
                        scene={m.scene}
                        caption={
                          m.type === "cheat" && m.message.includes("Pre-aim")
                            ? m.message
                            : m.type === "trade"
                              ? m.message
                              : undefined
                        }
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

function CheatScoreTable({
  scores,
  singlePlayer,
}: {
  scores: PlayerCheatScore[];
  singlePlayer: boolean;
}) {
  const rows = singlePlayer
    ? scores
    : scores.filter((s) => s.cheatRisk > 0 || s.wallLookSamples > 0);
  if (rows.length === 0) return null;

  return (
    <section>
      <h3 className="mb-2 font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
        Demo cheat heuristics
      </h3>
      <div className="overflow-x-auto border border-[var(--border)]">
        <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
          <thead className="bg-[var(--bg-elevated)] text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2 font-medium">Player</th>
              <th className="px-3 py-2 font-medium">Risk</th>
              <th className="px-3 py-2 font-medium">Wall%</th>
              <th className="px-3 py-2 font-medium">Pre</th>
              <th className="px-3 py-2 font-medium">Swaps</th>
              <th className="px-3 py-2 font-medium">Sel</th>
              <th className="px-3 py-2 font-medium">Info</th>
              <th className="px-3 py-2 font-medium">Smoke</th>
              <th className="px-3 py-2 font-medium">Lurk</th>
              <th className="px-3 py-2 font-medium">Trig</th>
              <th className="px-3 py-2 font-medium">Xfer</th>
              <th className="px-3 py-2 font-medium">RCS</th>
              <th className="px-3 py-2 font-medium">Snap</th>
              <th className="px-3 py-2 font-medium">Spin</th>
              <th className="px-3 py-2 font-medium">Mom</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)] bg-[var(--surface)]">
            {rows.map((s) => (
              <tr key={s.steamId}>
                <td className="px-3 py-2 font-medium text-[var(--foreground)]">
                  {s.name}
                </td>
                <td
                  className={`px-3 py-2 font-[family-name:var(--font-code)] ${
                    s.cheatRisk >= 40
                      ? "text-[var(--danger)]"
                      : s.cheatRisk >= 20
                        ? "text-[var(--warn)]"
                        : ""
                  }`}
                >
                  {s.cheatRisk}
                </td>
                <td className="px-3 py-2 font-[family-name:var(--font-code)]">
                  {s.wallLookScore}
                </td>
                <td className="px-3 py-2 font-[family-name:var(--font-code)]">
                  {s.preAimFlags}
                </td>
                <td className="px-3 py-2 font-[family-name:var(--font-code)]">
                  {s.wallTrackRotations}
                </td>
                <td className="px-3 py-2 font-[family-name:var(--font-code)]">
                  {s.selectiveClearFlags}
                </td>
                <td className="px-3 py-2 font-[family-name:var(--font-code)]">
                  {s.infoRotateFlags}
                </td>
                <td className="px-3 py-2 font-[family-name:var(--font-code)]">
                  {s.smokeSpamFlags}
                </td>
                <td className="px-3 py-2 font-[family-name:var(--font-code)]">
                  {s.lurkerCheckFlags}
                </td>
                <td className="px-3 py-2 font-[family-name:var(--font-code)]">
                  {s.triggerFlags}
                </td>
                <td className="px-3 py-2 font-[family-name:var(--font-code)]">
                  {s.transferFlags}
                </td>
                <td className="px-3 py-2 font-[family-name:var(--font-code)]">
                  {s.rcsFlags}
                </td>
                <td className="px-3 py-2 font-[family-name:var(--font-code)]">
                  {s.rageSnaps}
                </td>
                <td className="px-3 py-2 font-[family-name:var(--font-code)]">
                  {s.spinbotFlags}
                </td>
                <td className="px-3 py-2 font-[family-name:var(--font-code)]">
                  {s.momentumFlags}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PlayerTable({
  players,
  focusId,
  cheatById,
  contextById,
  onViewPlayer,
}: {
  players: PlayerStats[];
  focusId: string;
  cheatById: Map<string, PlayerCheatScore>;
  contextById: Map<string, PlayerContext>;
  onViewPlayer: (steamId: string) => void;
}) {
  return (
    <section className="space-y-2">
      <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
        {focusId === "all" ? "Players" : "Player stats"}
      </h3>
      <div className="overflow-x-auto border border-[var(--border)]">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead className="bg-[var(--bg-elevated)] text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
          <tr>
            <th className="px-3 py-2 font-medium">Player</th>
            <th className="px-3 py-2 font-medium">Team</th>
            <th className="px-3 py-2 font-medium">K</th>
            <th className="px-3 py-2 font-medium">D</th>
            <th className="px-3 py-2 font-medium">A</th>
            <th className="px-3 py-2 font-medium">ADR</th>
            <th className="px-3 py-2 font-medium">HS%</th>
            <th className="px-3 py-2 font-medium">Entries</th>
            <th className="px-3 py-2 font-medium">Cheat</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)] bg-[var(--surface)]">
          {players.map((p) => {
            const risk = cheatById.get(p.steamId)?.cheatRisk ?? 0;
            const ctx = contextById.get(p.steamId);
            return (
              <tr key={p.steamId}>
                <td className="px-3 py-2 font-medium text-[var(--foreground)]">
                  {p.name}
                  {focusId === "all" ? (
                    <button
                      type="button"
                      onClick={() => onViewPlayer(p.steamId)}
                      className="ml-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--amber)] hover:underline"
                    >
                      View only
                    </button>
                  ) : null}
                  {ctx?.steam?.profileUrl ? (
                    <a
                      href={ctx.steam.profileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-2 text-xs text-[var(--muted)] underline decoration-dotted"
                    >
                      Steam
                    </a>
                  ) : null}
                  {ctx?.leetify?.profileUrl ? (
                    <a
                      href={ctx.leetify.profileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-2 text-xs text-[var(--muted)] underline decoration-dotted"
                    >
                      Leetify
                    </a>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-[var(--muted)]">
                  {teamLabel(p.team)}
                </td>
                <td className="px-3 py-2 font-[family-name:var(--font-code)]">
                  {p.kills}
                </td>
                <td className="px-3 py-2 font-[family-name:var(--font-code)]">
                  {p.deaths}
                </td>
                <td className="px-3 py-2 font-[family-name:var(--font-code)]">
                  {p.assists}
                </td>
                <td className="px-3 py-2 font-[family-name:var(--font-code)]">
                  {p.adr}
                </td>
                <td className="px-3 py-2 font-[family-name:var(--font-code)]">
                  {p.hsPercent}
                </td>
                <td className="px-3 py-2 font-[family-name:var(--font-code)]">
                  {p.entries}
                </td>
                <td
                  className={`px-3 py-2 font-[family-name:var(--font-code)] ${
                    risk >= 40
                      ? "text-[var(--danger)]"
                      : risk >= 20
                        ? "text-[var(--warn)]"
                        : "text-[var(--muted)]"
                  }`}
                >
                  {risk}
                  {ctx ? (
                    <div className="mt-1 text-[10px] leading-tight text-[var(--muted)]">
                      {ctx.steam.cs2PlaytimeHours != null
                        ? `${ctx.steam.cs2PlaytimeHours}h`
                        : "—"}
                      {" · "}
                      KD{" "}
                      {ctx.steam.kd != null ? ctx.steam.kd.toFixed(2) : "—"}
                      {" · "}
                      HS{" "}
                      {ctx.steam.hsPercent != null
                        ? `${ctx.steam.hsPercent}%`
                        : "—"}
                      {ctx.leetify.premier != null
                        ? ` · P ${ctx.leetify.premier}`
                        : ""}
                    </div>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </section>
  );
}
