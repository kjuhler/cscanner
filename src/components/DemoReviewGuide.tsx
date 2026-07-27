"use client";

import { useState } from "react";

export function DemoReviewGuide() {
  const [open, setOpen] = useState(false);

  return (
    <section className="border border-[var(--border)] bg-[var(--surface)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div>
          <p className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-[0.18em] text-[var(--amber)]">
            Demo review guide
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            How to separate skill from cheats when validating flags below.
          </p>
        </div>
        <span className="text-sm text-[var(--muted)]">{open ? "−" : "+"}</span>
      </button>

      {open ? (
        <div className="space-y-5 border-t border-[var(--border)] px-4 py-4 text-sm leading-relaxed text-[var(--muted)]">
          <div>
            <h4 className="font-[family-name:var(--font-display)] text-xs font-semibold uppercase tracking-[0.14em] text-[var(--foreground)]">
              Before you judge
            </h4>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                Separate mechanical skill, gamesense, and sound from software
                assistance.
              </li>
              <li>
                CS2 subtick demos can look jittery — judge patterns across
                multiple rounds, not one clip.
              </li>
              <li>
                Our flags are heuristics (distance/occlusion proxies), not VAC
                proof.
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-[family-name:var(--font-display)] text-xs font-semibold uppercase tracking-[0.14em] text-[var(--foreground)]">
              Wall / info abuse
            </h4>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                Crosshair smoothly tracking heads through walls matching enemy
                movement.
              </li>
              <li>
                Pre-aiming obscure corners while ignoring common angles.
              </li>
              <li>
                Hard peeking only when an enemy lines up with zero audio/visual
                info.
              </li>
              <li>
                Tracing or spamming smoked/thin-wall positions without prior
                cues.
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-[family-name:var(--font-display)] text-xs font-semibold uppercase tracking-[0.14em] text-[var(--foreground)]">
              Aim assistance
            </h4>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                Use demoui at 0.25x–0.5x to spot straight-line snaps and
                micro-corrections.
              </li>
              <li>
                Multi-kill transfers that rigidly jump between hidden targets.
              </li>
              <li>
                Shots within 1–3 ticks of an enemy rounding a corner (trigger
                timing).
              </li>
              <li>
                Spray patterns with robotic, perfectly uniform recoil
                compensation.
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-[family-name:var(--font-display)] text-xs font-semibold uppercase tracking-[0.14em] text-[var(--foreground)]">
              Tactical red flags
            </h4>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                Playstyle “switch” — lost for many rounds then suddenly perfect
                timings when behind.
              </li>
              <li>
                Ignoring flanks entirely or hyper-paranoid checks on silent
                lurkers.
              </li>
              <li>
                Review eco / half-buy turnarounds when a team is down 3–0 or
                losing gun rounds.
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-[family-name:var(--font-display)] text-xs font-semibold uppercase tracking-[0.14em] text-[var(--foreground)]">
              Coaching review
            </h4>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                Use Coaching highlights — good vs failed executes show whether
                flashes created space.
              </li>
              <li>
                Watch impact plays for multi-kills, entries after flash, and
                round-swing moments.
              </li>
              <li>
                On the radar replay, blinded players show a flash icon (red =
                enemy flash, amber = team flash).
              </li>
              <li>
                Click Watch to zoom the replay on the play; use Focus play to
                stay tight on the action.
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-[family-name:var(--font-display)] text-xs font-semibold uppercase tracking-[0.14em] text-[var(--foreground)]">
              CS2 workflow
            </h4>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <span className="font-[family-name:var(--font-code)] text-[var(--foreground)]">
                  Shift+F2
                </span>{" "}
                — demoui (close it before pasting console commands).
              </li>
              <li>
                Toggle x-ray to compare what the suspect should know vs what
                they process.
              </li>
              <li>
                Use our watch commands — they jump 15s before the flagged tick
                and lock onto the player.
              </li>
            </ul>
          </div>
        </div>
      ) : null}
    </section>
  );
}
