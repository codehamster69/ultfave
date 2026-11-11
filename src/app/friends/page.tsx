import Link from "next/link";
import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth";
import { all, get } from "@/lib/db";
import { getArtistLeaderboard, getFriendsLeaderboard } from "@/lib/queries";
import { getRivalries } from "@/lib/friends";
import { formatMinutes, formatPoints, isPeriod, PERIOD_LABEL, periodRange } from "@/lib/period";
import type { LeaderboardRow, Period } from "@/lib/types";
import { Avatar, Delta, EmptyState, SectionHeader } from "@/components/ui";
import { PeriodTabs } from "@/components/period-tabs";
import { FollowButton, RivalryList } from "@/components/rivalry-list";

type FriendsSearchParams = { [key: string]: string | string[] | undefined };

/**
 * Page-scoped keyframes for the leaderboard bars. Kept out of globals.css (owned
 * by another agent) and rendered server-side, so the bars are already at their
 * final width for no-JS visitors; the reduced-motion reset in globals.css
 * flattens the animation duration for people who ask for it.
 */
const BOARD_CSS = `
@keyframes fr-board-fill {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}
.fr-board-fill {
  transform-origin: left center;
  animation: fr-board-fill 820ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
`;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function rankTone(rank: number): string {
  if (rank === 1) return "text-gold";
  if (rank === 2) return "text-peri";
  if (rank === 3) return "text-magenta";
  return "text-muted";
}

function barTone(row: LeaderboardRow): string {
  if (row.isMe) return "bg-lime";
  if (row.rank === 1) return "bg-gold/75";
  if (row.rank === 2) return "bg-fg/45";
  if (row.rank === 3) return "bg-magenta/60";
  return "bg-peri/45";
}

function scopeTabClass(active: boolean): string {
  const base =
    "rounded-full border px-3 py-1 font-mono text-[0.58rem] uppercase tracking-[0.14em] transition";
  return active
    ? `${base} border-lime/60 bg-lime/10 text-lime`
    : `${base} border-line text-muted hover:border-fg/30 hover:text-fg`;
}

function StatTile({
  label,
  value,
  hint,
  tone = "text-fg",
}: {
  label: string;
  value: ReactNode;
  hint: ReactNode;
  tone?: string;
}) {
  return (
    <div className="bg-panel px-3.5 py-3">
      <dt className="font-mono text-[0.52rem] uppercase tracking-[0.18em] text-muted">{label}</dt>
      <dd className={`num mt-1 text-lg font-semibold leading-none ${tone}`}>{value}</dd>
      <dd className="mt-1 truncate text-[0.62rem] leading-snug text-muted">{hint}</dd>
    </div>
  );
}

