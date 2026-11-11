import Link from "next/link";
import { redirect } from "next/navigation";

import BadgeGrid from "@/components/badge-grid";
import { ProfileHero, ProfileStats, type ProfileStat } from "@/components/profile-hero";
import StreakStrip from "@/components/streak-strip";
import { Avatar, EmptyState, SectionHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { BADGE_DEFS, getUserBadges } from "@/lib/badges";
import { formatMinutes, formatPoints } from "@/lib/period";
import { getUserProfile, getUserTotals } from "@/lib/queries";
import { getUserStreaks } from "@/lib/streaks";

type MeSearchParams = { [key: string]: string | string[] | undefined };

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function rankTone(rank: number | null): string {
  if (rank === 1) return "text-gold";
  if (rank === 2) return "text-peri";
  if (rank === 3) return "text-magenta";
  return "text-muted";
}

/** Page-scoped keyframes: bars grow on first paint, no JS required. */
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

export default async function MePage({ searchParams }: { searchParams: Promise<MeSearchParams> }) {
  const session = await requireUser();
  const profile = await getUserProfile(session.id);
  if (!profile) redirect("/login");

  const params = await searchParams;
  const welcome = firstParam(params.welcome);

  const [week, badges, streaks] = await Promise.all([
    getUserTotals(session.id, "week"),
    getUserBadges(session.id),
    getUserStreaks(session.id, 6),
  ]);

  const user = profile.user;
  const topStreak = streaks[0] ?? null;
  const badgeTotal = BADGE_DEFS.length;
  // A badge can be earned on several artists; the vault count is unique badges.
  const unlocked = Math.min(badgeTotal, new Set(badges.map((badge) => badge.id)).size);
  const peakPoints = profile.topArtists.reduce((max, artist) => Math.max(max, artist.points), 0);
  const peakBar = Math.max(1, peakPoints);

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

  return (
    <div className="flex flex-col gap-8 py-2 sm:py-4">
      <style>{PAGE_MOTION}</style>

      <ProfileHero
        name={user.name}
        handle={user.handle}
        avatarUrl={user.avatarUrl}
        isDemo={user.isDemo}
        badgesUnlocked={unlocked}
        badgeTotal={badgeTotal}
      />

      {welcome === "1" ? (
        <div className="rise panel flex items-start gap-3 border-lime/40 px-4 py-3 text-sm leading-relaxed text-muted">
          <span
            aria-hidden="true"
            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-lime/40 bg-lime/10"
          >
            <svg
              viewBox="0 0 12 12"
              className="h-3 w-3 text-lime"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2.5 6.5 5 9l4.5-5.5" />
            </svg>
          </span>
          <span>
            <span className="font-semibold text-lime">Spotify connected.</span> Your first sync is
            running in the background — points, streaks and badges land within a few seconds. Hit
            Sync plays to pull the latest.
          </span>
        </div>
      ) : null}

      <section aria-label="Season totals">
        <ProfileStats stats={stats} />
      </section>

      {profile.totals.plays === 0 ? (
        <EmptyState
          title="Nothing scored yet"
          description="Your board is empty. Sync your Spotify history to import plays, or scout the artist leaderboards first and pick your fight."
          action={
            <>
              <Link href="/" className="btn btn-primary">
                Browse artists
              </Link>
              <Link href="/activity" className="btn btn-ghost">
                Live feed
              </Link>
            </>
          }
        />
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <section id="rotation" aria-label="Rotation" className="panel scroll-mt-24 overflow-hidden">
          <div className="border-b border-line px-4 py-4 sm:px-5">
            <SectionHeader
              eyebrow="This month"
              title="Your rotation"
              description="Where you stand among each artist's fans this month."
              action={
                <Link href="/" className="btn btn-ghost">
                  All artists
                </Link>
              }
            />
          </div>

          {profile.topArtists.length === 0 ? (
            <div className="p-4 sm:p-5">
              <EmptyState
                title="No rotation yet"
                description="Once you have scored plays, your three loudest artists for the month show up here with your live rank."
                action={
                  <Link href="/" className="btn btn-ghost">
                    Find an artist
                  </Link>
                }
              />
            </div>
          ) : (
            <>
              <ul className="divide-y divide-line">
                {profile.topArtists.map((artist, index) => {
                  const share = Math.round((artist.points / peakBar) * 100);
                  return (
                    <li
                      key={artist.artistId}
                      className="relative px-4 py-3.5 transition hover:bg-panel2/60 sm:px-5"
                    >
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/artist/${artist.artistId}`}
                          title={`Open the ${artist.artistName} board`}
                          className={`num w-6 shrink-0 text-right text-sm transition hover:text-lime ${rankTone(artist.rank)}`}
                        >
                          {index + 1}
                        </Link>
                        <Avatar name={artist.artistName} src={artist.imageUrl} size={36} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-3">
                            <Link
                              href={`/artist/${artist.artistId}`}
                              className="min-w-0 truncate font-display text-sm font-semibold tracking-tight text-fg transition hover:text-lime"
                            >
                              {artist.artistName}
                            </Link>
                            <span className="num shrink-0 text-sm font-semibold text-lime">
                              {formatPoints(artist.points)}
                            </span>
                          </div>

                          <div className="mt-2 flex items-center gap-3">
                            <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-line/50">
                              <span
                                className="ultfave-bar block h-full rounded-full"
                                style={{
                                  width: `${share}%`,
                                  animationDelay: `${index * 90}ms`,
                                  backgroundImage:
                                    "linear-gradient(90deg, rgba(255,82,54,0.35), #ff5236)",
                                  boxShadow: "0 0 12px -2px rgba(255,82,54,0.55)",
                                }}
                              />
                            </span>
                            <span className="shrink-0 whitespace-nowrap font-mono text-[0.55rem] uppercase tracking-[0.14em] text-muted">
                              {formatMinutes(artist.minutes)}
                            </span>
                          </div>

                          <div className="mt-1.5 flex items-center justify-between gap-3 font-mono text-[0.55rem] uppercase tracking-[0.14em]">
                            <span className="text-muted">this month</span>
                            <Link
                              href={`/artist/${artist.artistId}`}
                              className={`underline-offset-4 transition hover:text-lime hover:underline ${rankTone(artist.rank)}`}
                            >
                              {artist.rank ? `rank ${artist.rank}` : "unranked"}
                            </Link>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="border-t border-line px-4 py-2.5 font-mono text-[0.55rem] uppercase tracking-[0.16em] text-muted sm:px-5">
                Bars show your share of listening this month
              </div>
            </>
          )}
        </section>

        <section id="streaks" aria-label="Streaks" className="scroll-mt-24 space-y-4">
          <SectionHeader
            eyebrow="Fuse"
            title="Streak watch"
            description="Consecutive days on the same artist. Miss a day and the fuse goes out."
            action={
              <Link href="/activity" className="btn btn-ghost">
                Challenges
              </Link>
            }
          />
          <StreakStrip streaks={streaks} />
        </section>
      </div>

      <section id="badges" aria-label="Badges" className="scroll-mt-24 space-y-4">
        <SectionHeader
          eyebrow="Badge vault"
          title="Hardware collected"
          description="Eight badges, four tiers. Elite is reserved for the people who actually run the fandom."
          action={
            <span className="chip">
              {unlocked} of {badgeTotal} unlocked
            </span>
          }
        />
        <BadgeGrid badges={badges} />
      </section>

      <section aria-label="Next moves" className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/friends"
          className="panel panel-hover group flex items-center justify-between gap-4 px-5 py-4"
        >
          <div className="min-w-0">
            <div className="font-display text-base font-semibold tracking-tight text-fg">
              Rivalries
            </div>
            <div className="text-sm leading-snug text-muted">
              See who is edging you out week to week and who you just passed.
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
        <Link
          href="/activity"
          className="panel panel-hover group flex items-center justify-between gap-4 px-5 py-4"
        >
          <div className="min-w-0">
            <div className="font-display text-base font-semibold tracking-tight text-fg">
              Live feed
            </div>
            <div className="text-sm leading-snug text-muted">
              Milestones, overtakes and badge drops from across the fandom.
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
    </div>
  );
}
