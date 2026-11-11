"use client";

import { useId, type ReactNode } from "react";
import { MotionConfig, motion, useReducedMotion } from "motion/react";

export type RingTone = "lime" | "peri" | "gold" | "muted";

const STOPS: Record<RingTone, [string, string]> = {
  lime: ["#ff5236", "#a8e024"],
  peri: ["#93a7ff", "#5f70f0"],
  gold: ["#f2b24c", "#e79f2c"],
  muted: ["#6b7488", "#3a4152"],
};

const GLOW: Record<RingTone, string> = {
  lime: "drop-shadow(0 0 6px rgba(255,82,54,0.45))",
  peri: "drop-shadow(0 0 6px rgba(147,167,255,0.4))",
  gold: "drop-shadow(0 0 6px rgba(242,178,76,0.4))",
  muted: "none",
};

/**
 * SVG progress ring with a spring-animated stroke. The dash offset starts at
 * "empty" on the server too, so SSR and the first client render agree; only the
 * animated value changes after hydration. Reduced-motion users jump straight to
 * the final offset instead of springing there.
 */
export function ProgressRing({
  value,
  size = 72,
  thickness = 6,
  tone = "lime",
  label,
  glow = false,
  children,
  className = "",
}: {
  value: number;
  size?: number;
  thickness?: number;
  tone?: RingTone;
  label: string;
  glow?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const rawId = useId();
  const gradientId = `fr-ring-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const ratio = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  const radius = Math.max(1, (size - thickness) / 2);
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const [from, to] = STOPS[tone] ?? STOPS.lime;

  return (
    <MotionConfig reducedMotion="user">
      <span
        className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
        style={{ width: size, height: size }}
        role="img"
        aria-label={label}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={from} />
              <stop offset="100%" stopColor={to} />
            </linearGradient>
          </defs>
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="rgba(247,237,227,0.07)"
            strokeWidth={thickness}
          />
          <motion.circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={thickness}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference * (1 - ratio) }}
            transition={
              reduce ? { duration: 0 } : { type: "spring", stiffness: 58, damping: 17, mass: 0.7 }
            }
            style={glow ? { filter: GLOW[tone] ?? "none" } : undefined}
          />
        </svg>
        <span
          className="absolute inset-0 flex flex-col items-center justify-center leading-none"
          aria-hidden="true"
        >
          {children}
        </span>
      </span>
    </MotionConfig>
  );
}

export default ProgressRing;
