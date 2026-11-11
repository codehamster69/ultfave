"use client";

import { useId, useRef } from "react";
import type { KeyboardEvent } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import type { Period } from "@/lib/types";

const PERIODS: { id: Period; label: string; hint: string }[] = [
  { id: "week", label: "Week", hint: "Ranked by the current week" },
  { id: "month", label: "Month", hint: "Ranked by the current month" },
  { id: "year", label: "Year", hint: "Ranked by the current year" },
];

const BASE =
  "relative isolate inline-flex items-center justify-center rounded-full px-3.5 py-1.5 font-mono text-[0.64rem] uppercase tracking-[0.16em] transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime sm:px-4";

/**
 * Segmented control over links: period switches stay real navigations (work
 * without JS, stay shareable, keep every other query param), while the lime
 * indicator slides between segments via a shared motion layoutId.
 *
 * Client component by necessity (the indicator animates), but the props are
 * plain strings so it renders fine from server components on any page.
 */
export function PeriodTabs({
  period,
  basePath,
  query,
}: {
  period: Period;
  basePath: string;
  query?: Record<string, string>;
}) {
  const extra = Object.entries(query ?? {}).filter(
    ([, value]) => typeof value === "string" && value.length > 0,
  );
  const reduce = useReducedMotion();
  const indicatorId = `${useId().replace(/:/g, "")}-period-indicator`;
  const listRef = useRef<HTMLDivElement>(null);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(event.key)) return;
    const triggers = Array.from(
      listRef.current?.querySelectorAll<HTMLAnchorElement>("a[data-period-tab]") ?? [],
    );
    if (triggers.length === 0) return;

    const current = triggers.indexOf(document.activeElement as HTMLAnchorElement);
    let next = current;
    if (event.key === "ArrowRight") next = current < 0 ? 0 : (current + 1) % triggers.length;
    if (event.key === "ArrowLeft")
      next = current < 0 ? triggers.length - 1 : (current - 1 + triggers.length) % triggers.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = triggers.length - 1;

    event.preventDefault();
    triggers[next]?.focus();
  }

  return (
    <nav aria-label="Leaderboard period" className="inline-flex max-w-full">
      <div
        ref={listRef}
        onKeyDown={handleKeyDown}
        className="inline-flex max-w-full items-center gap-0.5 rounded-full border border-line/80 bg-panel/80 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur"
      >
        {PERIODS.map((item) => {
          const params = new URLSearchParams();
          for (const [key, value] of extra) params.set(key, value);
          params.set("period", item.id);
          const href = `${basePath}${basePath.includes("?") ? "&" : "?"}${params.toString()}`;
          const active = item.id === period;

          return (
            <Link
              key={item.id}
              href={href}
              data-period-tab={item.id}
              aria-current={active ? "page" : undefined}
              title={item.hint}
              className={`${BASE} ${
                active ? "text-ink" : "text-muted hover:bg-panel2/80 hover:text-fg"
              }`}
            >
              {active ? (
                <motion.span
                  layoutId={indicatorId}
                  aria-hidden="true"
                  className="absolute inset-0 -z-10 rounded-full bg-lime shadow-[0_0_0_1px_rgba(255,82,54,0.5),0_8px_24px_-10px_rgba(255,82,54,0.65)]"
                  transition={
                    reduce
                      ? { duration: 0 }
                      : { type: "spring", stiffness: 430, damping: 34, mass: 0.6 }
                  }
                />
              ) : null}
              <span className="relative">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default PeriodTabs;
