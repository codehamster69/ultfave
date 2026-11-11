import Link from "next/link";
import { get } from "@/lib/db";
import { getFeed } from "@/lib/activity";
import { getGlobalArtistLeaderboard } from "@/lib/queries";
import { PeriodTabs } from "@/components/period-tabs";
import { Avatar, Delta, EmptyState, SectionHeader } from "@/components/ui";
import { HeroThree } from "@/components/hero-three";
import { LiveTicker } from "@/components/live-ticker";
import { HeroStats } from "@/components/home/hero-stats";
import { ScrollProgress } from "@/components/home/scroll-progress";
import { Parallax, Reveal, RevealBar } from "@/components/home/reveal";
import { PERIOD_LABEL, formatPoints, isPeriod, periodRange, timeAgo } from "@/lib/period";
import type { ArtistLeaderboardRow, Period } from "@/lib/types";

const PODIUM: Record<
  number,
  { text: string; bar: string; bg: string; glow: string; barTone: "gold" | "peri" | "magenta" }
> = {
  1: {
    text: "text-gold",
    bar: "bg-gold",
    bg: "bg-gold/[0.05]",
    glow: "rgba(242,178,76,0.13)",
    barTone: "gold",
  },
  2: {
    text: "text-peri",
    bar: "bg-peri",
    bg: "bg-peri/[0.04]",
    glow: "rgba(147,167,255,0.12)",
    barTone: "peri",
  },
  3: {
    text: "text-magenta",
    bar: "bg-magenta",
    bg: "bg-magenta/[0.04]",
    glow: "rgba(242,65,124,0.12)",
    barTone: "magenta",
  },
};

const ROW_GRID =
  "grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 md:grid-cols-[3.25rem_minmax(0,1fr)_5rem_8.5rem_6rem] md:px-5";

const GENRE_FALLBACK = "genre unlisted";

function genresOf(row: ArtistLeaderboardRow): string {
  const genres = row.artist.genres ?? [];
  if (genres.length === 0) return GENRE_FALLBACK;
  return genres.slice(0, 2).join(" / ");
}

