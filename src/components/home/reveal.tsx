"use client";

import { motion, useInView, useReducedMotion, useSpring } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

/** Shared easing: fast out, long settle — the "scoreboard" feel. */
const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * In-view reveal for the home page. Server-rendered children stay server
 * components: only the wrapper ships JS. Motion values are never rendered on
 * the server, so hydration stays byte-identical.
 */
export function Reveal({
  children,
  delay = 0,
  y = 16,
  once = true,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  once?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={{ y }}
      whileInView={{ y: 0 }}
      viewport={{ once, amount: 0.12, margin: "0px 0px -8% 0px" }}
      transition={{
        duration: reduce ? 0 : 0.66,
        delay: reduce ? 0 : delay,
        ease: EASE,
      }}
    >
      {children}
    </motion.div>
  );
}

const BAR_TONE: Record<string, string> = {
  lime: "bg-lime",
  gold: "bg-gold",
  peri: "bg-peri",
  magenta: "bg-magenta",
  muted: "bg-muted",
};

/**
 * Thin in-view bar used for the leaderboard points column. Width is a share of
 * the board leader, animated with a scaleX spring-in so long lists do not jank.
 */
export function RevealBar({
  ratio,
  tone = "lime",
  delay = 0,
  className = "",
}: {
  ratio: number;
  tone?: "lime" | "gold" | "peri" | "magenta" | "muted";
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduce = useReducedMotion();
  const pct = Math.max(3, Math.min(100, Math.round((Number.isFinite(ratio) ? ratio : 0) * 100)));

  return (
    <span
      ref={ref}
      aria-hidden="true"
      className={`block h-[3px] overflow-hidden rounded-full bg-line/70 ${className}`}
    >
      <motion.span
        className={`block h-full origin-left rounded-full ${BAR_TONE[tone] ?? BAR_TONE.lime}`}
        style={{ width: `${pct}%` }}
        initial={{ scaleX: 0, opacity: 0.4 }}
        animate={{ scaleX: inView ? 1 : 0, opacity: inView ? 1 : 0.4 }}
        transition={{ duration: reduce ? 0 : 0.9, delay: reduce ? 0 : delay, ease: EASE }}
      />
    </span>
  );
}

/**
 * Pointer parallax wrapper (spring-smoothed). Motion values are only attached
 * after mount so the server markup carries no transform.
 */
export function Parallax({
  children,
  depth = 9,
  className = "",
}: {
  children: ReactNode;
  depth?: number;
  className?: string;
}) {
  const [active, setActive] = useState(false);
  const x = useSpring(0, { stiffness: 90, damping: 18, mass: 0.6 });
  const y = useSpring(0, { stiffness: 90, damping: 18, mass: 0.6 });

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const onMove = (event: PointerEvent) => {
      const nx = (event.clientX / window.innerWidth) * 2 - 1;
      const ny = (event.clientY / window.innerHeight) * 2 - 1;
      x.set(nx * depth);
      y.set(ny * depth * 0.5);
    };

    setActive(true);
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
    };
  }, [depth, x, y]);

  return (
    <motion.div className={className} style={active ? { x, y } : undefined}>
      {children}
    </motion.div>
  );
}
