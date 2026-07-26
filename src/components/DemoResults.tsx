"use client";

import { useMemo, useState } from "react";
import type {
  DemoAnalysis,
  Mistake,
  MistakeType,
  PlayerCheatScore,
  PlayerStats,
} from "@/lib/demo";
import { DemoRadarScene } from "@/components/DemoRadarScene";
import { DemoReplayPlayer } from "@/components/DemoReplayPlayer";
import { StatsGrid } from "@/components/StatsGrid";

type Props = {
  analysis: DemoAnalysis;
  onReset: () => void;
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

function mistakeMatchesFocus(m: Mistake, focusId: string): boolean {
  if (focusId === "all") return true;
  if (m.steamId === focusId) return true;
  return Boolean(m.relatedSteamIds?.includes(focusId));
}

export function DemoResults({ analysis, onReset }: Props) {
  const [focusId, setFocusId] = useState<string>("all");

  const filteredMistakes = useMemo(() => {
    return analysis.mistakes.filter((m) => mistakeMatchesFocus(m, focusId));
  }, [analysis.mistakes, focusId]);

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

  const cheatById = useMemo(() => {
    const map = new Map<string, PlayerCheatScore>();
    for (const c of analysis.cheatScores ?? []) {
      map.set(c.steamId, c);
    }
    return map;
  }, [analysis.cheatScores]);

  const { match, players, summary } = analysis;
  const mapName = match.mapName;

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
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--foreground)] hover:border-[var(--amber)]/60"
        >
          Analyze another
        </button>
      </div>

      {analysis.replay && analysis.replay.frames.length > 1 ? (
        <DemoReplayPlayer
          replay={analysis.replay}
          mapName={analysis.match.mapName}
        />      ) : null}

      <StatsGrid
        title="Findings"
        items={[
          { label: "Total issues", value: String(summary.totalMistakes) },
          {
            label: "Cheat signals",
            value: String(summary.cheatSignals ?? 0),
          },
          { label: "Economy", value: String(summary.economyMistakes) },
          { label: "Trades", value: String(summary.tradeMistakes) },
        ]}
        footer={
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
        }
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
          Players
        </h3>
        <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
          Focus
          <select
            value={focusId}
            onChange={(e) => setFocusId(e.target.value)}
            className="border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--foreground)]"
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

      <PlayerTable
        players={players}
        focusId={focusId}
        cheatById={cheatById}
      />

      {(analysis.cheatScores ?? []).some((c) => c.cheatRisk > 0) ? (
        <CheatScoreTable
          scores={analysis.cheatScores}
          focusId={focusId}
        />
      ) : null}

      <section className="space-y-4">
        <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
          Mistakes &amp; improvements
        </h3>
        {grouped.length === 0 ? (
          <p className="border border-[var(--border)] bg-[var(--surface)] px-5 py-6 text-sm text-[var(--muted)]">
            No issues flagged for this filter. Heuristics are v1 signals — not
            every play is covered.
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
                      <span className="shrink-0 text-sm font-medium text-[var(--foreground)] sm:w-36">
                        {m.playerName}
                      </span>
                      <span
                        className={`text-sm ${severityClass(m.severity)}`}
                      >
                        {m.message}
                      </span>
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
  focusId,
}: {
  scores: PlayerCheatScore[];
  focusId: string;
}) {
  const rows = scores.filter((s) => s.cheatRisk > 0 || s.wallLookSamples > 0);
  if (rows.length === 0) return null;

  return (
    <section>
      <h3 className="mb-2 font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
        Demo cheat heuristics
      </h3>
      <div className="overflow-x-auto border border-[var(--border)]">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead className="bg-[var(--bg-elevated)] text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2 font-medium">Player</th>
              <th className="px-3 py-2 font-medium">Risk</th>
              <th className="px-3 py-2 font-medium">Wall-look%</th>
              <th className="px-3 py-2 font-medium">Pre-aim</th>
              <th className="px-3 py-2 font-medium">Rage snaps</th>
              <th className="px-3 py-2 font-medium">Spin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)] bg-[var(--surface)]">
            {rows.map((s) => {
              const focused = focusId !== "all" && s.steamId === focusId;
              return (
                <tr
                  key={s.steamId}
                  className={
                    focused
                      ? "bg-[var(--amber)]/10"
                      : focusId !== "all"
                        ? "opacity-50"
                        : undefined
                  }
                >
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
                    {s.rageSnaps}
                  </td>
                  <td className="px-3 py-2 font-[family-name:var(--font-code)]">
                    {s.spinbotFlags}
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

function PlayerTable({
  players,
  focusId,
  cheatById,
}: {
  players: PlayerStats[];
  focusId: string;
  cheatById: Map<string, PlayerCheatScore>;
}) {
  return (
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
            const focused = focusId !== "all" && p.steamId === focusId;
            const risk = cheatById.get(p.steamId)?.cheatRisk ?? 0;
            return (
              <tr
                key={p.steamId}
                className={
                  focused
                    ? "bg-[var(--amber)]/10"
                    : focusId !== "all"
                      ? "opacity-50"
                      : undefined
                }
              >
                <td className="px-3 py-2 font-medium text-[var(--foreground)]">
                  {p.name}
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
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
