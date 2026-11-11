"use client";

import { motion, useReducedMotion } from "motion/react";

const FUSE_SCALE = 30;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * The lit fuse for one artist streak: a heat-graded fill that grows to the
 * current run, a ghost marker at the personal best and a flame head that
 * flickers at the leading edge. All motion, no canvas; reduced motion renders
 * the finished bar with a still flame.
 */
export function StreakFlame({
  current,
  longest,
  index = 0,
  className = "",
}: {
  current: number;
  longest: number;
  index?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const safeCurrent = Math.max(0, Math.round(current));
  const safeLongest = Math.max(safeCurrent, Math.round(longest));
  const scale = Math.max(FUSE_SCALE, safeCurrent, safeLongest);
  const fill = clamp01(safeCurrent / scale);
  const best = clamp01(safeLongest / scale);

  return (
    <div className={className}>
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className="num text-[1.75rem] font-semibold leading-none text-lime">
            {safeCurrent}
          </span>
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted">
            {safeCurrent === 1 ? "day straight" : "days straight"}
          </span>
        </div>
        <span className="pb-0.5 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted">
          best <span className="num text-fg/90">{safeLongest}</span>
        </span>
      </div>

      <div className="relative mt-3.5 h-2.5">
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-full border border-line/80 bg-ink/70"
        />

        <motion.span
          aria-hidden="true"
          className="absolute inset-y-[1px] left-0 origin-left overflow-hidden rounded-full"
          style={{
            width: `${fill * 100}%`,
            backgroundImage:
              "linear-gradient(90deg, rgba(255,107,61,0.92) 0%, #f2b24c 52%, #ff5236 100%)",
            boxShadow: "0 0 18px -3px rgba(242,178,76,0.55)",
          }}
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{
            duration: reduce ? 0 : 0.9,
            delay: reduce ? 0 : Math.min(index, 5) * 0.07,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <motion.span
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%)",
            }}
            initial={{ x: "-60%" }}
            animate={reduce ? undefined : { x: ["-60%", "160%"] }}
            transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
          />
        </motion.span>

        {safeLongest > safeCurrent ? (
          <span
            aria-hidden="true"
            title={`Best run: ${safeLongest} days`}
            className="absolute -top-1 h-4 w-px bg-fg/25"
            style={{ left: `${best * 100}%` }}
          />
        ) : null}

        {safeCurrent > 0 ? (
          <motion.span
            aria-hidden="true"
            className="absolute -top-[11px] -ml-[6px] h-[22px] w-[12px]"
            style={{ left: `${fill * 100}%` }}
            initial={{ scaleY: 1, opacity: 1 }}
            animate={
              reduce
                ? undefined
                : { scaleY: [1, 1.16, 0.94, 1], opacity: [0.85, 1, 0.82, 0.95] }
            }
            transition={{
              duration: 2.6,
              repeat: Infinity,
              ease: "easeInOut",
              delay: Math.min(index, 5) * 0.2,
            }}
          >
            <span className="absolute inset-x-0 top-1 h-4 rounded-full bg-gold/40 blur-md" />
            <svg viewBox="0 0 12 22" className="relative h-full w-full" aria-hidden="true" focusable="false">
              <path
                d="M6 1c1.9 2.7 3.8 4.4 3.8 8a3.8 3.8 0 0 1-7.6 0c0-1.5.6-2.7 1.5-3.9.2 1.4.7 2.3 1.4 2.8C5.3 5.3 5.1 3 6 1Z"
                fill="#f2b24c"
              />
              <path
                d="M6 6.5c.9 1.3 1.7 2.1 1.7 3.8a1.7 1.7 0 0 1-3.4 0c0-1.7.8-2.5 1.7-3.8Z"
                fill="#ff5236"
              />
            </svg>
          </motion.span>
        ) : null}
      </div>

      <div className="mt-2.5 flex items-center justify-between font-mono text-[0.55rem] uppercase tracking-[0.14em] text-muted">
        <span>{safeCurrent === 0 ? "fuse cold" : "fuse lit"}</span>
        <span>
          <span className="num text-fg/70">{safeCurrent}</span>
          <span aria-hidden="true"> / </span>
          <span className="num text-fg/50">{scale}</span> day scale
        </span>
      </div>
    </div>
  );
}

export default StreakFlame;
