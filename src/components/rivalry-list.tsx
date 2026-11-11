"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MotionConfig, motion, useReducedMotion } from "motion/react";
import { Avatar, EmptyState } from "@/components/ui";
import { formatPoints } from "@/lib/period";

type Rivalry = {
  userId: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
  artistId: string | null;
  artistName: string | null;
  myPoints: number;
  theirPoints: number;
  diff: number;
  ahead: boolean;
};

type FollowState = {
  following: boolean;
  busy: boolean;
  error: string | null;
  toggle: () => Promise<void>;
};

function useFollow(userId: string, initiallyFollowing: boolean): FollowState {
  const router = useRouter();
  const [following, setFollowing] = useState(initiallyFollowing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFollowing(initiallyFollowing);
  }, [initiallyFollowing]);

  const toggle = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const action = following ? "unfollow" : "follow";
    try {
      const res = await fetch("/api/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action }),
      });
      const payload = (await res.json().catch(() => null)) as
        | { ok?: boolean; following?: boolean; error?: string }
        | null;
      if (!res.ok || !payload || payload.ok === false) {
        setError(payload?.error ?? "Could not update follow");
        return;
      }
      setFollowing(typeof payload.following === "boolean" ? payload.following : action === "follow");
      router.refresh();
    } catch {
      setError("Network error — try again");
    } finally {
      setBusy(false);
    }
  }, [busy, following, router, userId]);

  return { following, busy, error, toggle };
}

function toggleClasses(following: boolean): string {
  const base =
    "rounded-full border px-3 py-1 font-mono text-[0.58rem] uppercase tracking-[0.14em] transition disabled:opacity-50";
  return following
    ? `${base} border-lime/40 bg-lime/[0.08] text-lime hover:border-magenta/50 hover:text-magenta`
    : `${base} border-line text-muted hover:border-lime/60 hover:text-fg`;
}

export function FollowButton({
  userId,
  initialFollowing = false,
  className = "",
}: {
  userId: string;
  initialFollowing?: boolean;
  className?: string;
}) {
  const { following, busy, error, toggle } = useFollow(userId, initialFollowing);

  return (
    <span className={`inline-flex flex-col items-end gap-1 ${className}`}>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={following}
        className={toggleClasses(following)}
      >
        {busy ? "…" : following ? "Following" : "Follow"}
      </button>
      {error ? (
        <span className="font-mono text-[0.55rem] uppercase tracking-[0.1em] text-magenta">{error}</span>
      ) : null}
    </span>
  );
}

