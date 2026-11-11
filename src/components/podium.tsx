"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { animate, motion, useReducedMotion } from "motion/react";
import { Avatar, Delta } from "@/components/ui";
import { formatMinutes, formatPoints } from "@/lib/period";
import type { LeaderboardRow } from "@/lib/types";

type Tier = 1 | 2 | 3;

type PodiumTone = {
  label: string;
  medal: string;
  text: string;
  border: string;
  surface: string;
  bar: string;
  ring: string;
  order: string;
  height: string;
  delay: number;
};

const TONES: Record<Tier, PodiumTone> = {
  1: {
    label: "Gold",
    medal: "I",
    text: "text-gold",
    border: "border-gold/35",
    surface:
      "bg-[linear-gradient(180deg,rgba(242,178,76,0.14),rgba(41,22,35,0.92)_52%,rgba(30,16,25,0.96))]",
    bar: "bg-gradient-to-r from-transparent via-gold to-transparent",
    ring: "ring-1 ring-gold/30",
    order: "sm:order-2",
    height: "sm:min-h-[19.5rem]",
    delay: 0.1,
  },
  2: {
    label: "Silver",
    medal: "II",
    text: "text-peri",
    border: "border-peri/30",
    surface:
      "bg-[linear-gradient(180deg,rgba(147,167,255,0.12),rgba(41,22,35,0.92)_55%,rgba(30,16,25,0.96))]",
    bar: "bg-gradient-to-r from-transparent via-peri to-transparent",
    ring: "ring-1 ring-peri/25",
    order: "sm:order-1",
    height: "sm:min-h-[16.75rem]",
    delay: 0,
  },
  3: {
    label: "Bronze",
    medal: "III",
    text: "text-magenta",
    border: "border-magenta/25",
    surface:
      "bg-[linear-gradient(180deg,rgba(242,65,124,0.1),rgba(41,22,35,0.92)_58%,rgba(30,16,25,0.96))]",
    bar: "bg-gradient-to-r from-transparent via-magenta to-transparent",
    ring: "ring-1 ring-magenta/25",
    order: "sm:order-3",
    height: "sm:min-h-[15.5rem]",
    delay: 0.2,
  },
};

const YOU_CHIP = {
  color: "var(--color-lime)",
  borderColor: "rgba(255, 82, 54, 0.45)",
  background: "rgba(255, 82, 54, 0.08)",
};

const TIER_STYLE: Record<string, { color: string; borderColor: string }> = {
  gold: { color: "var(--color-gold)", borderColor: "rgba(242, 178, 76, 0.45)" },
  elite: { color: "var(--color-lime)", borderColor: "rgba(255, 82, 54, 0.45)" },
  silver: { color: "var(--color-peri)", borderColor: "rgba(147, 167, 255, 0.45)" },
  bronze: { color: "var(--color-magenta)", borderColor: "rgba(242, 65, 124, 0.4)" },
};

/** Crown-like geometric crest for #1 — inline SVG, no emoji. */
function Crest({ className = "" }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      viewBox="0 0 64 30"
      aria-hidden="true"
      focusable="false"
      className={`h-7 w-16 ${className}`}
      fill="none"
    >
      <defs>
        <linearGradient id={`crest-${id}`} x1="0" y1="0" x2="64" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFE8A3" />
          <stop offset="0.45" stopColor="#F2B24C" />
          <stop offset="1" stopColor="#B27A18" />
        </linearGradient>
      </defs>
      <path
        d="M3 25V7l12.5 8.5L32 3l16.5 12.5L61 7v18H3Z"
        fill={`url(#crest-${id})`}
        fillOpacity="0.9"
      />
      <path d="M11 28h42" stroke="#F2B24C" strokeOpacity="0.55" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M32 3v9" stroke="#150A12" strokeOpacity="0.35" strokeWidth="1.4" />
      <circle cx="3" cy="7" r="2" fill="#F2B24C" />
      <circle cx="61" cy="7" r="2" fill="#F2B24C" />
      <circle cx="32" cy="3" r="2" fill="#FFE8A3" />
    </svg>
  );
}

function CountUp({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    if (reduce) {
      setDisplay(value);
      return;
    }
    started.current = true;
    const controls = animate(0, value, {
      duration: 0.85,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => setDisplay(Math.round(latest)),
    });
    return () => controls.stop();
  }, [reduce, value]);

  return (
    <>
      <span aria-hidden="true">{formatPoints(display)}</span>
      <span className="sr-only">{formatPoints(value)} points</span>
    </>
  );
}

function BadgeChips({ badges }: { badges: LeaderboardRow["badges"] }) {
  const shown = badges.slice(0, 2);
  if (shown.length === 0) return null;
  return (
    <>
      {shown.map((badge) => (
        <span
          key={badge.id}
          className="chip max-w-[7rem] truncate"
          style={TIER_STYLE[badge.tier]}
          title={`${badge.name} badge`}
        >
          {badge.name}
        </span>
      ))}
    </>
  );
}

