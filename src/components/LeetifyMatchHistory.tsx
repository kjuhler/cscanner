"use client";

import { Fragment, useCallback, useState } from "react";
import Link from "next/link";
import {
  formatDecimal,
  formatMatchDate,
  formatPercent,
} from "@/lib/format";
import { mapDisplayName } from "@/lib/maps";
import type {
  LeetifyMatchDetails,
  LeetifyMatchPlayer,
  LeetifyRecentMatch,
} from "@/lib/types";
import { MapIcon } from "@/components/MapIcon";
import { RankIcon } from "@/components/RankIcon";

type Props = {
  matches: LeetifyRecentMatch[];
  steamId: string;
};

function formatMs(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${Math.round(value)} ms`;
}

function Rating({ value }: { value: number | null }) {
  if (value == null) {
    return <span className="text-[var(--muted)]">—</span>;
  }
  const positive = value >= 0;
  return (
    <span className={positive ? "text-[var(--ok)]" : "text-[var(--danger)]"}>
      {positive ? "+" : ""}
      {formatDecimal(value)}
    </span>
  );
}

function MatchRank({ match }: { match: LeetifyRecentMatch }) {
  if (match.premierRating != null) {
    return (
      <RankIcon kind="premier" rating={match.premierRating} size="sm" />
    );
  }
  if (match.competitiveRank != null) {
    return (
      <RankIcon kind="competitive" rank={match.competitiveRank} size={56} />
    );
  }
  if (match.csgoRank != null) {
    return <RankIcon kind="competitive" rank={match.csgoRank} size={56} />;
  }
  return (
    <span
      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border)] text-xs text-[var(--muted)]"
      title="Rank unknown"
    >
      ?
    </span>
  );
}

function isMatchDetails(data: unknown): data is LeetifyMatchDetails {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return typeof d.id === "string" && Array.isArray(d.players);
}

function PlayerRow({
  player,
  highlight,
}: {
  player: LeetifyMatchPlayer;
  highlight: boolean;
}) {
  return (
    <tr
      className={
        highlight
          ? "bg-[var(--amber)]/10"
          : "hover:bg-[var(--bg-elevated)]/30"
      }
    >
      <td className="px-3 py-2">
        <Link
          href={`/profiles/${player.steamId}`}
          className={
            highlight
              ? "font-medium text-[var(--amber)] underline-offset-2 hover:underline"
              : "text-[var(--foreground)] underline-offset-2 hover:underline"
          }
          onClick={(e) => e.stopPropagation()}
        >
          {player.name}
        </Link>
      </td>
      <td className="px-3 py-2 font-mono tabular-nums">
        <Rating value={player.leetifyRating} />
      </td>
      <td className="px-3 py-2 font-mono tabular-nums text-[var(--foreground)]">
        {player.kills} / {player.deaths} / {player.assists}
      </td>
      <td className="px-3 py-2 font-mono tabular-nums text-[var(--foreground)]">
        {player.kd != null ? formatDecimal(player.kd) : "—"}
      </td>
      <td className="px-3 py-2 font-mono tabular-nums text-[var(--foreground)]">
        {player.adr != null ? formatDecimal(player.adr, 1) : "—"}
      </td>
      <td className="px-3 py-2 font-mono tabular-nums text-[var(--foreground)]">
        {formatPercent(player.hsPercent)}
      </td>
      <td className="px-3 py-2 font-mono tabular-nums text-[var(--muted)]">
        {formatMs(player.timeToDamageMs)}
      </td>
      <td className="px-3 py-2 font-mono tabular-nums text-[var(--muted)]">
        {player.preaim != null ? `${formatDecimal(player.preaim, 1)}°` : "—"}
      </td>
      <td className="px-3 py-2 font-mono tabular-nums text-[var(--muted)]">
        {player.mvps}
      </td>
    </tr>
  );
}

function TeamTable({
  label,
  players,
  steamId,
}: {
  label: string;
  players: LeetifyMatchPlayer[];
  steamId: string;
}) {
  if (players.length === 0) return null;
  return (
    <div>
      <p className="mb-1.5 font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
        {label}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-xs">
          <thead>
            <tr className="border-b border-[var(--border)] text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">
              <th className="px-3 py-1.5 font-semibold">Player</th>
              <th className="px-3 py-1.5 font-semibold">Rating</th>
              <th className="px-3 py-1.5 font-semibold">K / D / A</th>
              <th className="px-3 py-1.5 font-semibold">K/D</th>
              <th className="px-3 py-1.5 font-semibold">ADR</th>
              <th className="px-3 py-1.5 font-semibold">HS%</th>
              <th className="px-3 py-1.5 font-semibold">TTD</th>
              <th className="px-3 py-1.5 font-semibold">Preaim</th>
              <th className="px-3 py-1.5 font-semibold">MVP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {players.map((p) => (
              <PlayerRow
                key={p.steamId}
                player={p}
                highlight={p.steamId === steamId}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MatchDetailPanel({
  steamId,
  details,
  loading,
  error,
}: {
  steamId: string;
  details: LeetifyMatchDetails | null;
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return (
      <p className="px-5 py-4 text-xs text-[var(--muted)]">
        Loading lobby stats from Leetify…
      </p>
    );
  }
  if (error) {
    return (
      <p className="px-5 py-4 text-xs text-[var(--danger)]" role="alert">
        {error}
      </p>
    );
  }
  if (!details) return null;

  const teams = new Map<number, LeetifyMatchPlayer[]>();
  for (const p of details.players) {
    const list = teams.get(p.teamNumber) ?? [];
    list.push(p);
    teams.set(p.teamNumber, list);
  }
  const teamNumbers = [...teams.keys()].sort((a, b) => a - b);

  return (
    <div className="space-y-4 border-t border-[var(--border)] bg-[var(--bg)]/40 px-5 py-4">
      <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
        {details.score ? (
          <span className="font-mono tabular-nums text-[var(--foreground)]">
            Final {details.score}
          </span>
        ) : null}
        {details.hasBannedPlayer ? (
          <span className="text-[var(--danger)]">Banned player in lobby</span>
        ) : null}
        <a
          href={`https://leetify.com/app/match-details/${details.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--amber)] underline-offset-2 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          Open on Leetify
        </a>
        {details.replayUrl ? (
          <a
            href={details.replayUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--amber)] underline-offset-2 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            Demo download
          </a>
        ) : null}
      </div>

      {teamNumbers.map((n, i) => (
        <TeamTable
          key={n}
          label={
            teamNumbers.length === 2
              ? i === 0
                ? "Team A"
                : "Team B"
              : `Team ${n}`
          }
          players={teams.get(n) ?? []}
          steamId={steamId}
        />
      ))}

      {details.players.length === 0 ? (
        <p className="text-xs text-[var(--muted)]">
          No per-player stats returned for this match.
        </p>
      ) : null}
    </div>
  );
}

