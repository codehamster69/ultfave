import BadgeMedallion, { type MedallionBadge } from "@/components/badge-medallion";
import { BADGE_DEFS, BADGE_BY_ID, type BadgeDef } from "@/lib/badges";
import { timeAgo } from "@/lib/period";
import type { UserBadge } from "@/lib/types";

/** Inline SVG for the fixed badge icon set. No emoji, no external assets. */
export function BadgeIcon({ name, className = "h-5 w-5" }: { name: string; className?: string }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true as const,
    focusable: "false" as const,
  };

  switch (name) {
    case "bolt":
      return (
        <svg {...common}>
          <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
        </svg>
      );
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
    default:
      return (
        <svg {...common}>
          <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
        </svg>
      );
  }
}

function relativeEarned(iso: string): string {
  const stamp = new Date(iso).getTime();
  if (!Number.isFinite(stamp)) return "earned";
  return timeAgo(iso);
}

function absoluteEarned(iso: string): string {
  const stamp = new Date(iso);
  if (Number.isNaN(stamp.getTime())) return "";
  return stamp.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function toMedallion(badge: UserBadge): MedallionBadge {
  return {
    name: badge.name,
    description: badge.description,
    icon: badge.icon,
    tier: badge.tier,
    artistId: badge.artistId,
    artistName: badge.artistName,
    earnedLabel: relativeEarned(badge.earnedAt),
    earnedOn: absoluteEarned(badge.earnedAt),
  };
}

function LockedTile({ def }: { def: BadgeDef }) {
  return (
    <div className="relative flex h-full flex-col items-center gap-2.5 rounded-[1.15rem] border border-dashed border-line/80 bg-ink/40 px-3 pb-4 pt-5 text-center">
      <div className="relative mt-0.5 flex h-[74px] w-[74px] shrink-0 items-center justify-center rounded-full border border-dashed border-line sm:h-20 sm:w-20">
        <span aria-hidden="true" className="absolute inset-2 rounded-full bg-panel2/50" />
        <BadgeIcon name={def.icon} className="relative h-7 w-7 text-muted/35" />
      </div>
      <div className="flex min-w-0 flex-col items-center gap-1">
        <span className="font-mono text-[0.55rem] uppercase tracking-[0.22em] text-muted/70">
          Locked · {def.tier}
        </span>
        <h3 className="font-display text-[0.95rem] font-semibold leading-tight tracking-tight text-muted">
          {def.name}
        </h3>
        <p className="hidden text-[0.68rem] leading-snug text-muted/60 sm:line-clamp-2">
          {def.description}
        </p>
      </div>
      <div className="mt-auto w-full border-t border-line/50 pt-2 font-mono text-[0.55rem] uppercase leading-relaxed tracking-[0.1em] text-muted/60">
        {def.rule}
      </div>
    </div>
  );
}

/**
 * The trophy case. Earned hardware is mounted first as interactive medallions,
 * newest first; the rest of the catalogue stays visible as locked plinths so
 * the set always reads as eight. Empty input renders the full locked case.
 */
export function BadgeGrid({ badges, className = "" }: { badges: UserBadge[]; className?: string }) {
  const seen = new Set<string>();
  const earned: UserBadge[] = [];
  for (const badge of badges) {
    if (seen.has(badge.id) || !BADGE_BY_ID.has(badge.id)) continue;
    seen.add(badge.id);
    earned.push(badge);
  }
  const locked = BADGE_DEFS.filter((def) => !seen.has(def.id));

  return (
    <div
      className={`relative overflow-hidden rounded-[1.3rem] border border-line bg-panel/60 ${className}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(90% 60% at 50% -12%, rgba(247,237,227,0.09), transparent 68%), linear-gradient(180deg, rgba(41,22,35,0.35), rgba(21,10,18,0.55))",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/45 to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-10 bottom-0 h-px bg-gradient-to-r from-transparent via-line to-transparent"
      />

      <div className="relative p-3.5 sm:p-5">
        {earned.length === 0 ? (
          <p className="mb-3.5 rounded-lg border border-dashed border-line/80 bg-ink/30 px-3 py-2 text-center font-mono text-[0.58rem] uppercase tracking-[0.16em] text-muted">
            Nothing mounted yet — every badge below is still up for grabs
          </p>
        ) : (
          <div className="mb-3.5 flex items-center justify-between gap-3 font-mono text-[0.55rem] uppercase tracking-[0.18em] text-muted">
            <span className="flex items-center gap-2">
              <span className="live-dot h-1 w-1 rounded-full bg-gold" aria-hidden="true" />
              Case open
            </span>
            <span>
              <span className="num text-fg/80">{earned.length}</span> mounted ·{" "}
              <span className="num text-fg/50">{locked.length}</span> to chase
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 items-stretch gap-2.5 sm:gap-3 xl:grid-cols-4">
          {earned.map((badge, index) => (
            <BadgeMedallion
              key={`${badge.id}-${badge.earnedAt}`}
              badge={toMedallion(badge)}
              index={index}
            />
          ))}
          {locked.map((def) => (
            <LockedTile key={def.id} def={def} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default BadgeGrid;
