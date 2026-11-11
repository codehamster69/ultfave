"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "motion/react";

export type TickerFormat = "int" | "minutes" | "hours" | "days" | "rank";

/** Pure formatter shared by SSR and the client, so both render the same string. */
export function formatTicker(value: number, format: TickerFormat): string {
  const safe = Number.isFinite(value) ? value : 0;
  switch (format) {
    case "minutes":
      return safe >= 60 ? `${(safe / 60).toFixed(1)}h` : `${Math.round(safe)}m`;
    case "hours":
      return `${(safe / 60).toLocaleString("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}h`;
    case "days":
      return `${Math.round(safe)}d`;
    case "rank":
      return `#${Math.max(1, Math.round(safe))}`;
    case "int":
    default:
      return Math.round(safe).toLocaleString("en-US");
  }
}

/**
 * A number that counts up once, when it first scrolls into view.
 *
 * - Server render and first client render both print the final value, so the
 *   page is readable without JS and hydration never mismatches.
 * - Reduced motion (OS setting) keeps the final value and never animates.
 * - Screen readers get the final value once; the rolling digits are hidden.
 */
export function StatTicker({
  value,
  format = "int",
  duration = 1.1,
  delay = 0,
  className = "",
}: {
  value: number;
  format?: TickerFormat;
  duration?: number;
  delay?: number;
  className?: string;
}) {
  const finalText = formatTicker(value, format);
  const [display, setDisplay] = useState<string>(finalText);
  const [rolling, setRolling] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const played = useRef(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    setDisplay(finalText);
    const el = ref.current;
    if (!el || reduce || played.current || value <= 0) return;
    if (typeof IntersectionObserver === "undefined") return;

    let controls: { stop: () => void } | null = null;
    let timer: number | undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        played.current = true;
        setRolling(true);
        setDisplay(formatTicker(0, format));
        timer = window.setTimeout(() => {
          controls = animate(0, value, {
            duration,
            ease: [0.16, 1, 0.3, 1],
            onUpdate: (latest: number) => setDisplay(formatTicker(latest, format)),
            onComplete: () => {
              setDisplay(finalText);
              setRolling(false);
            },
          });
        }, delay * 1000);
      },
      { threshold: 0.4 },
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
      if (timer !== undefined) window.clearTimeout(timer);
      controls?.stop();
    };
  }, [value, format, duration, delay, reduce, finalText]);

  return (
    <span ref={ref} className={`num relative inline-block tabular-nums ${className}`.trim()}>
      {/* Invisible final value reserves the width so the layout never jitters. */}
      <span aria-hidden="true" className="invisible">
        {finalText}
      </span>
      <span aria-hidden="true" className="absolute inset-0 text-left" data-rolling={rolling || undefined}>
        {display}
      </span>
      <span className="sr-only">{finalText}</span>
    </span>
  );
}

export default StatTicker;