export function LeetifyMatchHistory({ matches, steamId }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cache, setCache] = useState<
    Record<string, LeetifyMatchDetails | null>
  >({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadMatch = useCallback(async (gameId: string) => {
    setLoadingId(gameId);
    setErrors((prev) => {
      const next = { ...prev };
      delete next[gameId];
      return next;
    });
    try {
      const res = await fetch(
        `/api/leetify/match/${encodeURIComponent(gameId)}`,
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      } & Partial<LeetifyMatchDetails>;
      if (!res.ok || !isMatchDetails(data)) {
        throw new Error(data.error || `Failed to load match (${res.status})`);
      }
      setCache((prev) => ({ ...prev, [gameId]: data }));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load match.";
      setErrors((prev) => ({ ...prev, [gameId]: message }));
      setCache((prev) => ({ ...prev, [gameId]: null }));
    } finally {
      setLoadingId(null);
    }
  }, []);

  const toggle = useCallback(
    (gameId: string) => {
      setExpandedId((cur) => {
        const next = cur === gameId ? null : gameId;
        if (next && (cache[next] === undefined || errors[next])) {
          void loadMatch(next);
        }
        return next;
      });
    },
    [cache, errors, loadMatch],
  );

  if (matches.length === 0) return null;

  const bannedCount = matches.filter((m) => m.hasBannedPlayer).length;

  return (
    <section className="border border-[var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border)] px-5 py-3">
        <h2 className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
          Match history
        </h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Leetify · click a match for full lobby stats
          {bannedCount > 0 ? (
            <span className="ml-2 text-[var(--danger)]">
              · {bannedCount} with banned player
            </span>
          ) : null}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
              <th className="w-8 px-3 py-2.5 font-semibold" />
              <th className="px-3 py-2.5 font-semibold">Map</th>
              <th className="px-3 py-2.5 font-semibold">Score</th>
              <th className="px-3 py-2.5 font-semibold">Rank</th>
              <th className="px-3 py-2.5 font-semibold">Rating</th>
              <th className="px-3 py-2.5 font-semibold">K / D</th>
              <th className="px-3 py-2.5 font-semibold">K/D</th>
              <th className="px-5 py-2.5 font-semibold">Banned</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {matches.map((match) => {
              const finishedUnix = match.finishedAt
                ? Math.floor(new Date(match.finishedAt).getTime() / 1000)
                : null;
              const open = expandedId === match.id;
              const canExpand = Boolean(match.id);

              return (
                <Fragment key={match.id}>
                  <tr
                    className={[
                      canExpand ? "cursor-pointer" : "",
                      match.hasBannedPlayer
                        ? "bg-[var(--danger)]/5 hover:bg-[var(--danger)]/10"
                        : "hover:bg-[var(--bg-elevated)]/40",
                      open ? "bg-[var(--bg-elevated)]/50" : "",
                    ].join(" ")}
                    onClick={() => {
                      if (canExpand) toggle(match.id);
                    }}
                    onKeyDown={(e) => {
                      if (!canExpand) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggle(match.id);
                      }
                    }}
                    tabIndex={canExpand ? 0 : undefined}
                    aria-expanded={canExpand ? open : undefined}
                  >
                    <td className="px-3 py-3 text-[var(--muted)]">
                      {canExpand ? (open ? "▾" : "▸") : ""}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2.5">
                        <MapIcon map={match.map} size={28} />
                        <div className="min-w-0">
                          <p className="truncate text-[var(--foreground)]">
                            {mapDisplayName(match.map)}
                          </p>
                          <p className="text-[11px] text-[var(--muted)]">
                            {formatMatchDate(finishedUnix)}
                            {match.source ? ` · ${match.source}` : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={
                          match.outcome === "win"
                            ? "font-mono tabular-nums text-[var(--ok)]"
                            : match.outcome === "loss"
                              ? "font-mono tabular-nums text-[var(--danger)]"
                              : "font-mono tabular-nums text-[var(--muted)]"
                        }
                      >
                        {match.score ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <MatchRank match={match} />
                    </td>
                    <td className="px-3 py-3 font-mono tabular-nums">
                      <Rating value={match.leetifyRating} />
                    </td>
                    <td className="px-3 py-3 font-mono tabular-nums text-[var(--foreground)]">
                      {match.kills != null || match.deaths != null
                        ? `${match.kills ?? "—"} / ${match.deaths ?? "—"}`
                        : "—"}
                    </td>
                    <td className="px-3 py-3 font-mono tabular-nums text-[var(--foreground)]">
                      {match.kd != null ? formatDecimal(match.kd) : "—"}
                    </td>
                    <td className="px-5 py-3">
                      {match.hasBannedPlayer ? (
                        <span
                          className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--danger)]"
                          title="Leetify marked a banned player in this lobby"
                        >
                          Yes
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--muted)]">—</span>
                      )}
                    </td>
                  </tr>
                  {open ? (
                    <tr>
                      <td colSpan={8} className="p-0">
                        <MatchDetailPanel
                          steamId={steamId}
                          details={cache[match.id] ?? null}
                          loading={loadingId === match.id}
                          error={
                            loadingId === match.id
                              ? null
                              : (errors[match.id] ?? null)
                          }
                        />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
