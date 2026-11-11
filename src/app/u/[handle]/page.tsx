import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import { ProfileHero, ProfileStats, type ProfileStat } from "@/components/profile-hero";
import { BadgeGrid } from "@/components/badge-grid";
import { StreakStrip } from "@/components/streak-strip";
import { Avatar, EmptyState, SectionHeader } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { getUserByHandle, getUserProfile, getUserTotals } from "@/lib/queries";
import { formatMinutes, formatPoints } from "@/lib/period";

type ProfilePageProps = {
  params: Promise<{ handle: string }>;
};

function rankTone(rank: number | null): string {
  if (rank === 1) return "text-gold";
  if (rank === 2) return "text-peri";
  if (rank === 3) return "text-magenta";
  return "text-muted";
}

const PAGE_MOTION = `
@keyframes ultfave-bar-grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
.ultfave-bar {
  transform-origin: left center;
  animation: ultfave-bar-grow 780ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
@media (prefers-reduced-motion: reduce) {
  .ultfave-bar { animation: none; }
}
`;

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const { handle } = await params;
  const user = await getUserByHandle(handle);
  if (!user) return { title: `Fan not found — Ultfave` };
  return {
    title: `${user.name} (@${user.handle}) — Ultfave`,
    description: `Check out ${user.name}'s listening standings, streaks and badges on Ultfave.`,
    openGraph: {
      title: `${user.name} (@${user.handle}) — Ultfave`,
      description: `Fan profile for ${user.name}. Streaks, badges and weekly leaderboards for the artists they love.`,
      type: "profile",
    },
  };
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { handle } = await params;
  const session = await getSession();

  const profileUser = await getUserByHandle(handle);
  if (!profileUser) notFound();

  const profile = await getUserProfile(profileUser.id);
  if (!profile) notFound();

  const week = await getUserTotals(profileUser.id, "week");

  const user = profile.user;
  const topStreak = profile.streaks[0] ?? null;
  const badgeTotal = 8;
  const unlocked = new Set(profile.badges.map((badge) => badge.id)).size;

  const stats: ProfileStat[] = [
    {
      label: "Points this week",
      value: week.points,
      format: "points",
      hint: `${formatPoints(week.plays)} scored plays`,
      tone: "lime",
    },
    {
      label: "Minutes this week",
      value: week.minutes,
      format: "minutes",
      hint: "8 minute cap per track",
      tone: "peri",
    },
    {
      label: "Artists this year",
      value: profile.totals.artists,
      format: "points",
      hint: "Distinct artists with scored plays",
      tone: "fg",
    },
    {
      label: "Longest active streak",
      value: topStreak ? topStreak.current : 0,
      format: "days",
      hint: topStreak
        ? `${topStreak.artistName} · best ${topStreak.longest}`
        : "No streak burning yet",
      tone: "gold",
    },
  ];

  const isMe = session?.id === user.id;

  return (
    <div className="flex flex-col gap-8 py-2 sm:py-4">
      <style>{PAGE_MOTION}</style>

      <section aria-label="Fan identity" className="scroll-mt-24 space-y-4">
        <ProfileHero
          name={user.name}
          handle={user.handle}
          avatarUrl={user.avatarUrl}
          isDemo={user.isDemo}
          badgesUnlocked={unlocked}
          badgeTotal={badgeTotal}
        />
      </section>

      <section aria-label="Season totals" className="scroll-mt-24 space-y-4">
        <SectionHeader
          eyebrow="Vitals"
          title="Standing at a glance"
          description={`All-time totals across ${profile.totals.artists} artists. Weekly board resets every Monday 00:00 UTC.`}
        />
        <ProfileStats stats={stats} />
      </section>

      {profile.topArtists.length > 0 ? (
        <section id="top-artists" aria-label="Top artists" className="scroll-mt-24 space-y-4">
          <SectionHeader
            eyebrow="Rotation"
            title="Where the points come from"
            description={`Top ${profile.topArtists.length} artists this month, ranked among that artist's fans.`}
            action={
              <Link href="/" className="btn btn-ghost">
                Explore all artists
              </Link>
            }
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {profile.topArtists.map((artist) => (
              <article
                key={artist.artistId}
                className="panel panel-hover relative overflow-hidden p-4"
              >
                <div className="relative flex items-center gap-3">
                  {artist.imageUrl ? (
                    <span className="relative shrink-0 rounded-[1rem] overflow-hidden border border-line h-16 w-16 bg-panel2">
                      <img
                        src={artist.imageUrl}
                        alt={artist.artistName}
                        width={64}
                        height={64}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    </span>
                  ) : (
                    <Avatar name={artist.artistName} size={64} ring />
                  )}
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/artist/${artist.artistId}`}
                      className="block truncate font-display text-sm font-semibold tracking-tight text-fg transition hover:text-lime"
                    >
                      {artist.artistName}
                    </Link>
                    <p className="mt-0.5 font-mono text-[0.55rem] uppercase tracking-[0.14em] text-muted">
                      {formatPoints(artist.points)} pts · {formatMinutes(artist.minutes)}
                    </p>
                  </div>
                  <span className={`shrink-0 num text-sm font-semibold ${rankTone(artist.rank)}`}>
                    {artist.rank ? `#${artist.rank}` : "—"}
                  </span>
                </div>
                {artist.rank !== null && artist.rank !== undefined ? (
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-line">
                    <div
                      className="h-full rounded-full bg-lime ultfave-bar"
                      style={{ width: `100%` }}
                    />
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : (
        <EmptyState
          title="No scores yet"
          description={`${user.name} hasn't scored any points on the boards yet. Sync listening and start climbing.`}
          action={
            <Link href="/" className="btn btn-ghost">
              Find an artist
            </Link>
          }
        />
      )}

      <section id="streaks" aria-label="Streaks" className="scroll-mt-24 space-y-4">
        <SectionHeader
          eyebrow="Fuse"
          title="Streak watch"
          description={`Consecutive days on the same artist for ${user.name}. Miss a day and the fuse goes out.`}
        />
        <StreakStrip streaks={profile.streaks} />
      </section>

      <section id="badges" aria-label="Badges" className="scroll-mt-24 space-y-4">
        <SectionHeader
          eyebrow="Badge vault"
          title="Hardware collected"
          description={`Eight badges, four tiers. ${unlocked} of ${badgeTotal} unlocked.`}
          action={
            <span className="chip">
              {unlocked} of {badgeTotal} unlocked
            </span>
          }
        />
        <BadgeGrid badges={profile.badges} />
      </section>

      {!isMe && (
        <section aria-label="Connect" className="scroll-mt-24 grid gap-3 sm:grid-cols-2">
          <Link
            href={`/artist/${profile.topArtists[0]?.artistId ?? ""}`}
            className="panel panel-hover group flex items-center justify-between gap-4 px-5 py-4"
          >
            <div className="min-w-0">
              <div className="font-display text-base font-semibold tracking-tight text-fg">
                Top artist
              </div>
              <div className="text-sm leading-snug text-muted">
                Their board is where {user.name} ranks — go see the competition.
              </div>
            </div>
            <span className="flex shrink-0 items-center gap-1.5 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-lime">
              Open
              <svg
                viewBox="0 0 12 12"
                className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M2.5 6h7M6.5 3 9.5 6l-3 3" />
              </svg>
            </span>
          </Link>
        </section>
      )}
    </div>
  );
}
