"use client";

import type { DemoReplay, ReplayRound } from "@/lib/demo";

type Props = {
  replay: DemoReplay;
  roundIdx: number;
  focusSteamId: string;
  onFocusChange: (steamId: string) => void;
  onJumpRound: (idx: number) => void;
};

const CT = "#7a93a8";
const T = "#c9a24a";
const LOSS = "#c45c52";

function Skull({ color }: { color: string }) {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 16 16"
      aria-hidden
      className="shrink-0 drop-shadow-[0_1px_1px_rgba(0,0,0,0.55)]"
    >
      <path
        fill={color}
        d="M8 1.2c-3.1 0-5.6 2.2-5.6 5.1 0 1.7.8 3.1 2 4l-.4 3.2h2.1l.5-1.5h2.8l.5 1.5h2.1l-.4-3.2c1.2-.9 2-2.3 2-4C13.6 3.4 11.1 1.2 8 1.2zm-2.1 5.3a1.1 1.1 0 1 1 0-2.2 1.1 1.1 0 0 1 0 2.2zm4.2 0a1.1 1.1 0 1 1 0-2.2 1.1 1.1 0 0 1 0 2.2zM6.2 9.4c.4.5 1 .8 1.8.8s1.4-.3 1.8-.8H6.2z"
      />
    </svg>
  );
}

/** Death marker — distinct from kill skulls. */
function DeathMark() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 16 16"
      aria-hidden
      className="shrink-0 drop-shadow-[0_1px_1px_rgba(0,0,0,0.55)]"
    >
      <path
        fill={LOSS}
        d="M3.2 3.2 4.6 1.8 8 5.2l3.4-3.4 1.4 1.4L9.4 6.6l3.4 3.4-1.4 1.4L8 8l-3.4 3.4-1.4-1.4 3.4-3.4-3.4-3.4z"
      />
    </svg>
  );
}

function Star({ color }: { color: string }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 16 16"
      aria-hidden
      className="shrink-0 drop-shadow-[0_1px_1px_rgba(0,0,0,0.55)]"
    >
      <path
        fill={color}
        d="M8 1.2 9.9 5.7l4.9.4-3.7 3.2 1.1 4.7L8 11.7l-4.2 2.3 1.1-4.7L1.2 6.1l4.9-.4z"
      />
    </svg>
  );
}

function teamAtRound(
  replay: DemoReplay,
  steamId: string,
  round: ReplayRound,
): number {
  const frame =
    replay.frames.find((f) => f.tick >= round.startTick) ??
    [...replay.frames].reverse().find((f) => f.tick <= round.startTick);
  const pose = frame?.players.find((p) => p.steamId === steamId);
  if (pose?.team === 2 || pose?.team === 3) return pose.team;
  const ref = replay.players.find((p) => p.steamId === steamId);
  return ref?.team ?? 0;
}

function killsInRound(
  replay: DemoReplay,
  steamId: string,
  round: ReplayRound,
): number {
  return replay.events.filter(
    (e) =>
      e.kind === "kill" &&
      e.actorSteamId === steamId &&
      e.round === round.round,
  ).length;
}

function deathsInRound(
  replay: DemoReplay,
  steamId: string,
  round: ReplayRound,
): number {
  return replay.events.filter(
    (e) =>
      e.kind === "kill" &&
      e.targetSteamId === steamId &&
      e.round === round.round,
  ).length;
}

function labelRounds(total: number): number[] {
  if (total <= 0) return [];
  const marks = new Set<number>([1]);
  for (const n of [4, 8, 12, 16, 20, 24, 27, 30, 33]) {
    if (n <= total) marks.add(n);
  }
  marks.add(total);
  return [...marks].sort((a, b) => a - b);
}