function ArtistGlyph() {
  return (
    <svg
      viewBox="0 0 14 14"
      className="h-2.5 w-2.5 shrink-0 text-lime"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <circle cx="7" cy="7" r="5.2" />
      <circle cx="7" cy="7" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TrendArrow({ up }: { up: boolean }) {
  return (
    <svg
      viewBox="0 0 12 12"
      className="h-2.5 w-2.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {up ? <path d="M6 10V2.5M2.5 6 6 2.5 9.5 6" /> : <path d="M6 2v7.5M2.5 6 6 9.5 9.5 6" />}
    </svg>
  );
}

function DuelBar({
  label,
  points,
  percent,
  pointsTone,
  barTone,
  delay,
  reduce,
}: {
  label: string;
  points: number;
  percent: number;
  pointsTone: string;
  barTone: string;
  delay: number;
  reduce: boolean;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[0.52rem] uppercase tracking-[0.18em] text-muted">{label}</span>
        <span className={`num text-[0.95rem] font-semibold leading-none ${pointsTone}`}>
          {formatPoints(points)}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-panel2">
        <motion.span
          className={`block h-full rounded-full ${barTone}`}
          initial={{ width: "0%" }}
          animate={{ width: `${percent}%` }}
          transition={
            reduce
              ? { duration: 0 }
              : { type: "spring", stiffness: 105, damping: 20, mass: 0.9, delay }
          }
        />
      </div>
    </div>
  );
}

function RivalryCard({
  rivalry,
  viewerName,
  viewerAvatarUrl,
}: {
  rivalry: Rivalry;
  viewerName: string;
  viewerAvatarUrl?: string | null;
}) {
  const { following, busy, error, toggle } = useFollow(rivalry.userId, true);
  const reduce = useReducedMotion() ?? false;

  const max = Math.max(rivalry.myPoints, rivalry.theirPoints, 1);
  const myPercent = Math.round((rivalry.myPoints / max) * 100);
  const theirPercent = Math.round((rivalry.theirPoints / max) * 100);
  const total = rivalry.myPoints + rivalry.theirPoints;
  const share = total > 0 ? Math.round((rivalry.myPoints / total) * 100) : 50;
  const lead = rivalry.diff;
  const glow =
    lead > 0 ? "bg-lime/[0.09]" : lead < 0 ? "bg-magenta/[0.08]" : "bg-peri/[0.07]";

  return (
    <article className="relative overflow-hidden rounded-[1.1rem] border border-line bg-gradient-to-b from-panel2/70 to-panel/90 p-4 transition-colors hover:border-line/80">
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute -right-12 -top-16 h-36 w-36 rounded-full blur-3xl ${glow}`}
      />

      <div className="relative flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Avatar name={viewerName} src={viewerAvatarUrl} size={28} ring />
          <span className="font-mono text-[0.5rem] uppercase tracking-[0.14em] text-muted">vs</span>
          <Avatar name={rivalry.name} src={rivalry.avatarUrl} size={28} />
          <div className="ml-1 min-w-0">
            <div className="truncate font-display text-[0.95rem] font-semibold leading-tight tracking-tight text-fg">
              {rivalry.name}
            </div>
            <div className="truncate font-mono text-[0.55rem] uppercase tracking-[0.14em] text-muted">
              @{rivalry.handle}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          aria-pressed={following}
          className={toggleClasses(following)}
        >
          {busy ? "…" : following ? "Following" : "Follow"}
        </button>
      </div>

      <div className="relative mt-2.5">
        <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line px-2.5 py-[0.15rem] font-mono text-[0.55rem] uppercase tracking-[0.12em] text-muted">
          <ArtistGlyph />
          <span className="truncate">
            {rivalry.artistName ? rivalry.artistName : "All artists combined"}
          </span>
        </span>
      </div>

      <div className="relative mt-3.5 space-y-2.5">
        <DuelBar
          label="you"
          points={rivalry.myPoints}
          percent={myPercent}
          pointsTone="text-lime"
          barTone="bg-gradient-to-r from-lime to-lime/55"
          delay={0.05}
          reduce={reduce}
        />
        <DuelBar
          label="them"
          points={rivalry.theirPoints}
          percent={theirPercent}
          pointsTone="text-fg"
          barTone="bg-gradient-to-r from-peri/80 to-peri/35"
          delay={0.12}
          reduce={reduce}
        />
      </div>

      <div className="relative mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line/70 pt-2.5">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-[0.2rem] font-mono text-[0.55rem] uppercase tracking-[0.14em] ${
            lead > 0
              ? "border-lime/35 bg-lime/[0.06] text-lime"
              : lead < 0
                ? "border-magenta/35 bg-magenta/[0.06] text-magenta"
                : "border-line text-muted"
          }`}
        >
          {lead === 0 ? (
            <span className="h-1.5 w-1.5 rounded-full bg-muted" aria-hidden="true" />
          ) : (
            <TrendArrow up={lead > 0} />
          )}
          {lead === 0
            ? "dead even"
            : lead > 0
              ? `you lead by ${formatPoints(lead)}`
              : `behind by ${formatPoints(Math.abs(lead))}`}
        </span>
        <span className="num font-mono text-[0.52rem] uppercase tracking-[0.1em] text-muted">
          {share}% of duel
        </span>
      </div>

      {error ? (
        <div className="relative mt-1.5 font-mono text-[0.55rem] uppercase tracking-[0.1em] text-magenta">
          {error}
        </div>
      ) : null}
    </article>
  );
}

export function RivalryList({
  rivalries,
  viewerName,
  viewerAvatarUrl = null,
}: {
  rivalries: Rivalry[];
  viewerName: string;
  viewerAvatarUrl?: string | null;
}) {
  if (rivalries.length === 0) {
    return (
      <EmptyState
        title="No rivalries yet"
        description={`Follow a fan and the duel card lands here: the shared artist, both point totals, and exactly how far ${viewerName} is ahead or behind.`}
        action={
          <Link href="#find-rivals" className="btn btn-primary">
            Find rivals
          </Link>
        }
      />
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 font-mono text-[0.55rem] uppercase tracking-[0.16em] text-muted">
            <span className="live-dot h-1.5 w-1.5 rounded-full bg-lime" aria-hidden="true" />
            {rivalries.length} tracked
          </span>
          <span className="truncate font-mono text-[0.55rem] uppercase tracking-[0.14em] text-muted">
            you are {viewerName}
          </span>
        </div>
        {rivalries.map((rivalry, index) => (
          <div
            key={rivalry.userId}
            className="rise"
            style={{ animationDelay: `${Math.min(index, 6) * 60}ms` }}
          >
            <RivalryCard
              rivalry={rivalry}
              viewerName={viewerName}
              viewerAvatarUrl={viewerAvatarUrl}
            />
          </div>
        ))}
      </div>
    </MotionConfig>
  );
}

export default RivalryList;