function PodiumCard({
  row,
  isViewer,
  action,
}: {
  row: LeaderboardRow;
  isViewer: boolean;
  action: ReactNode;
}) {
  const reduce = useReducedMotion();
  const tier = Math.min(Math.max(row.rank, 1), 3) as Tier;
  const tone = TONES[tier];
  const isFirst = tier === 1;

  return (
    <motion.li
      className={`relative flex flex-col overflow-hidden rounded-[1.25rem] border ${tone.border} ${tone.surface} ${tone.order} ${tone.height} ${
        isViewer ? "ring-2 ring-lime/60" : tone.ring
      } p-4 sm:p-5`}
      initial={reduce ? false : { y: 26, scale: 0.96 }}
      animate={{ y: 0, scale: 1 }}
      transition={
        reduce
          ? { duration: 0 }
          : { type: "spring", stiffness: 210, damping: 24, delay: tone.delay }
      }
      whileHover={reduce ? undefined : { y: -6 }}
      style={{ willChange: "transform" }}
    >
      <span className={`absolute inset-x-0 top-0 h-px ${tone.bar}`} aria-hidden="true" />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-6 -top-8 font-display text-[7rem] leading-none text-white/[0.035] select-none"
      >
        {tone.medal}
      </span>

      <div className="relative flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-[0.56rem] uppercase tracking-[0.22em] text-muted">Rank</p>
          <p className={`num text-4xl font-bold leading-none ${tone.text}`}>#{row.rank}</p>
        </div>
        {isFirst ? (
          <Crest className="mt-0.5 drop-shadow-[0_0_16px_rgba(242,178,76,0.35)]" />
        ) : (
          <span className={`chip ${tone.text}`} style={{ borderColor: "currentColor" }}>
            {tone.label}
          </span>
        )}
      </div>

      <div className="relative mt-4 flex items-center gap-3">
        <span
          className={`relative inline-flex rounded-full p-[2px] ${
            isFirst
              ? "bg-[conic-gradient(from_140deg,#ffe8a3,#f2b24c,#b27a18,#ffe8a3)]"
              : tier === 2
                ? "bg-[conic-gradient(from_140deg,#cdd6ff,#93a7ff,#3f4b9c,#cdd6ff)]"
                : "bg-[conic-gradient(from_140deg,#ffb3cf,#f2417c,#7a1a3f,#ffb3cf)]"
          }`}
        >
          <Avatar
            name={row.name}
            src={row.avatarUrl}
            size={isFirst ? 64 : 48}
            ring={isViewer}
          />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-display text-[1.05rem] font-semibold leading-tight tracking-tight text-fg">
              {row.name}
            </span>
            {isViewer ? (
              <span className="chip shrink-0" style={YOU_CHIP}>
                You
              </span>
            ) : null}
          </div>
          <div className="truncate font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted">
            @{row.handle}
          </div>
        </div>
      </div>

      <div className="relative mt-4 flex items-end justify-between gap-2">
        <div>
          <p className="font-mono text-[0.56rem] uppercase tracking-[0.16em] text-muted">Points</p>
          <p className="num text-[1.7rem] font-bold leading-none text-fg">
            <CountUp value={row.points} />
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[0.56rem] uppercase tracking-[0.16em] text-muted">Minutes</p>
          <p className="num text-sm leading-none text-fg/80">{formatMinutes(row.minutes)}</p>
        </div>
      </div>

      <div className="relative mt-auto flex items-end justify-between gap-2 pt-4">
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          <BadgeChips badges={row.badges} />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full border px-1.5 py-0.5 ${
              (row.delta ?? 0) > 0
                ? "border-lime/30 bg-lime/[0.06]"
                : (row.delta ?? 0) < 0
                  ? "border-magenta/30 bg-magenta/[0.06]"
                  : "border-line bg-ink/40"
            }`}
          >
            <Delta value={row.delta} />
          </span>
          {action}
        </div>
      </div>

      {/* Pedestal: taller for #1 so the block reads as a real podium */}
      <span
        aria-hidden="true"
        className={`absolute inset-x-0 bottom-0 ${tone.bar} ${
          isFirst ? "h-1" : tier === 2 ? "h-[3px]" : "h-0.5"
        } opacity-80`}
      />
    </motion.li>
  );
}

export function Podium({
  rows,
  meId,
  actionFor,
}: {
  rows: LeaderboardRow[];
  meId: string | null;
  actionFor?: (row: LeaderboardRow) => ReactNode;
}) {
  if (rows.length === 0) return null;

  return (
    <ul className="grid list-none gap-3 sm:grid-cols-3 sm:items-end">
      {rows.map((row) => {
        const isViewer = Boolean(row.isMe || (meId !== null && row.userId === meId));
        return (
          <PodiumCard
            key={row.userId}
            row={row}
            isViewer={isViewer}
            action={actionFor ? actionFor(row) : null}
          />
        );
      })}
    </ul>
  );
}

export default Podium;