export function DemoRoundTimeline({
  replay,
  roundIdx,
  focusSteamId,
  onFocusChange,
  onJumpRound,
}: Props) {
  const rounds = replay.rounds;
  const halfIdx = rounds.findIndex((r) => r.round === 12);
  const showHalf =
    halfIdx >= 0 && halfIdx < rounds.length - 1 && rounds.length > 12;
  const labels = labelRounds(rounds[rounds.length - 1]?.round ?? 0);

  return (
    <div className="border-t border-[var(--border)] bg-[#0c1014]/90 px-4 py-3 backdrop-blur-sm">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-[family-name:var(--font-display)] text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
            Rounds
          </p>
          <p className="flex items-center gap-2 text-[10px] text-[var(--muted)]">
            <span className="inline-flex items-center gap-1">
              <Skull color="#8b96a3" /> kill
            </span>
            <span className="inline-flex items-center gap-1">
              <DeathMark /> death
            </span>
          </p>
        </div>
        <label className="flex items-center gap-2 text-[11px] text-[var(--muted)]">
          POV
          <select
            className="max-w-[180px] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--foreground)]"
            value={focusSteamId}
            onChange={(e) => onFocusChange(e.target.value)}
          >
            {replay.players.map((p) => (
              <option key={p.steamId} value={p.steamId}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-x-auto pb-1">
        <div
          className="relative mx-auto flex min-w-max items-stretch justify-center gap-0 px-1"
          style={{ minHeight: 92 }}
        >
          {/* Baseline */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[#3a4550]/90"
          />

          {rounds.map((round, idx) => {
            const team = teamAtRound(replay, focusSteamId, round);
            const hasWinner = round.winnerTeam === 2 || round.winnerTeam === 3;
            const won = hasWinner && team > 0 && round.winnerTeam === team;
            const lost = hasWinner && team > 0 && round.winnerTeam !== team;
            const sideColor = team === 3 ? CT : team === 2 ? T : CT;
            const kills = focusSteamId
              ? killsInRound(replay, focusSteamId, round)
              : 0;
            const deaths = focusSteamId
              ? deathsInRound(replay, focusSteamId, round)
              : 0;
            const died = deaths > 0;
            const isMvp = Boolean(
              focusSteamId && round.mvpSteamId === focusSteamId,
            );
            const active = idx === roundIdx;
            const afterHalf = showHalf && idx === halfIdx;
            // Kills without known win/loss still show above the line.
            const showKillsUnknown = !hasWinner && kills > 0;

            return (
              <div key={`${round.round}-${idx}`} className="flex items-stretch">
                <button
                  type="button"
                  onClick={() => onJumpRound(idx)}
                  title={`Round ${round.round}${won ? " · win" : lost ? " · loss" : ""}${kills ? ` · ${kills}K` : ""}${died ? ` · ${deaths}D` : ""}${isMvp ? " · MVP" : ""}`}
                  className={`group relative flex w-7 flex-col items-center justify-center outline-none sm:w-8 ${
                    active ? "z-[1]" : ""
                  }`}
                >
                  {/* Win glow */}
                  {won ? (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0.5 top-[18%] bottom-[52%] rounded-sm opacity-35"
                      style={{
                        background: `linear-gradient(180deg, ${sideColor}55 0%, transparent 100%)`,
                      }}
                    />
                  ) : null}
                  {lost || died ? (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0.5 top-[52%] bottom-[18%] rounded-sm opacity-30"
                      style={{
                        background: `linear-gradient(0deg, ${LOSS}55 0%, transparent 100%)`,
                      }}
                    />
                  ) : null}

                  {/* Above axis — kills */}
                  <div className="flex h-[38px] flex-col-reverse items-center justify-start gap-px pb-0.5">
                    {won ? (
                      <>
                        {Array.from({
                          length: Math.max(0, Math.min(5, kills)),
                        }).map((_, i) => (
                          <Skull key={`w-${i}`} color={sideColor} />
                        ))}
                        <span
                          className="mb-0.5 h-[7px] w-[11px] rounded-[1px]"
                          style={{ background: sideColor }}
                        />
                      </>
                    ) : null}
                    {showKillsUnknown
                      ? Array.from({
                          length: Math.max(0, Math.min(5, kills)),
                        }).map((_, i) => (
                          <Skull key={`u-${i}`} color="#8b96a3" />
                        ))
                      : null}
                  </div>

                  {/* Axis marker / MVP star */}
                  <div className="relative z-[1] flex h-3 items-center justify-center">
                    {isMvp ? (
                      <Star color={won ? sideColor : "#d8dde3"} />
                    ) : (
                      <span
                        className={`h-1.5 w-px ${
                          active ? "bg-[var(--foreground)]" : "bg-[#5a6570]"
                        }`}
                      />
                    )}
                  </div>

                  {/* Below axis — loss kills + deaths */}
                  <div className="flex h-[38px] flex-col items-center justify-start gap-px pt-0.5">
                    {lost ? (
                      <span
                        className="mt-0.5 h-[7px] w-[11px] rounded-[1px]"
                        style={{ background: LOSS }}
                      />
                    ) : null}
                    {lost && kills > 0
                      ? Array.from({
                          length: Math.max(0, Math.min(5, kills)),
                        }).map((_, i) => (
                          <Skull key={`l-${i}`} color={LOSS} />
                        ))
                      : null}
                    {died
                      ? Array.from({
                          length: Math.max(1, Math.min(3, deaths)),
                        }).map((_, i) => <DeathMark key={`d-${i}`} />)
                      : null}
                  </div>

                  {/* Active ring */}
                  {active ? (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-y-1 inset-x-0 rounded-sm border border-[var(--amber)]/70"
                    />
                  ) : null}
                </button>

                {afterHalf ? (
                  <div
                    className="relative mx-0.5 flex w-5 flex-col items-center justify-center"
                    aria-hidden
                  >
                    <span className="absolute inset-y-3 w-px bg-[#6a7580]/80" />
                    <span className="relative z-[1] rounded bg-[#12161b] px-0.5 font-[family-name:var(--font-code)] text-[9px] leading-none text-[#8a95a0]">
                      {"<>"}
                    </span>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Round number scale */}
        <div className="relative mx-auto mt-1 flex min-w-max justify-center px-1">
          {rounds.map((round, idx) => {
            const afterHalf = showHalf && idx === halfIdx;
            const show = labels.includes(round.round);
            return (
              <div key={`lbl-${round.round}-${idx}`} className="flex">
                <div className="flex w-7 justify-center sm:w-8">
                  {show ? (
                    <span className="font-[family-name:var(--font-code)] text-[10px] text-[var(--muted)]">
                      {round.round}
                    </span>
                  ) : (
                    <span className="h-3" />
                  )}
                </div>
                {afterHalf ? <div className="w-5" /> : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