function BoardRow({
  row,
  leaderPoints,
  first,
}: {
  row: ArtistLeaderboardRow;
  leaderPoints: number;
  first: boolean;
}) {
  const accent = PODIUM[row.rank];
  const topFan = row.topFan;
  const share = leaderPoints > 0 ? row.points / leaderPoints : 0;

  return (
    <Link
      href={`/artist/${row.artist.id}`}
      className={`group relative border-line transition-colors duration-200 hover:bg-panel2/70 ${
        first ? "" : "border-t"
      } ${accent ? accent.bg : ""} ${ROW_GRID}`}
    >
      {accent ? (
        <span
          aria-hidden="true"
          className={`absolute inset-y-0 left-0 w-[2px] ${accent.bar} opacity-80`}
        />
      ) : null}

      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(420px 140px at 14% 50%, ${
            accent ? accent.glow : "rgba(255,82,54,0.07)"
          }, transparent 72%)`,
        }}
      />

      <div className="relative flex flex-col items-start">
        <span
          className={`num text-lg font-semibold leading-none ${
            accent ? accent.text : "text-muted"
          }`}
        >
          {row.rank}
        </span>
        <Reveal y={4} delay={0.12} className="mt-1">
          <Delta value={row.delta} />
        </Reveal>
      </div>

      <div className="relative flex min-w-0 items-center gap-3">
        <Avatar name={row.artist.name} src={row.artist.imageUrl} size={36} ring={row.rank === 1} />
        <div className="min-w-0">
          <div className="truncate font-display text-[0.98rem] font-semibold tracking-tight text-fg transition-colors group-hover:text-lime sm:text-base">
            {row.artist.name}
          </div>
          <div className="truncate font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted">
            {genresOf(row)}
          </div>
        </div>
      </div>

      <div className="relative hidden md:block">
        <div className="num text-sm text-fg">{formatPoints(row.fans)}</div>
        <div className="font-mono text-[0.58rem] uppercase tracking-[0.16em] text-muted">fans</div>
      </div>

      <div className="relative hidden min-w-0 items-center gap-2 md:flex">
        {topFan ? (
          <>
            <Avatar name={topFan.name} src={topFan.avatarUrl} size={28} />
            <span className="min-w-0">
              <span className="block truncate text-[0.78rem] leading-tight text-fg">
                {topFan.name}
              </span>
              <span className="block truncate font-mono text-[0.58rem] uppercase tracking-[0.12em] text-muted">
                @{topFan.handle}
              </span>
            </span>
          </>
        ) : (
          <span className="text-xs text-muted">unclaimed</span>
        )}
      </div>

      <div className="relative text-right">
        <div
          className={`num text-base font-semibold leading-none sm:text-xl ${
            row.rank === 1 ? "text-gold" : "text-lime"
          }`}
        >
          {formatPoints(row.points)}
        </div>
        <div className="mt-1 font-mono text-[0.58rem] uppercase tracking-[0.16em] text-muted">
          pts
        </div>
        <RevealBar
          ratio={share}
          tone={accent?.barTone ?? "lime"}
          delay={0.18}
          className="ml-auto mt-2 w-12 opacity-80 sm:w-16"
        />
      </div>
    </Link>
  );
}

const HOW_CARDS = [
  {
    index: "01",
    title: "Minutes listened",
    body: "One minute of play is one point. Tracks cap at eight minutes so a looping ambient opus cannot fake a lead.",
    foot: "minutes → points",
  },
  {
    index: "02",
    title: "Distinct tracks",
    body: "Up to twenty different tracks per artist per day pay 10 points each. Deep cuts beat a single-song loop.",
    foot: "10 pts / new track",
  },
  {
    index: "03",
    title: "Streaks & badges",
    body: "Show up on consecutive days to hold your streak, unlock badges and land in the inner circle of a fandom.",
    foot: "daily momentum",
  },
];

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const rawPeriod = typeof sp?.period === "string" ? sp.period : null;
  const period: Period = isPeriod(rawPeriod) ? rawPeriod : "week";

  const week = periodRange("week");

  const [fansRow, artistsRow, weekPointsRow, events, rows] = await Promise.all([
    get<{ fans: number }>(`SELECT COUNT(*) AS "fans" FROM users`),
    get<{ artists: number }>(`SELECT COUNT(*) AS "artists" FROM artists`),
    get<{ points: number }>(
      `SELECT COALESCE(SUM(points), 0) AS "points" FROM daily_scores WHERE day >= ? AND day <= ?`,
      [week.start, week.end],
    ),
    getFeed(null, "global", 8),
    getGlobalArtistLeaderboard(period, 20),
  ]);

  const fans = Number(fansRow?.fans ?? 0);
  const artists = Number(artistsRow?.artists ?? 0);
  const weekPoints = Number(weekPointsRow?.points ?? 0);

  // Relative times resolve on the server so the marquee hydrates exactly.
  const tickerEvents = events.map((event) => ({
    id: event.id,
    message: event.message,
    ago: timeAgo(event.createdAt),
  }));

  const leaderPoints = rows[0]?.points ?? 0;

  return (
    <div className="flex flex-col gap-10 sm:gap-12">
      <ScrollProgress />

      {/* HERO */}
      <section className="relative isolate overflow-hidden rounded-[1.6rem] border border-line bg-panel/60">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(247,237,227,0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(247,237,227,0.045) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
            maskImage: "radial-gradient(130% 100% at 20% 0%, #000 28%, transparent 76%)",
            WebkitMaskImage: "radial-gradient(130% 100% at 20% 0%, #000 28%, transparent 76%)",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 -top-32 h-72 w-72 rounded-full bg-lime/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-40 right-0 h-80 w-80 rounded-full bg-peri/10 blur-3xl"
        />

        <div className="relative grid items-center gap-6 px-5 pb-7 pt-9 sm:px-8 sm:pb-9 sm:pt-12 lg:grid-cols-[minmax(0,1.06fr)_minmax(0,0.94fr)] lg:gap-2 lg:pb-10 lg:pt-14">
          <Parallax depth={8} className="relative z-10 max-w-2xl">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-lime/40 bg-lime/[0.06] px-2.5 py-1 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-lime">
                <span className="live-dot h-1.5 w-1.5 rounded-full bg-lime" />
                Live fandom index
              </span>
              <span className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-muted">
                {PERIOD_LABEL[period]} · resets Monday 00:00 UTC
              </span>
            </div>

            <h1 className="mt-5 font-display text-[clamp(2.55rem,6.4vw,4.85rem)] font-semibold leading-[0.88] tracking-tight text-fg">
              WHO REALLY
              <br />
              RUNS THE{" "}
              <span className="relative inline-block bg-gradient-to-br from-lime via-lime to-peri bg-clip-text pr-1 text-transparent">
                FANDOM?
                <span
                  aria-hidden="true"
                  className="absolute -bottom-1 left-0 h-[2px] w-full bg-gradient-to-r from-lime via-lime/50 to-transparent"
                />
              </span>
            </h1>

            <p className="mt-5 max-w-xl text-[0.95rem] leading-relaxed text-muted sm:text-base">
              Every listen is a point. Every point is a rank. Ultfave turns your streaming history
              into a stadium scoreboard — minutes, crate depth and streaks decide who actually owns
              the discography.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="#artists"
                className="btn btn-primary group relative overflow-hidden pr-4 shadow-[0_18px_50px_-26px_rgba(255,82,54,0.9)] transition-transform duration-300 hover:-translate-y-0.5"
              >
                <span className="relative z-10">Explore artists</span>
                <svg
                  viewBox="0 0 12 12"
                  aria-hidden="true"
                  className="relative z-10 h-3 w-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 2v7M2.8 6.8 6 10l3.2-3.2" />
                </svg>
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-white/45 blur-md transition-transform duration-700 ease-out group-hover:translate-x-[420%]"
                />
              </Link>
              <Link
                href="/login"
                className="btn btn-ghost group relative overflow-hidden transition-colors hover:border-lime/40 hover:text-fg"
              >
                <span className="relative z-10">Enter as demo fan</span>
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-fg/10 blur-md transition-transform duration-700 ease-out group-hover:translate-x-[420%]"
                />
              </Link>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted">
              <span>{formatPoints(fans)} fans ranked</span>
              <span aria-hidden="true" className="hidden h-1 w-1 rounded-full bg-line sm:block" />
              <span>{formatPoints(artists)} fandoms live</span>
              <span aria-hidden="true" className="hidden h-1 w-1 rounded-full bg-line sm:block" />
              <span>no playlists required</span>
            </div>
          </Parallax>

          <div className="relative">
            <div className="relative h-[264px] sm:h-[336px] lg:h-[480px]">
              <HeroThree className="absolute inset-0" />
              <div className="pointer-events-none absolute inset-0 rounded-[1.2rem] bg-[radial-gradient(120%_100%_at_50%_50%,transparent_52%,rgba(21,10,18,0.55)_100%)]" />
              <div className="pointer-events-none absolute inset-x-2 bottom-1 flex items-center justify-between font-mono text-[0.52rem] uppercase tracking-[0.22em] text-muted/80">
                <span className="rounded-full border border-line/70 bg-ink/70 px-2 py-[3px] backdrop-blur-sm">
                  orbit · {PERIOD_LABEL[period]}
                </span>
                <span className="rounded-full border border-lime/20 bg-ink/70 px-2 py-[3px] text-lime/70 backdrop-blur-sm">
                  signal live
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PLATFORM STATS */}
      <section aria-label="Platform stats" className="-mt-4 sm:-mt-5">
        <HeroStats
          stats={[
            {
              label: "Fans on the board",
              value: fans,
              hint: "Demo fans and Spotify-linked accounts",
              tone: "fg",
            },
            {
              label: "Artists tracked",
              value: artists,
              hint: "Every artist with a live leaderboard",
              tone: "lime",
            },
            {
              label: `Points awarded · ${week.label}`,
              value: weekPoints,
              hint: "Minutes, crate depth and streaks combined",
              tone: "gold",
            },
          ]}
        />
      </section>

      {/* LIVE TICKER */}
      <section aria-label="Live activity" className="-mt-3 sm:-mt-4">
        <LiveTicker
          events={tickerEvents}
          emptyLabel="No activity yet — the first listen of the week starts the board."
        />
      </section>

      {/* GLOBAL ARTIST BOARD */}
      <section id="artists" className="scroll-mt-24">
        <Reveal>
          <SectionHeader
            eyebrow="Global artist board"
            title="The fandom power ranking"
            description="Total points from every fan of an artist in the selected window. Whoever carries the deepest crate and the longest streak sits on top."
            action={<PeriodTabs period={period} basePath="/" />}
          />
        </Reveal>

        {rows.length === 0 ? (
          <EmptyState
            className="mt-6"
            title="No artists ranked yet"
            description="The board fills up as fans listen. Enter the demo universe to seed real activity and see the ranking come alive."
            action={
              <Link href="/login" className="btn btn-primary">
                Enter as demo fan
              </Link>
            }
          />
        ) : (
          <Reveal delay={0.06} y={12} className="mt-6">
            <div className="panel overflow-hidden">
              <div
                aria-hidden="true"
                className="hidden border-b border-line bg-ink/40 py-2.5 md:grid md:grid-cols-[3.25rem_minmax(0,1fr)_5rem_8.5rem_6rem] md:items-center md:gap-3 md:px-5"
              >
                <span className="font-mono text-[0.58rem] uppercase tracking-[0.18em] text-muted">#</span>
                <span className="font-mono text-[0.58rem] uppercase tracking-[0.18em] text-muted">
                  Artist
                </span>
                <span className="font-mono text-[0.58rem] uppercase tracking-[0.18em] text-muted">
                  Fans
                </span>
                <span className="font-mono text-[0.58rem] uppercase tracking-[0.18em] text-muted">
                  Top fan
                </span>
                <span className="text-right font-mono text-[0.58rem] uppercase tracking-[0.18em] text-muted">
                  Points
                </span>
              </div>

              <div>
                {rows.map((row, index) => (
                  <Reveal
                    key={row.artist.id}
                    y={10}
                    delay={0.08 + Math.min(index, 11) * 0.035}
                    className="relative"
                  >
                    <BoardRow row={row} leaderPoints={leaderPoints} first={index === 0} />
                  </Reveal>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-ink/40 px-4 py-3 sm:px-5">
                <span className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted">
                  {PERIOD_LABEL[period]} · top {rows.length} of {formatPoints(artists)} artists
                </span>
                <span className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-lime/80">
                  delta vs previous {period} · points desc, minutes tiebreak
                </span>
              </div>
            </div>
          </Reveal>
        )}
      </section>

      {/* HOW POINTS WORK */}
      <section aria-labelledby="scoring-title">
        <Reveal>
          <SectionHeader
            id="scoring-title"
            eyebrow="Scoring model"
            title="How points work"
            description="Three levers decide your rank. Minutes pay the rent, distinct tracks pay the bonus, streaks decide who is still standing in December."
          />
        </Reveal>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {HOW_CARDS.map((card, index) => (
            <Reveal key={card.index} delay={0.06 + index * 0.08} y={18}>
              <article className="group relative h-full overflow-hidden rounded-[1.1rem] border border-line bg-gradient-to-b from-panel2/80 to-panel/95 p-5 transition duration-300 hover:-translate-y-1 hover:border-lime/25">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  style={{
                    background:
                      "radial-gradient(320px 170px at 14% 0%, rgba(255,82,54,0.12), transparent 72%)",
                  }}
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-lime/40 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                />

                <div className="relative flex items-start justify-between">
                  <span className="num bg-gradient-to-b from-lime to-lime/25 bg-clip-text text-[1.9rem] font-semibold leading-none text-transparent">
                    {card.index}
                  </span>
                  <span aria-hidden="true" className="mt-1 h-7 w-px bg-line" />
                </div>

                <h3 className="relative mt-4 font-display text-lg font-semibold tracking-tight text-fg">
                  {card.title}
                </h3>
                <p className="relative mt-2 text-[0.82rem] leading-relaxed text-muted">{card.body}</p>
                <div className="relative mt-4 border-t border-line pt-3 font-mono text-[0.58rem] uppercase tracking-[0.18em] text-muted">
                  {card.foot}
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </section>
    </div>
  );
}
