import type { ReactNode } from "react";

/**
 * Server-safe UI primitives. No "use client": none of these need state or effects,
 * so they can be rendered from server components and from client components alike.
 */

type AvatarSize = 28 | 36 | 48 | 64;
type AvatarStatus = "lime" | "magenta" | "peri" | "gold" | "muted";

const AVATAR_PX: Record<AvatarSize, number> = { 28: 28, 36: 36, 48: 48, 64: 64 };

const AVATAR_TEXT: Record<AvatarSize, string> = {
  28: "text-[0.6rem]",
  36: "text-[0.72rem]",
  48: "text-[0.9rem]",
  64: "text-[1.15rem]",
};

const AVATAR_DOT: Record<AvatarSize, number> = { 28: 7, 36: 9, 48: 10, 64: 12 };

const STATUS_FILL: Record<AvatarStatus, string> = {
  lime: "bg-lime",
  magenta: "bg-magenta",
  peri: "bg-peri",
  gold: "bg-gold",
  muted: "bg-muted",
};

const STATUS_LABEL: Record<AvatarStatus, string> = {
  lime: "online",
  magenta: "live",
  peri: "listening",
  gold: "top fan",
  muted: "away",
};

const AVATAR_RING =
  "conic-gradient(from 210deg, rgba(255,82,54,0.85), rgba(147,167,255,0.55) 32%, rgba(242,65,124,0.42) 62%, rgba(255,82,54,0.85))";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/** Stable 0-359 hue from the name, so the same fan always gets the same gradient. */
function hueOf(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 360;
  }
  return hash;
}

export function Avatar({
  name,
  src,
  size = 36,
  ring = false,
  status,
  statusLabel,
  className = "",
}: {
  name: string;
  src?: string | null;
  size?: AvatarSize;
  ring?: boolean;
  status?: AvatarStatus | boolean;
  statusLabel?: string;
  className?: string;
}) {
  const px = AVATAR_PX[size] ?? 36;
  const hue = hueOf(name || "ultfave");
  const statusTone: AvatarStatus | null = status === true ? "lime" : status || null;
  const dot = AVATAR_DOT[size] ?? 9;

  return (
    <span
      className={`relative inline-flex shrink-0 select-none ${className}`}
      style={{
        width: px,
        height: px,
        boxShadow: ring
          ? "0 0 0 1px rgba(255,82,54,0.4), 0 0 24px -8px rgba(255,82,54,0.5)"
          : undefined,
        borderRadius: 9999,
      }}
    >
      {/* Gradient ring: brighter when the avatar is being called out. */}
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-full transition-opacity duration-300"
        style={{ background: AVATAR_RING, opacity: ring ? 1 : 0.5 }}
      />

      {src ? (
        <span className="absolute inset-[1.5px] overflow-hidden rounded-full bg-panel2 ring-1 ring-black/60">
          {/* Spotify CDN avatars are already sized; plain img keeps this server-renderable. */}
          <img
            src={src}
            alt={name}
            width={px}
            height={px}
            loading="lazy"
            className="h-full w-full object-cover"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -8px 16px rgba(0,0,0,0.35)",
            }}
          />
        </span>
      ) : (
        <span
          className={`absolute inset-[1.5px] flex items-center justify-center overflow-hidden rounded-full font-mono font-semibold uppercase leading-none text-fg ${
            AVATAR_TEXT[size] ?? "text-[0.72rem]"
          }`}
          style={{
            backgroundImage: `linear-gradient(145deg, hsl(${hue} 58% 40%), hsl(${(hue + 54) % 360} 56% 18%))`,
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -10px 20px rgba(0,0,0,0.45)",
          }}
          role="img"
          aria-label={name}
        >
          <span aria-hidden="true">{initialsOf(name)}</span>
        </span>
      )}

      {statusTone ? (
        <span
          className={`absolute bottom-0 right-0 rounded-full ring-2 ring-ink ${STATUS_FILL[statusTone]}`}
          style={{ width: dot, height: dot }}
          title={statusLabel ?? STATUS_LABEL[statusTone]}
        >
          <span className="sr-only">{statusLabel ?? STATUS_LABEL[statusTone]}</span>
        </span>
      ) : null}
    </span>
  );
}

type StatTone = "lime" | "fg" | "gold" | "peri" | "magenta" | "muted";

const STAT_TONE: Record<StatTone, { text: string; glow: string; rule: string }> = {
  lime: { text: "text-lime", glow: "rgba(255,82,54,0.16)", rule: "from-lime/50" },
  fg: { text: "text-fg", glow: "rgba(247,237,227,0.08)", rule: "from-fg/25" },
  gold: { text: "text-gold", glow: "rgba(242,178,76,0.16)", rule: "from-gold/45" },
  peri: { text: "text-peri", glow: "rgba(147,167,255,0.16)", rule: "from-peri/45" },
  magenta: { text: "text-magenta", glow: "rgba(242,65,124,0.14)", rule: "from-magenta/45" },
  muted: { text: "text-muted", glow: "rgba(185,163,174,0.1)", rule: "from-muted/30" },
};

