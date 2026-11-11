"use client";

import Link from "next/link";
import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";

import type { UserBadge } from "@/lib/types";

type Tier = UserBadge["tier"];

type TierMeta = {
  label: string;
  ink: string;
  rim: string;
  face: string;
  glow: string;
  spotlight: string;
  border: string;
};

/** Tier hardware: rim conic, face radial and the accent used for type + glow. */
const TIERS: Record<Tier, TierMeta> = {
  bronze: {
    label: "Bronze",
    ink: "#f0c8a4",
    rim: "conic-gradient(from 210deg, #7a4e2c, #f0c198 18%, #a86d3d 44%, #5d3c24 66%, #e8bd93 86%, #7a4e2c)",
    face: "radial-gradient(125% 125% at 30% 22%, rgba(240,193,152,0.34), rgba(22,15,10,0.94) 60%, rgba(19,9,15,0.98))",
    glow: "rgba(201,130,75,0.45)",
    spotlight: "rgba(240,193,152,0.16)",
    border: "rgba(201,130,75,0.42)",
  },
  silver: {
    label: "Silver",
    ink: "#dfe4ff",
    rim: "conic-gradient(from 210deg, #5b6480, #e8ecff 18%, #98a3c9 44%, #3d4358 66%, #dfe6ff 86%, #5b6480)",
    face: "radial-gradient(125% 125% at 30% 22%, rgba(200,210,255,0.3), rgba(32,17,27,0.94) 60%, rgba(19,9,16,0.98))",
    glow: "rgba(147,167,255,0.42)",
    spotlight: "rgba(200,210,255,0.16)",
    border: "rgba(147,167,255,0.42)",
  },
  gold: {
    label: "Gold",
    ink: "#ffe1a0",
    rim: "conic-gradient(from 210deg, #7a5a1c, #ffe6a3 18%, #d9a33a 44%, #6b4a14 66%, #ffdf94 86%, #7a5a1c)",
    face: "radial-gradient(125% 125% at 30% 22%, rgba(255,213,128,0.34), rgba(24,18,9,0.94) 60%, rgba(11,10,8,0.98))",
    glow: "rgba(242,178,76,0.5)",
    spotlight: "rgba(255,224,166,0.2)",
    border: "rgba(242,178,76,0.45)",
  },
  elite: {
    label: "Elite",
    ink: "#ff8a6e",
    rim: "conic-gradient(from 210deg, #8a2a1a, #ffc4b5 18%, #b7e13a 44%, #32400e 66%, #ff5236 86%, #8a2a1a)",
    face: "radial-gradient(125% 125% at 30% 22%, rgba(255,82,54,0.3), rgba(26,10,8,0.94) 60%, rgba(18,8,6,0.98))",
    glow: "rgba(255,82,54,0.5)",
    spotlight: "rgba(255,82,54,0.18)",
    border: "rgba(255,82,54,0.5)",
  },
};

/** The frozen icon set. Inline SVG only, no emoji. */
function MedallionIcon({ name, className = "h-8 w-8" }: { name: string; className?: string }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true as const,
    focusable: "false" as const,
  };

  switch (name) {
    case "flame":
      return (
        <svg {...common}>
          <path d="M12 3c2.2 2.8 4.4 4.6 4.4 8a4.4 4.4 0 0 1-8.8 0c0-1.6.7-2.9 1.7-4.1.2 1.5.8 2.4 1.6 2.9C11.2 7.4 10.9 5 12 3Z" />
          <path d="M12 20v1" />
        </svg>
      );
    case "crown":
      return (
        <svg {...common}>
          <path d="M3 8.5 7.5 11 12 5l4.5 6L21 8.5 19 19H5L3 8.5Z" />
        </svg>
      );
    case "disc":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="2.6" />
          <path d="M12 3.5v2M12 18.5v2" />
        </svg>
      );
    case "moon":
      return (
        <svg {...common}>
          <path d="M20 14.8A8.6 8.6 0 0 1 9.2 4 8.6 8.6 0 1 0 20 14.8Z" />
        </svg>
      );
    case "swords":
      return (
        <svg {...common}>
          <path d="M18 3l3 3-12 12H6v-3L18 3Z" />
          <path d="M6 3 3 6l12 12h3v-3L6 3Z" />
        </svg>
      );
    case "trophy":
      return (
        <svg {...common}>
          <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
          <path d="M8 5.5H5.5V7a3 3 0 0 0 3 3" />
          <path d="M16 5.5h2.5V7a3 3 0 0 1-3 3" />
          <path d="M12 13v4" />
          <path d="M9 20h6" />
        </svg>
      );
    case "target":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="1.6" />
        </svg>
      );
    case "bolt":
    default:
      return (
        <svg {...common}>
          <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
        </svg>
      );
  }
}

export type MedallionBadge = {
  name: string;
  description: string;
  icon: string;
  tier: Tier;
  artistId: string | null;
  artistName: string | null;
  earnedLabel: string;
  earnedOn: string;
};

