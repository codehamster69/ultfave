import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArtistHero, type ArtistStandingSummary } from "@/components/artist-hero";
import { FanCardShare } from "@/components/fan-card-share";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { PeriodTabs } from "@/components/period-tabs";
import { SyncButton } from "@/components/sync-button";
import { Avatar, Delta, EmptyState, SectionHeader, StatCard } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { getActiveChallenges } from "@/lib/challenges";
import { PERIOD_LABEL, formatPoints, isPeriod } from "@/lib/period";
import { getArtist, getArtistLeaderboard, getUserArtistStanding } from "@/lib/queries";
import type { Challenge, LeaderboardRow, Period } from "@/lib/types";

type ArtistPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: ArtistPageProps): Promise<Metadata> {
  const { id } = await params;
  const artist = await getArtist(id);
  if (!artist) return { title: "Artist not found — Ultfave" };
  return {
    title: `${artist.name} fan leaderboard — Ultfave`,
    description: `Who really runs the ${artist.name} fandom? Weekly, monthly and yearly fan rankings.`,
  };
}

function metricLabel(metric: Challenge["metric"]): string {
  if (metric === "minutes") return "minutes";
  if (metric === "plays") return "plays";
  return "distinct tracks";
}

export default async function ArtistPage({ params, searchParams }: ArtistPageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const periodParam = typeof sp.period === "string" ? sp.period : null;
  const period: Period = isPeriod(periodParam) ? periodParam : "week";

  const artist = await getArtist(id);
  if (!artist) notFound();

  const session = await getSession();
  const viewerId = session?.id ?? null;

  const rowsPromise: Promise<LeaderboardRow[]> = getArtistLeaderboard(
    artist.id,
    period,
    viewerId,
    50,
  );
  const standingPromise: Promise<ArtistStandingSummary> = viewerId
    ? getUserArtistStanding(viewerId, artist.id, period)
    : Promise.resolve(null);
  const challengesPromise: Promise<Challenge[]> = getActiveChallenges(viewerId);

  const [rows, standing, allChallenges] = await Promise.all([
    rowsPromise,
    standingPromise,
    challengesPromise,
  ]);

  const fanCount = Math.max(rows.length, standing?.total ?? 0);
  const periodPoints = rows.reduce((sum, row) => sum + row.points, 0);
  const topFan = rows[0] ?? null;
  const myRow = viewerId ? rows.find((row) => row.userId === viewerId) ?? null : null;
  const myIndex = myRow ? rows.findIndex((row) => row.userId === viewerId) : -1;
  const rival = myRow && myRow.rank > 1 ? rows.find((row) => row.rank === myRow.rank - 1) ?? null : null;
  const borderRow = !rival && myRow && myIndex > 0 ? rows[myIndex - 1] : null;
  const gapToRival = myRow && rival ? Math.max(0, rival.points - myRow.points) : 0;
  const gapToBorder = myRow && borderRow ? Math.max(0, borderRow.points - myRow.points) : 0;
  const myPoints = standing?.points ?? myRow?.points ?? 0;
  const totalFans = standing?.total ?? fanCount;
  const rankDelta = standing && standing.prevRank !== null ? standing.prevRank - standing.rank : null;
  const challenges = allChallenges
    .filter((challenge) => challenge.artistId === null || challenge.artistId === artist.id)
    .slice(0, 3);

  return (
    <div className="pb-6">
      <nav
        aria-label="Breadcrumb"
        className="mb-4 flex items-center justify-between gap-3"
      >
        <ol className="flex min-w-0 items-center gap-2 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted">
          <li className="shrink-0">
            <Link href="/" className="transition-colors hover:text-fg">
              &larr; All artists
            </Link>
          </li>
          <li aria-hidden="true" className="text-line">
            /
          </li>
          <li aria-current="page" className="truncate text-fg/70">
            {artist.name}
          </li>
        </ol>
        <span className="chip shrink-0">{PERIOD_LABEL[period]}</span>
      </nav>

      <ArtistHero artist={artist} standing={standing} period={period} />

      {/* Sticky summary: sits right after the hero, pins under the site nav.
          In flow (never fixed), so it adds no layout shift and never rides over
          the content on mobile. */}
      <div className="sticky top-14 z-30 mt-4 h-[3.25rem] sm:top-16">
        <div className="flex h-full items-center justify-between gap-2 rounded-2xl border border-line/70 bg-ink/85 px-2 shadow-[0_18px_40px_-30px_rgba(0,0,0,0.95)] backdrop-blur-xl">
          <div className="min-w-0">
            <PeriodTabs period={period} basePath={`/artist/${artist.id}`} />
          </div>
          <div className="flex shrink-0 items-center gap-2 pr-0.5">
            <span className="hidden font-mono text-[0.55rem] uppercase tracking-[0.18em] text-muted sm:inline">
              Your rank
            </span>
            <span
              className={`num text-sm font-semibold ${standing ? "text-lime" : "text-muted"}`}
            >
              {standing ? `#${standing.rank}` : "—"}
            </span>
            <span className="hidden font-mono text-[0.6rem] text-muted min-[430px]:inline">
              / {formatPoints(totalFans)}
            </span>
            <span className="inline-flex items-center rounded-full border border-line/70 bg-panel/70 px-1.5 py-0.5">
              {standing ? (
                <Delta value={rankDelta} />
              ) : (
                <span className="num text-[0.65rem] text-muted" aria-hidden="true">
                  &ndash;
                </span>
              )}
            </span>
          </div>
        </div>
      </div>

      <section
        id="standing"
        className="relative mt-4 scroll-mt-32 overflow-hidden rounded-[1.4rem] border border-white/10 bg-white/[0.035] p-5 backdrop-blur-xl sm:p-6"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-28 h-64 w-64 rounded-full bg-lime/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
        />

        {session ? (
          <div className="relative">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-muted">
                  Your standing
                </p>
                <h2 className="mt-1.5 font-display text-2xl tracking-tight text-fg">
                  {myRow
                    ? `#${myRow.rank} of ${formatPoints(totalFans)} fans`
                    : "You are not on this board yet"}
                </h2>
              </div>
              <span className="chip">{PERIOD_LABEL[period]}</span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <p className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted">Rank</p>
                <p className="num mt-1 text-3xl font-semibold text-lime sm:text-4xl">
                  {standing ? `#${standing.rank}` : "—"}
                </p>
              </div>
              <div>
                <p className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted">
                  Points
                </p>
                <p className="num mt-1 text-3xl font-semibold text-fg sm:text-4xl">
                  {formatPoints(myPoints)}
                </p>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <p className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted">
                  Movement
                </p>
                <div className="mt-2 flex items-center gap-2">
                  {standing ? (
                    <Delta value={rankDelta} />
                  ) : (
                    <span className="num text-sm text-muted">—</span>
                  )}
                  <span className="text-xs text-muted">
                    {standing
                      ? standing.prevRank === null
                        ? "first period ranked"
                        : "vs last period"
                      : "sync or listen to enter"}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-stretch gap-3">
              <SyncButton label="Sync plays" />
              <FanCardShare
                artistId={artist.id}
                artistName={artist.name}
                period={period}
                rank={standing?.rank ?? null}
                points={myPoints}
              />
            </div>

            {myRow ? null : noPointsHint(artist.name, period)}
          </div>
        ) : (
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-muted">
                Watching from the stands
              </p>
              <h2 className="mt-1.5 font-display text-2xl tracking-tight text-fg">
                Join the board to see your rank
              </h2>
              <p className="mt-2 max-w-xl text-sm text-muted">
                Sign in with Spotify or enter as a demo fan to earn points, build streaks and
                challenge the fans above you.
              </p>
            </div>
            <Link href="/login" className="btn btn-primary shrink-0">
              Join the board
            </Link>
          </div>
        )}
      </section>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Fans on this board"
          value={formatPoints(fanCount)}
          hint={`ranked ${PERIOD_LABEL[period].toLowerCase()}`}
          tone="lime"
        />
        <StatCard
          label="Points this period"
          value={formatPoints(periodPoints)}
          hint={`logged by ${formatPoints(rows.length)} listed fans`}
          tone="fg"
        />
        <StatCard
          label="Top fan"
          value={topFan ? topFan.name : "—"}
          hint={
            topFan
              ? `@${topFan.handle} · ${formatPoints(topFan.points)} pts`
              : "nobody has scored yet"
          }
          tone="gold"
        />
      </div>

      {session && myRow ? (
        <section
          aria-label="Next rival"
          className="mt-3 rounded-[1.4rem] border border-line/80 bg-panel/60 p-4 backdrop-blur-sm sm:p-5"
        >
          {myRow.rank === 1 ? (
            <div className="flex flex-wrap items-center gap-4">
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-lime/30 bg-lime/[0.07] font-mono text-[0.6rem] uppercase tracking-[0.1em] text-lime"
              >
                01
              </span>
              <div className="min-w-0">
                <p className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-lime">
                  Nobody above you
                </p>
                <p className="mt-1 text-sm text-fg">
                  You lead the {artist.name} board {PERIOD_LABEL[period].toLowerCase()}. Sync again
                  to defend it.
                </p>
              </div>
            </div>
          ) : rival ? (
            <div className="flex flex-wrap items-center gap-3">
              <Avatar name={rival.name} src={rival.avatarUrl} size={36} />
              <div className="min-w-0">
                <p className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted">
                  Next rival above you
                </p>
                <p className="truncate text-sm text-fg">
                  <span className="font-semibold">{rival.name}</span>{" "}
                  <span className="text-muted">@{rival.handle}</span>
                </p>
              </div>
              <p className="num ml-auto text-sm text-fg">
                {gapToRival > 0 ? (
                  <>
                    <span className="text-lime">+{formatPoints(gapToRival)}</span>{" "}
                    <span className="font-sans text-xs text-muted">pts to pass</span>
                  </>
                ) : (
                  <span className="font-sans text-xs text-muted">
                    level on points · win on minutes
                  </span>
                )}
              </p>
            </div>
          ) : borderRow ? (
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0">
                <p className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted">
                  Break into the listed pack
                </p>
                <p className="mt-0.5 text-sm text-fg">
                  You are #{myRow.rank}. {borderRow.name} holds the last listed spot at{" "}
                  <span className="num">{formatPoints(borderRow.points)}</span> pts.
                </p>
              </div>
              <p className="num ml-auto text-sm text-fg">
                <span className="text-lime">+{formatPoints(gapToBorder)}</span>{" "}
                <span className="font-sans text-xs text-muted">pts away</span>
              </p>
            </div>
          ) : (
            <div>
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted">
                Climbing
              </p>
              <p className="mt-1 text-sm text-fg">
                You are #{myRow.rank} on this board. Keep syncing to close the gap.
              </p>
            </div>
          )}
        </section>
      ) : null}

      <section id="leaderboard" className="mt-10 scroll-mt-32">
        <SectionHeader
          eyebrow="The board"
          title={`${artist.name} leaderboard`}
          description={`Every fan ranked by points ${PERIOD_LABEL[period].toLowerCase()}. Deltas compare with the previous period.`}
        />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="hidden sm:block">
            <PeriodTabs period={period} basePath={`/artist/${artist.id}`} />
          </div>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted">
            {rows.length > 0 ? `${rows.length} fans listed` : "board is empty"}
          </p>
        </div>
        <div className="mt-4">
          {rows.length > 0 ? (
            <LeaderboardTable
              rows={rows}
              meId={viewerId}
              artistId={artist.id}
              period={period}
            />
          ) : (
            <div className="panel p-6">
              <EmptyState
                title="No points on this board yet"
                description={`Nobody has logged a listen for ${artist.name} in this period. Sync your plays and take rank #1 before anyone else.`}
              />
            </div>
          )}
        </div>
      </section>

      <section id="challenges" className="mt-10 scroll-mt-32">
        <SectionHeader
          eyebrow="Open objectives"
          title="Challenges running now"
          description="Beat the target before the window closes to bank bonus points."
          action={
            <Link href="/activity" className="btn btn-ghost">
              All challenges
            </Link>
          }
        />

        {challenges.length > 0 ? (
          <ul className="mt-4 grid gap-3 md:grid-cols-3">
            {challenges.map((challenge) => {
              const pct =
                challenge.target > 0
                  ? Math.min(100, Math.round((challenge.progress / challenge.target) * 100))
                  : 0;
              return (
                <li key={challenge.id} className="panel panel-hover relative overflow-hidden p-4">
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-lime/40 to-transparent"
                  />
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-display text-base leading-snug tracking-tight text-fg">
                      {challenge.title}
                    </p>
                    <span className="num shrink-0 text-sm text-lime">
                      +{formatPoints(challenge.bonusPoints)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {challenge.artistName ?? "Any artist"} · {metricLabel(challenge.metric)}
                  </p>
                  <div
                    className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-line"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={pct}
                    aria-label={`${challenge.title} progress`}
                  >
                    <div className="h-full rounded-full bg-lime" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="num mt-2 text-[0.7rem] text-muted">
                    {formatPoints(challenge.progress)} / {formatPoints(challenge.target)}{" "}
                    {metricLabel(challenge.metric)}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {challenge.completed ? (
                      <span className="chip">
                        <span className="text-lime">completed</span>
                      </span>
                    ) : null}
                    {challenge.joined ? <span className="chip">joined</span> : null}
                    <span className="chip">{challenge.participants} fans in</span>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="panel mt-4 p-6">
            <EmptyState
              title="No active challenges"
              description="New objectives drop every Monday. Check the activity page for fresh targets."
            />
          </div>
        )}

        <div className="mt-3 flex justify-end">
          <Link
            href="/activity"
            className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted transition-colors hover:text-lime"
          >
            All challenges &rarr;
          </Link>
        </div>
      </section>
    </div>
  );
}

function noPointsHint(artistName: string, period: Period) {
  return (
    <div className="mt-5 rounded-xl border border-line bg-ink/50 p-4">
      <p className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted">
        Get on the board
      </p>
      <p className="mt-1 text-sm text-fg">
        No points for {artistName} {PERIOD_LABEL[period].toLowerCase()} yet. Hit sync after a few
        tracks and you will appear here instantly.
      </p>
    </div>
  );
}
