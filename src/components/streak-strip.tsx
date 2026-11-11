import Link from "next/link";

import StreakFlame from "@/components/streak-flame";
import { Avatar, EmptyState } from "@/components/ui";
import { timeAgo } from "@/lib/period";
import type { UserStreak } from "@/lib/types";

function lastActive(lastDay: string | null): string {
  if (!lastDay) return "never";
  return timeAgo(`${lastDay}T00:00:00.000Z`);
}

function StreakCard({ streak, index }: { streak: UserStreak; index: number }) {
  return (
    <article className="panel panel-hover relative flex flex-col overflow-hidden p-4">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-14 h-28 w-28 rounded-full bg-gold/10 blur-2xl"
      />
      <div className="relative flex items-center gap-2.5">
        <Avatar name={streak.artistName} src={streak.imageUrl} size={36} />
        <div className="min-w-0 flex-1">
          <Link
            href={`/artist/${streak.artistId}`}
            className="block truncate font-display text-sm font-semibold tracking-tight text-fg transition hover:text-lime"
          >
            {streak.artistName}
          </Link>
          <p className="mt-0.5 font-mono text-[0.55rem] uppercase tracking-[0.14em] text-muted">
            last active {lastActive(streak.lastDay)}
          </p>
        </div>
      </div>

      <StreakFlame
        className="relative mt-4"
        current={streak.current}
        longest={streak.longest}
        index={index}
      />
    </article>
  );
}

/**
 * Server-safe streak strip: one card per artist, strongest current streak first.
 * The fuse itself is the animated client visual; this shell keeps the links and
 * a real empty state so brand-new fans never see a broken panel.
 */
export function StreakStrip({ streaks, className = "" }: { streaks: UserStreak[]; className?: string }) {
  if (streaks.length === 0) {
    return (
      <EmptyState
        title="No streak on the board"
        description="Streaks start the second day you play the same artist. Sync your listening, then come back tomorrow to light the fuse."
        action={
          <Link href="/" className="btn btn-ghost">
            Find an artist
          </Link>
        }
        className={className}
      />
    );
  }

  return (
    <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${className}`}>
      {streaks.map((streak, index) => (
        <StreakCard key={streak.artistId} streak={streak} index={index} />
      ))}
    </div>
  );
}

export default StreakStrip;
