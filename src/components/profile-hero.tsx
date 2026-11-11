"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { animate, motion, useInView, useReducedMotion } from "motion/react";

import { SyncButton } from "@/components/sync-button";
import { formatMinutes } from "@/lib/period";

const GRID_LINES: CSSProperties = {
  backgroundImage:
    "linear-gradient(to right, rgba(247,237,227,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(247,237,227,0.05) 1px, transparent 1px)",
  backgroundSize: "54px 54px",
  maskImage: "radial-gradient(120% 120% at 20% 0%, #000 10%, transparent 74%)",
  WebkitMaskImage: "radial-gradient(120% 120% at 20% 0%, #000 10%, transparent 74%)",
};

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "FR";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function hueOf(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 360;
  }
  return hash;
}

const QUICK_LINKS = [
  { href: "#rotation", label: "Rotation" },
  { href: "#streaks", label: "Streaks" },
  { href: "#badges", label: "Badges" },
];

/**
 * Identity block for /me: a slow-turning tier ring around the fan's avatar,
 * the name, handle, demo flag, sync action and in-page jumps. Every animation
 * is transform/opacity only, and reduced motion flattens it.
 */
export function ProfileHero({
  name,
  handle,
  avatarUrl,
  isDemo,
  badgesUnlocked,
  badgeTotal,
}: {
  name: string;
  handle: string;
  avatarUrl: string | null;
  isDemo: boolean;
  badgesUnlocked: number;
  badgeTotal: number;
}) {
  const reduce = useReducedMotion();
  const hue = hueOf(name || "ultfave");

  const reveal = {
    // Static hidden state keeps SSR and hydration identical; only the easing
    // clock is shortened for reduced-motion users.
    hidden: { opacity: 0, y: 12 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: reduce ? 0 : 0.45, ease: [0.16, 1, 0.3, 1] as const },
    },
  };

  return (
    <motion.section
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: reduce ? 0 : 0.07, delayChildren: 0.04 } } }}
      className="relative overflow-hidden rounded-[1.4rem] border border-line bg-panel2/70"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={GRID_LINES} />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-lime/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-16 -bottom-24 h-56 w-56 rounded-full bg-peri/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-lime/45 to-transparent"
      />

      <div className="relative flex flex-col gap-6 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
        <div className="flex min-w-0 items-center gap-4 sm:gap-5">
          <motion.div variants={reveal} className="relative h-[84px] w-[84px] shrink-0 sm:h-24 sm:w-24">
            <span
              aria-hidden="true"
              className="absolute -inset-2 rounded-full bg-lime/15 blur-xl"
            />
            <motion.span
              aria-hidden="true"
              className="absolute inset-0 rounded-full"
              style={{
                backgroundImage:
                  "conic-gradient(from 150deg, rgba(255,82,54,0.95), rgba(147,167,255,0.7) 36%, rgba(255,82,54,0.15) 62%, rgba(255,82,54,0.95))",
                maskImage: "radial-gradient(farthest-side, transparent calc(100% - 4px), #000 0)",
                WebkitMaskImage: "radial-gradient(farthest-side, transparent calc(100% - 4px), #000 0)",
              }}
              initial={{ rotate: 0 }}
              animate={reduce ? undefined : { rotate: 360 }}
              transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
            />
            <div className="absolute inset-[5px] overflow-hidden rounded-full border border-line bg-ink">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={name}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <span
                  className="flex h-full w-full items-center justify-center font-display text-xl tracking-tight text-fg/90"
                  style={{
                    backgroundImage: `linear-gradient(145deg, hsl(${hue} 60% 36%), hsl(${(hue + 54) % 360} 58% 16%))`,
                  }}
                  role="img"
                  aria-label={name}
                >
                  <span aria-hidden="true">{initialsOf(name)}</span>
                </span>
              )}
            </div>
          </motion.div>

          <div className="min-w-0">
            <motion.p
              variants={reveal}
              className="font-mono text-[0.6rem] uppercase tracking-[0.26em] text-lime"
            >
              Fan profile
            </motion.p>
            <motion.h1
              variants={reveal}
              className="mt-1.5 truncate font-display text-[1.85rem] font-semibold leading-none tracking-tight text-fg sm:text-4xl"
              title={name}
            >
              {name}
            </motion.h1>
            <motion.div variants={reveal} className="mt-2.5 flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted">@{handle}</span>
              {isDemo ? (
                <span className="chip border-peri/40 text-peri">
                  <span className="live-dot h-1 w-1 rounded-full bg-peri" aria-hidden="true" />
                  Demo fan
                </span>
              ) : (
                <span className="chip border-lime/30 text-lime/90">
                  <span className="h-1 w-1 rounded-full bg-lime" aria-hidden="true" />
                  Spotify linked
                </span>
              )}
              <span className="chip">
                {badgesUnlocked}/{badgeTotal} badges
              </span>
            </motion.div>
          </div>
        </div>

        <motion.div
          variants={reveal}
          className="flex flex-col items-start gap-3 lg:items-end"
        >
          <SyncButton />
          <nav aria-label="Profile shortcuts" className="flex flex-wrap items-center gap-1.5">
            {QUICK_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full border border-line bg-ink/40 px-3 py-1.5 font-mono text-[0.55rem] uppercase tracking-[0.16em] text-muted transition hover:border-lime/40 hover:text-lime focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </motion.div>
      </div>
    </motion.section>
  );
}

