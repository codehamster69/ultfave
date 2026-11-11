"use client";

import { MotionConfig, motion, useReducedMotion } from "motion/react";

export type LiveState = "live" | "paused" | "error";

const TONE: Record<LiveState, { dot: string; text: string; border: string; halo: string }> = {
  live: {
    dot: "bg-lime",
    text: "text-lime",
    border: "border-lime/30",
    halo: "bg-lime/50",
  },
  paused: {
    dot: "bg-muted",
    text: "text-muted",
    border: "border-line",
    halo: "bg-muted/40",
  },
  error: {
    dot: "bg-magenta",
    text: "text-magenta",
    border: "border-magenta/30",
    halo: "bg-magenta/50",
  },
};

const SR_STATE: Record<LiveState, string> = {
  live: "live updates running",
  paused: "updates paused while this tab is hidden",
  error: "updates interrupted, retrying automatically",
};

/**
 * Pulsing live indicator. The radar halo is a motion loop so it stays smooth
 * (CSS pulse classes do not compose with the reduced-motion reset here); SSR
 * renders the same static dot markup for both server and client, and the halo
 * is skipped entirely for reduced-motion users.
 */
export function LiveBadge({
  label = "Live",
  state = "live",
  detail,
  className = "",
}: {
  label?: string;
  state?: LiveState;
  detail?: string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const tone = TONE[state] ?? TONE.live;
  const pulse = state === "live";

  return (
    <MotionConfig reducedMotion="user">
      <span
        className={`inline-flex items-center gap-2 rounded-full border bg-panel/70 px-2.5 py-1 font-mono text-[0.58rem] uppercase tracking-[0.18em] ${tone.border} ${tone.text} ${className}`}
      >
        <span
          className="relative inline-flex h-2.5 w-2.5 shrink-0 items-center justify-center"
          aria-hidden="true"
        >
          <span className={`absolute inline-flex h-2.5 w-2.5 rounded-full ${tone.halo} opacity-20`} />
          {pulse ? (
            <motion.span
              className={`absolute inline-flex h-2.5 w-2.5 rounded-full ${tone.halo}`}
              initial={{ opacity: 0.45, scale: 0.6 }}
              animate={reduce ? { opacity: 0, scale: 0.6 } : { opacity: 0, scale: 2.4 }}
              transition={
                reduce ? { duration: 0 } : { duration: 1.9, repeat: Infinity, ease: "easeOut" }
              }
            />
          ) : null}
          <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${tone.dot}`} />
        </span>
        <span>{label}</span>
        {detail ? (
          <span className="hidden text-muted sm:inline" aria-hidden="true">
            {detail}
          </span>
        ) : null}
        <span className="sr-only">{SR_STATE[state] ?? SR_STATE.live}</span>
      </span>
    </MotionConfig>
  );
}

export default LiveBadge;