function BoardRow({
  row,
  leaderPoints,
  index,
}: {
  row: LeaderboardRow;
  leaderPoints: number;
  index: number;
}) {
  const pct = leaderPoints > 0 ? Math.max(2, Math.round((row.points / leaderPoints) * 100)) : 0;
  const moved = row.delta !== null && row.delta !== 0;

  return (
    <li
      className={`relative px-3.5 py-3 transition-colors sm:px-4 ${
        row.isMe ? "bg-lime/[0.05]" : "hover:bg-panel2/50"
      }`}
    >
      <div className="flex items-start gap-2.5 sm:gap-3">
        <span
          className={`num mt-0.5 w-6 shrink-0 text-right text-sm font-semibold ${rankTone(row.rank)}`}
        >
          {row.rank}
        </span>
        <span className="mt-0.5 w-5 shrink-0">
          <Delta value={row.delta} />
        </span>
        <Avatar name={row.name} src={row.avatarUrl} size={36} ring={row.isMe} />

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-sm font-semibold text-fg">{row.name}</span>
            {row.isMe ? (
              <span className="shrink-0 rounded-full border border-lime/40 bg-lime/10 px-1.5 py-0.5 font-mono text-[0.5rem] uppercase tracking-[0.14em] text-lime">
                you
              </span>
            ) : null}
            <span
              className={`num ml-auto shrink-0 text-sm font-semibold ${
                row.isMe ? "text-lime" : "text-fg"
              }`}
            >
              {formatPoints(row.points)}
            </span>
          </div>

          <div className="mt-1.5 flex items-center gap-2">
            <div
              className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-panel2"
              role="img"
              aria-label={`${row.name} at ${pct} percent of the leader's points`}
            >
              <span
                className={`fr-board-fill absolute inset-y-0 left-0 rounded-full ${barTone(row)}`}
                style={{
                  width: `${pct}%`,
                  animationDelay: `${Math.min(index, 10) * 55}ms`,
                }}
              />
            </div>
            <span className="num w-8 shrink-0 text-right font-mono text-[0.52rem] text-muted">
              {pct}%
            </span>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-mono text-[0.52rem] uppercase tracking-[0.12em] text-muted">
            <span className="max-w-[8rem] truncate">@{row.handle}</span>
            <span aria-hidden="true">·</span>
            <span>{formatMinutes(row.minutes)}</span>
            <span className="hidden sm:inline" aria-hidden="true">
              ·
            </span>
            <span className="hidden sm:inline">{formatPoints(row.plays)} plays</span>
            <span className="hidden sm:inline" aria-hidden="true">
              ·
            </span>
            <span className="hidden sm:inline">
              {moved && row.prevRank !== null ? `from #${row.prevRank}` : "holding"}
            </span>
          </div>
        </div>
      </div>
    </li>
  );
}

function MiniBar({
  label,
  pct,
  tone,
  delay,
}: {
  label: string;
  pct: number;
  tone: string;
  delay: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-7 shrink-0 font-mono text-[0.48rem] uppercase tracking-[0.12em] text-muted">
        {label}
      </span>
      <span className="relative h-1 flex-1 overflow-hidden rounded-full bg-panel2">
        <span
          className={`fr-board-fill absolute inset-y-0 left-0 rounded-full ${tone}`}
          style={{ width: `${Math.max(pct, 1)}%`, animationDelay: `${delay}ms` }}
        />
      </span>
    </div>
  );
}

type MarginRow = { label: string; value: string; tone?: string };