export type StatFormat = "points" | "minutes" | "days";

export type ProfileStat = {
  label: string;
  value: number;
  format: StatFormat;
  hint: string;
  tone: "lime" | "peri" | "fg" | "gold";
};

const TONE_TEXT: Record<ProfileStat["tone"], string> = {
  lime: "text-lime",
  peri: "text-peri",
  fg: "text-fg",
  gold: "text-gold",
};

const TONE_GLOW: Record<ProfileStat["tone"], string> = {
  lime: "rgba(255,82,54,0.22)",
  peri: "rgba(147,167,255,0.22)",
  fg: "rgba(247,237,227,0.16)",
  gold: "rgba(242,178,76,0.22)",
};

function formatStat(value: number, format: StatFormat): string {
  if (format === "minutes") return formatMinutes(value);
  if (format === "days") return `${Math.round(value)}d`;
  return Math.round(value).toLocaleString("en-US");
}

/**
 * Count-up number. SSR renders the final value so the page is readable before
 * hydration; the roll from zero starts only once the card is in view and is
 * skipped entirely for reduced-motion users.
 */
function AnimatedNumber({
  value,
  format,
  delay = 0,
}: {
  value: number;
  format: StatFormat;
  delay?: number;
}) {
  const [display, setDisplay] = useState(value);
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setDisplay(value);
      return;
    }
    let controls: { stop: () => void } | null = null;
    const timer = window.setTimeout(() => {
      controls = animate(0, value, {
        duration: 0.95,
        ease: [0.22, 1, 0.36, 1],
        onUpdate: (latest: number) => setDisplay(latest),
      });
    }, delay * 1000);
    return () => {
      window.clearTimeout(timer);
      controls?.stop();
    };
  }, [inView, value, reduce, delay]);

  return (
    <span ref={ref} className="tabular-nums">
      {formatStat(display, format)}
    </span>
  );
}

/** Season totals: count-up figures with a soft tier glow and spring hover. */
export function ProfileStats({ stats }: { stats: ProfileStat[] }) {
  const reduce = useReducedMotion();

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          whileHover={{ y: -3 }}
          transition={{
            duration: reduce ? 0 : 0.5,
            delay: reduce ? 0 : Math.min(index, 3) * 0.05,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="panel relative overflow-hidden px-4 py-3.5 sm:px-5 sm:py-4"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-10 -top-12 h-28 w-28 rounded-full blur-2xl"
            style={{ background: TONE_GLOW[stat.tone] }}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent"
          />
          <div className="relative font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted">
            {stat.label}
          </div>
          <div
            className={`num relative mt-1.5 text-2xl font-semibold tracking-tight sm:text-3xl ${TONE_TEXT[stat.tone]}`}
          >
            <AnimatedNumber value={stat.value} format={stat.format} delay={index * 0.08} />
          </div>
          <div className="relative mt-1 text-[0.72rem] leading-snug text-muted">{stat.hint}</div>
        </motion.div>
      ))}
    </div>
  );
}