/**
 * One earned badge, mounted in the trophy case. Tilts toward the pointer with
 * spring physics and carries a tier-coloured spotlight. Pointer maths run on
 * motion values, so hovering never re-renders React. Reduced motion keeps the
 * medallion flat and static.
 */
export function BadgeMedallion({
  badge,
  index = 0,
  className = "",
}: {
  badge: MedallionBadge;
  index?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement | null>(null);
  const tiltX = useMotionValue(0);
  const tiltY = useMotionValue(0);
  const rotateX = useSpring(tiltX, { stiffness: 240, damping: 26, mass: 0.4 });
  const rotateY = useSpring(tiltY, { stiffness: 240, damping: 26, mass: 0.4 });
  const meta = TIERS[badge.tier] ?? TIERS.bronze;

  function handleMove(event: ReactPointerEvent<HTMLElement>) {
    if (reduce) return;
    const el = ref.current;
    if (!el || event.pointerType === "touch") return;
    const rect = el.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    tiltX.set((0.5 - py) * 9);
    tiltY.set((px - 0.5) * 11);
    el.style.setProperty("--mx", `${Math.round(px * 100)}%`);
    el.style.setProperty("--my", `${Math.round(py * 100)}%`);
  }

  function handleLeave() {
    tiltX.set(0);
    tiltY.set(0);
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--mx", "50%");
    el.style.setProperty("--my", "40%");
  }

  return (
    <motion.article
      ref={ref}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      whileHover={{ y: -3 }}
      transition={{
        duration: reduce ? 0 : 0.55,
        delay: reduce ? 0 : Math.min(index, 7) * 0.045,
        ease: [0.16, 1, 0.3, 1],
      }}
      style={{
        rotateX,
        rotateY,
        transformPerspective: 820,
        transformStyle: "preserve-3d",
        borderColor: meta.border,
        backgroundImage: `linear-gradient(180deg, rgba(41,22,35,0.92), rgba(22,10,18,0.88)), radial-gradient(120% 90% at 50% 0%, ${meta.glow}, transparent 70%)`,
      }}
      className={`group relative flex h-full flex-col items-center gap-2.5 rounded-[1.15rem] border px-3 pb-4 pt-5 text-center ${className}`}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[1.15rem] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(160px circle at var(--mx, 50%) var(--my, 40%), ${meta.spotlight}, transparent 70%)`,
        }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-7 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
      />

      <div className="relative mt-0.5 h-[74px] w-[74px] shrink-0 sm:h-20 sm:w-20" style={{ transform: "translateZ(24px)" }}>
        <span
          aria-hidden="true"
          className="absolute -inset-2 rounded-full opacity-70 blur-lg"
          style={{ background: `radial-gradient(circle, ${meta.glow}, transparent 72%)` }}
        />
        <div
          className="relative h-full w-full rounded-full p-[2px]"
          style={{
            backgroundImage: meta.rim,
            boxShadow: `0 0 0 1px ${meta.border}, 0 14px 26px -16px ${meta.glow}`,
          }}
        >
          <div
            className="flex h-full w-full items-center justify-center rounded-full"
            style={{ backgroundImage: meta.face }}
          >
            <span style={{ color: meta.ink }}>
              <MedallionIcon name={badge.icon} className="h-8 w-8 sm:h-[2.1rem] sm:w-[2.1rem]" />
            </span>
          </div>
          <span
            aria-hidden="true"
            className="absolute left-1/2 top-[7px] h-[7px] w-10 -translate-x-1/2 rounded-full bg-white/30 blur-[2px]"
          />
        </div>
      </div>

      <div className="relative flex min-w-0 flex-col items-center gap-1">
        <span
          className="font-mono text-[0.55rem] uppercase tracking-[0.22em]"
          style={{ color: meta.ink }}
        >
          {meta.label}
        </span>
        <h3 className="font-display text-[0.95rem] font-semibold leading-tight tracking-tight text-fg">
          {badge.name}
        </h3>
        <p className="hidden text-[0.68rem] leading-snug text-muted sm:line-clamp-2">
          {badge.description}
        </p>
      </div>

      <div className="relative mt-auto w-full border-t border-line/70 pt-2 font-mono text-[0.55rem] uppercase leading-relaxed tracking-[0.1em] text-muted">
        {badge.artistName ? (
          badge.artistId ? (
            <Link
              href={`/artist/${badge.artistId}`}
              className="text-fg/80 underline decoration-line/80 underline-offset-2 transition hover:text-lime hover:decoration-lime/50"
            >
              {badge.artistName}
            </Link>
          ) : (
            <span className="text-fg/80">{badge.artistName}</span>
          )
        ) : (
          <span className="text-fg/60">global</span>
        )}
        <span aria-hidden="true" className="mx-1 text-line">
          /
        </span>
        <span title={badge.earnedOn}>{badge.earnedLabel}</span>
      </div>
    </motion.article>
  );
}

export default BadgeMedallion;