function MarginReport({ rows }: { rows: MarginRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="panel mt-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[0.52rem] uppercase tracking-[0.2em] text-muted">
          Margin report
        </span>
        <span className="font-mono text-[0.5rem] uppercase tracking-[0.14em] text-muted">
          this period
        </span>
      </div>
      <dl className="mt-2 divide-y divide-line/70">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3 py-2">
            <dt className="shrink-0 font-mono text-[0.52rem] uppercase tracking-[0.14em] text-muted">
              {row.label}
            </dt>
            <dd
              className={`num min-w-0 truncate text-right text-[0.76rem] font-semibold ${
                row.tone ?? "text-fg"
              }`}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function SuggestionCard({ row, myPoints }: { row: LeaderboardRow; myPoints: number }) {
  const max = Math.max(row.points, myPoints, 1);
  const youPct = Math.round((myPoints / max) * 100);
  const themPct = Math.round((row.points / max) * 100);
  const gap = myPoints - row.points;

  return (
    <article className="panel panel-hover flex flex-col gap-3 p-3.5">
      <div className="flex items-center gap-2.5">
        <span className={`num w-5 shrink-0 text-right text-sm font-semibold ${rankTone(row.rank)}`}>
          {row.rank}
        </span>
        <Avatar name={row.name} src={row.avatarUrl} size={36} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-fg">{row.name}</div>
          <div className="truncate font-mono text-[0.52rem] uppercase tracking-[0.12em] text-muted">
            @{row.handle}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="num text-sm font-semibold text-lime">{formatPoints(row.points)}</div>
          <div className="font-mono text-[0.5rem] uppercase tracking-[0.1em] text-muted">
            {formatMinutes(row.minutes)}
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <MiniBar label="you" pct={youPct} tone="bg-lime/80" delay={40} />
        <MiniBar label="them" pct={themPct} tone="bg-peri/60" delay={90} />
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-line/60 pt-2.5">
        <span
          className={`font-mono text-[0.5rem] uppercase tracking-[0.12em] ${
            gap > 0 ? "text-lime" : gap < 0 ? "text-magenta" : "text-muted"
          }`}
        >
          {gap === 0
            ? "level on points"
            : gap > 0
              ? `you lead by ${formatPoints(gap)}`
              : `behind by ${formatPoints(Math.abs(gap))}`}
        </span>
        <FollowButton userId={row.userId} initialFollowing={false} className="shrink-0" />
      </div>
    </article>
  );
}

export default async function FriendsPage({
  searchParams,
}: {
  searchParams: Promise<FriendsSearchParams>;
}) {
  const user = await requireUser();
  const sp = await searchParams;

  const periodParam = firstParam(sp.period);
  const period: Period = isPeriod(periodParam) ? periodParam : "week";
  const scope = firstParam(sp.scope) === "top" ? "top" : "all";
  const range = periodRange(period);

  const bestArtist = await get<{ artistId: string; artistName: string; points: number }>(
    `SELECT ds.artist_id AS "artistId", ar.name AS "artistName", SUM(ds.points) AS "points"
       FROM daily_scores ds
       JOIN artists ar ON ar.id = ds.artist_id
      WHERE ds.user_id = ? AND ds.day >= ? AND ds.day <= ?
      GROUP BY ds.artist_id, ar.name
      ORDER BY "points" DESC
      LIMIT 1`,
    [user.id, range.start, range.end],
  );

  const followeeRows = await all<{ id: string }>(
    `SELECT f.followee_id AS "id"
       FROM follows f
       JOIN users u ON u.id = f.followee_id
      WHERE f.follower_id = ?
      ORDER BY u.display_name ASC`,
    [user.id],
  );
  const followeeIds = new Set(followeeRows.map((row) => row.id));

  const artistFilter = scope === "top" && bestArtist ? bestArtist.artistId : null;
  const effectiveScope = artistFilter ? "top" : "all";

  const [boardRows, rivalries] = await Promise.all([
    getFriendsLeaderboard(user.id, artistFilter, period, 50),
    getRivalries(user.id, period),
  ]);

  const myRow = boardRows.find((row) => row.isMe || row.userId === user.id) ?? null;
  const friendRows = boardRows.filter((row) => row.userId !== user.id);

  const suggestions = bestArtist
    ? (await getArtistLeaderboard(bestArtist.artistId, period, user.id, 40))
        .filter((row) => row.userId !== user.id && !followeeIds.has(row.userId))
        .slice(0, 5)
    : [];

  const boardScopeLabel =
    artistFilter && bestArtist ? bestArtist.artistName : `all artists · ${PERIOD_LABEL[period].toLowerCase()}`;

  const leaderPoints = boardRows.reduce((max, row) => Math.max(max, row.points), 0);
  const duelsLed = rivalries.filter((rivalry) => rivalry.diff > 0).length;

  // Comparisons for the scouting cards stay artist-scoped: my points on the same
  // artist the suggestions are drawn from, not my all-artist board total.
  const suggestionScopePoints = bestArtist?.points ?? 0;

  const leader = boardRows[0] ?? null;
  const closestDuel =
    rivalries.length > 0
      ? rivalries.reduce((closest, rivalry) =>
          Math.abs(rivalry.diff) < Math.abs(closest.diff) ? rivalry : closest,
        )
      : null;
  const biggestLead =
    rivalries.filter((rivalry) => rivalry.diff > 0).sort((a, b) => b.diff - a.diff)[0] ?? null;
  const biggestDeficit =
    rivalries.filter((rivalry) => rivalry.diff < 0).sort((a, b) => a.diff - b.diff)[0] ?? null;
  const climbers = boardRows.filter((row) => (row.delta ?? 0) > 0).length;
  const sliders = boardRows.filter((row) => (row.delta ?? 0) < 0).length;

  const marginCandidates: (MarginRow | null)[] = [
    leader && myRow && leader.userId === user.id
      ? { label: "Gap to #1", value: "you set the pace", tone: "text-lime" }
      : leader && myRow
        ? {
            label: "Gap to #1",
            value: `${formatPoints(Math.max(0, leader.points - myRow.points))} pts`,
            tone: "text-fg",
          }
        : null,
    closestDuel
      ? {
          label: "Closest duel",
          value: `${closestDuel.name} · ${formatPoints(Math.abs(closestDuel.diff))}`,
          tone: "text-fg",
        }
      : null,
    biggestLead
      ? {
          label: "Biggest lead",
          value: `${biggestLead.name} · ${formatPoints(biggestLead.diff)}`,
          tone: "text-lime",
        }
      : null,
    biggestDeficit
      ? {
          label: "Biggest deficit",
          value: `${biggestDeficit.name} · ${formatPoints(Math.abs(biggestDeficit.diff))}`,
          tone: "text-magenta",
        }
      : null,
    boardRows.length > 0
      ? { label: "Movement", value: `${climbers} up · ${sliders} down`, tone: "text-muted" }
      : null,
  ];
  const marginRows = marginCandidates.filter((row): row is MarginRow => row !== null);

  return (
    <div className="space-y-10 pb-4">
      <style>{BOARD_CSS}</style>

      <header className="border-b border-line pb-5">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <div className="font-mono text-[0.62rem] uppercase tracking-[0.24em] text-lime">
              Friends &amp; rivalries
            </div>
            <h1 className="mt-2 font-display text-4xl font-semibold leading-[0.95] tracking-tight text-fg sm:text-5xl">
              WHO IS CHASING YOU?
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
              {user.name}, this is your circle for {PERIOD_LABEL[period].toLowerCase()} — the friends
              board, the head-to-heads on your shared artists, and the fans worth following next.
            </p>
          </div>
          <PeriodTabs
            period={period}
            basePath="/friends"
            query={effectiveScope === "top" ? { scope: "top" } : undefined}
          />
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-4">
          <StatTile
            label="Following"
            value={followeeRows.length}
            hint={
              followeeRows.length === 0 ? "nobody yet — scout below" : "fans in your circle"
            }
          />
          <StatTile
            label="On this board"
            value={friendRows.length}
            hint={boardScopeLabel}
            tone="text-peri"
          />
          <StatTile
            label="Your points"
            value={myRow ? formatPoints(myRow.points) : "—"}
            hint={myRow ? `rank #${myRow.rank} · ${formatMinutes(myRow.minutes)}` : "no points yet this period"}
            tone="text-lime"
          />
          <StatTile
            label="Duels led"
            value={`${duelsLed}${rivalries.length > 0 ? `/${rivalries.length}` : ""}`}
            hint={
              rivalries.length === 0
                ? "follow a fan to start one"
                : duelsLed === rivalries.length
                  ? "clean sweep this period"
                  : "head-to-heads this period"
            }
            tone={duelsLed > 0 ? "text-gold" : "text-fg"}
          />
        </dl>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1.45fr_1fr] lg:gap-8">
        <section aria-labelledby="friends-board-heading" className="min-w-0">
          <SectionHeader
            id="friends-board-heading"
            eyebrow="The board"
            title="Friends leaderboard"
            description={
              friendRows.length > 0
                ? `${friendRows.length} friend${friendRows.length === 1 ? "" : "s"} ranked on ${boardScopeLabel}. Bars show share of the leader's points.`
                : "Friends you follow show up here with their points, minutes and rank movement."
            }
            action={
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/friends?period=${period}`}
                  className={scopeTabClass(effectiveScope === "all")}
                  aria-current={effectiveScope === "all" ? "page" : undefined}
                >
                  All artists
                </Link>
                {bestArtist ? (
                  <Link
                    href={`/friends?period=${period}&scope=top`}
                    className={scopeTabClass(effectiveScope === "top")}
                    aria-current={effectiveScope === "top" ? "page" : undefined}
                  >
                    Your top artist
                  </Link>
                ) : null}
              </div>
            }
          />

          <div className="panel mt-4 overflow-hidden">
            {boardRows.length === 0 ? (
              followeeRows.length === 0 ? (
                <EmptyState
                  title="Your friends board is empty"
                  description="Follow a fan and their points land next to yours here — weekly, monthly, yearly."
                  action={
                    <Link href="#find-rivals" className="btn btn-primary">
                      Find rivals
                    </Link>
                  }
                  className="mx-3 my-3"
                />
              ) : (
                <EmptyState
                  title="No points on this board yet"
                  description={`Nobody in your circle logged points for ${boardScopeLabel}. Play something, or switch the board back to all artists.`}
                  action={
                    <Link href={`/friends?period=${period}`} className="btn btn-ghost">
                      All artists
                    </Link>
                  }
                  className="mx-3 my-3"
                />
              )
            ) : (
              <>
                <div className="flex items-center justify-between gap-3 border-b border-line px-3.5 py-2 sm:px-4">
                  <span className="font-mono text-[0.5rem] uppercase tracking-[0.2em] text-muted">
                    position · fan
                  </span>
                  <span className="font-mono text-[0.5rem] uppercase tracking-[0.16em] text-muted">
                    points · share
                  </span>
                </div>
                <ul className="divide-y divide-line">
                  {boardRows.map((row, index) => (
                    <BoardRow
                      key={row.userId}
                      row={row}
                      leaderPoints={leaderPoints}
                      index={index}
                    />
                  ))}
                </ul>
              </>
            )}
          </div>

          {boardRows.length > 0 && friendRows.length === 0 ? (
            <p className="mt-3 text-xs leading-relaxed text-muted">
              Just you on this board so far.{" "}
              <Link href="#find-rivals" className="text-lime underline-offset-4 hover:underline">
                Scout a rival below
              </Link>{" "}
              to make it a race.
            </p>
          ) : null}

        </section>

        <section
          aria-labelledby="head-to-head-heading"
          className="min-w-0 lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:self-start"
        >
          <SectionHeader
            id="head-to-head-heading"
            eyebrow="Rivalry watch"
            title="Head to head"
            description="Your best shared artist with each friend this period. Biggest gaps first."
          />
          <div className="mt-4">
            <RivalryList
              rivalries={rivalries}
              viewerName={user.name}
              viewerAvatarUrl={user.avatarUrl}
            />
          </div>
          <MarginReport rows={marginRows} />
        </section>

        <section
          id="find-rivals"
          aria-labelledby="find-rivals-heading"
          className="scroll-mt-24 lg:col-start-1 lg:row-start-2"
        >
          <SectionHeader
            id="find-rivals-heading"
            eyebrow="Scouting report"
            title="Find rivals"
            description={
              bestArtist
                ? `Top fans of ${bestArtist.artistName} for ${PERIOD_LABEL[period].toLowerCase()} — follow one and they join your board and head-to-heads.`
                : "Log a few listens and we will point you at the fans climbing your artists right now."
            }
            action={
              bestArtist ? (
                <Link
                  href={`/artist/${bestArtist.artistId}?period=${period}`}
                  className="font-mono text-[0.58rem] uppercase tracking-[0.16em] text-lime hover:underline"
                >
                  Full artist board
                </Link>
              ) : undefined
            }
          />

          <div className="mt-4">
            {suggestions.length === 0 ? (
              <EmptyState
                title="No rivals in range"
                description={
                  bestArtist
                    ? `Every top fan of ${bestArtist.artistName} is already on your board. Check the artist leaderboard for more names.`
                    : "You have no points this period, so there is nobody to measure against yet. Play something and check back."
                }
                action={
                  bestArtist ? (
                    <Link
                      href={`/artist/${bestArtist.artistId}?period=${period}`}
                      className="btn btn-primary"
                    >
                      Open {bestArtist.artistName}
                    </Link>
                  ) : undefined
                }
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {suggestions.map((row) => (
                  <SuggestionCard key={row.userId} row={row} myPoints={suggestionScopePoints} />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