export function StatCard({
  label,
  value,
  hint,
  eyebrow,
  tone = "lime",
  className = "",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  eyebrow?: ReactNode;
  tone?: StatTone;
  className?: string;
}) {
  const t = STAT_TONE[tone] ?? STAT_TONE.lime;

  return (
    <div
      className={`panel panel-hover relative isolate overflow-hidden px-4 py-4 sm:px-5 sm:py-[1.15rem] ${className}`}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-9 -top-11 h-28 w-28 rounded-full"
        style={{ background: `radial-gradient(closest-side, ${t.glow}, transparent 72%)` }}
      />
      <span
        aria-hidden="true"
        className={`absolute inset-x-6 top-0 h-px bg-gradient-to-r ${t.rule} to-transparent`}
      />
      <div className="relative min-w-0">
        {eyebrow ? (
          <div className="mb-1.5 font-mono text-[0.58rem] uppercase tracking-[0.24em] text-lime">
            {eyebrow}
          </div>
        ) : null}
        <div className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-muted">{label}</div>
        <div
          className={`num mt-2 text-[1.6rem] font-semibold leading-[1.05] tracking-tight sm:text-[1.85rem] ${t.text}`}
        >
          {value}
        </div>
        {hint ? (
          <div className="mt-1.5 text-[0.72rem] leading-snug text-muted">{hint}</div>
        ) : null}
      </div>
    </div>
  );
}

export function SectionHeader({
  id,
  eyebrow,
  title,
  description,
  action,
  className = "",
}: {
  id?: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-end justify-between gap-x-6 gap-y-4 ${className}`}>
      <div className="min-w-0">
        {eyebrow ? (
          <div className="mb-2.5 flex items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.26em] text-lime">
            <span
              aria-hidden="true"
              className="block h-2.5 w-[3px] -skew-x-[18deg] rounded-[1px] bg-lime/80"
            />
            {eyebrow}
          </div>
        ) : null}
        <h2
          id={id}
          className="font-display text-[clamp(1.55rem,3.4vw,2.35rem)] font-semibold leading-[1.05] tracking-tight text-fg"
        >
          {title}
        </h2>
        {description ? (
          <p className="mt-2.5 max-w-2xl text-[0.9rem] leading-relaxed text-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  className = "",
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative isolate flex flex-col items-center justify-center overflow-hidden rounded-[1.1rem] border border-dashed border-line bg-panel/40 px-6 py-12 text-center ${className}`}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-10 h-40 w-40 -translate-x-1/2 rounded-full opacity-70"
        style={{
          background: "radial-gradient(closest-side, rgba(255,82,54,0.1), transparent 72%)",
        }}
      />

      {/* Empty scoreboard: orbit rings, a lone slash, a flat ticker of bars. */}
      <svg
        viewBox="0 0 132 96"
        className="relative h-24 w-[8.25rem] text-line"
        fill="none"
        aria-hidden="true"
      >
        <ellipse
          cx="66"
          cy="47"
          rx="52"
          ry="27"
          stroke="currentColor"
          strokeDasharray="2 6"
          strokeLinecap="round"
          opacity="0.9"
        />
        <ellipse cx="66" cy="47" rx="35" ry="17" stroke="currentColor" strokeOpacity="0.7" />
        <g stroke="currentColor" strokeLinecap="round" opacity="0.55">
          <path d="M66 5v8" />
          <path d="M66 81v8" />
          <path d="M6 47h8" />
          <path d="M118 47h8" />
        </g>
        <g fill="currentColor" opacity="0.7">
          <rect x="26" y="72" width="3" height="7" rx="1.5" />
          <rect x="33" y="67" width="3" height="12" rx="1.5" />
          <rect x="40" y="76" width="3" height="3" rx="1.5" />
          <rect x="89" y="69" width="3" height="10" rx="1.5" />
          <rect x="96" y="75" width="3" height="4" rx="1.5" />
        </g>
        <g className="text-lime" opacity="0.9">
          <rect
            x="61"
            y="25"
            width="10"
            height="44"
            rx="2"
            fill="currentColor"
            fillOpacity="0.85"
            transform="skewX(-12)"
          />
        </g>
        <circle cx="72" cy="20" r="2.2" className="fill-lime" />
      </svg>

      <div className="relative mt-4 font-display text-lg font-semibold tracking-tight text-fg">
        {title}
      </div>
      {description ? (
        <p className="relative mt-2 max-w-md text-sm leading-relaxed text-muted">{description}</p>
      ) : null}
      {action ? <div className="relative mt-5 flex items-center gap-2">{action}</div> : null}
    </div>
  );
}

/**
 * Rank movement. Positive = climbed (lime up arrow), negative = slid (magenta down
 * arrow), 0 / null / undefined = muted dash. No emoji, inline SVG only.
 */
export function Delta({
  value,
  className = "",
  label = true,
}: {
  value: number | null | undefined;
  className?: string;
  label?: boolean;
}) {
  if (value === null || value === undefined || value === 0) {
    return (
      <span
        className={`num inline-flex items-center text-xs text-muted ${className}`}
        title="No change"
      >
        <span aria-hidden="true">–</span>
        <span className="sr-only">no rank change</span>
      </span>
    );
  }

  const up = value > 0;
  const magnitude = Math.abs(value);

  return (
    <span
      className={`num inline-flex items-center gap-0.5 text-xs font-medium ${
        up ? "text-lime" : "text-magenta"
      } ${className}`}
      title={up ? `Up ${magnitude}` : `Down ${magnitude}`}
    >
      <svg
        viewBox="0 0 12 12"
        className="h-3 w-3 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {up ? (
          <path d="M6 9.75V2.5M2.6 5.9 6 2.5l3.4 3.4" />
        ) : (
          <path d="M6 2.25V9.5M2.6 6.1 6 9.5l3.4-3.4" />
        )}
      </svg>
      {label ? <span aria-hidden="true">{magnitude}</span> : null}
      <span className="sr-only">
        {up ? "up" : "down"} {magnitude}
      </span>
    </span>
  );
}
