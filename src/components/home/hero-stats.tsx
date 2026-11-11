"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

export type HeroStatTone = "fg" | "lime" | "gold";

export type HeroStat = {
  label: string;
  value: number;
  hint: string;
  tone: HeroStatTone;
};

const TONE_TEXT: Record<HeroStatTone, string> = {
  fg: "text-fg",
  lime: "text-lime",
  gold: "text-gold",
};

const TONE_RULE: Record<HeroStatTone, string> = {
  fg: "from-fg/50 via-fg/10 to-transparent",
  lime: "from-lime/80 via-lime/15 to-transparent",
  gold: "from-gold/80 via-gold/15 to-transparent",
};

const TONE_GLOW: Record<HeroStatTone, string> = {
  fg: "rgba(247,237,227,0.10)",
  lime: "rgba(255,82,54,0.14)",
  gold: "rgba(242,178,76,0.14)",
};

const DURATION_MS = 1150;

/** One shared formatter: the counters reformat every frame. */
const NUMBER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const format = (value: number): string => NUMBER.format(value);

function useCountUp(target: number, delay: number, enabled: boolean): number {
  const [display, setDisplay] = useState(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!enabled) return;
    if (reduce) {
      setDisplay(target);
      return;
    }
    if (!Number.isFinite(target) || target <= 0) {
      setDisplay(0);
      return;
    }

    let raf = 0;
    let startedAt = 0;

    const step = (now: number) => {
      if (startedAt === 0) startedAt = now + delay;
      const progress = Math.min(1, Math.max(0, (now - startedAt) / DURATION_MS));
      // easeOutQuart
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplay(Math.round(target * eased));
      if (progress < 1) raf = window.requestAnimationFrame(step);
    };

    raf = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(raf);
  }, [target, delay, enabled, reduce]);

  return display;
}

function StatTile({
  stat,
  index,
  enabled,
}: {
  stat: HeroStat;
  index: number;
  enabled: boolean;
}) {
  const delay = index * 130;
  const display = useCountUp(stat.value, delay, enabled);

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={enabled ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
      transition={{ duration: 0.6, delay: index * 0.07, ease: [0.16, 1, 0.3, 1] }}
      className="group relative overflow-hidden rounded-[1.1rem] border border-line bg-panel/70 px-4 py-4 transition-colors duration-300 hover:border-lime/30 sm:px-5"
    >
      <span
        aria-hidden="true"
        className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${TONE_RULE[stat.tone]}`}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: TONE_GLOW[stat.tone] }}
      />

      <div className="relative font-mono text-[0.63rem] uppercase tracking-[0.18em] text-muted">
        {stat.label}
      </div>

      <div className={`relative num mt-2 text-[1.85rem] font-semibold leading-none sm:text-[2.15rem] ${TONE_TEXT[stat.tone]}`}>
        <span aria-hidden="true">{format(display)}</span>
        <span className="sr-only">{format(stat.value)}</span>
      </div>

      <div className="relative mt-2 text-[0.72rem] leading-snug text-muted">{stat.hint}</div>
    </motion.article>
  );
}

/**
 * Three aggregate counters. Values arrive from the server; the tile starts at
 * zero on both server and client (deterministic SSR) and counts up when the
 * group scrolls into view.
 */
export function HeroStats({ stats }: { stats: HeroStat[] }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <div ref={ref} className="grid gap-3 sm:grid-cols-3">
      {stats.map((stat, index) => (
        <StatTile key={stat.label} stat={stat} index={index} enabled={inView} />
      ))}
    </div>
  );
}
