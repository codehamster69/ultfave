import type { ArtistSummary, Period } from "@/lib/types";
import { PERIOD_LABEL, formatPoints } from "@/lib/period";
import { ArtistAura, ParallaxLayer } from "@/components/artist-aura";

export type ArtistStandingSummary = {
  rank: number;
  total: number;
  points: number;
  prevRank: number | null;
} | null;

function monogram(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return "FR";
  return parts
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

/** Splits the display name so the last word can carry the lime accent. */
function nameParts(name: string): { lead: string; accent: string | null } {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return { lead: words[0] ?? name, accent: null };
  return {
    lead: words.slice(0, -1).join(" "),
    accent: words[words.length - 1],
  };
}

export function ArtistHero({
  artist,
  standing,
  period,
}: {
  artist: ArtistSummary;
  standing: ArtistStandingSummary;
  period: Period;
}) {
  const genres = artist.genres.slice(0, 4);
  const rankDelta = standing && standing.prevRank !== null ? standing.prevRank - standing.rank : null;
  const { lead, accent } = nameParts(artist.name);

  return (
    <section className="rise relative isolate overflow-hidden rounded-[1.6rem] border border-line/80 shadow-[0_40px_80px_-60px_rgba(0,0,0,0.9)]">
      <ArtistAura />

      <div className="relative z-10 flex flex-col gap-7 p-5 sm:gap-9 sm:p-8 lg:p-11">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.3em] text-muted">
            Artist dossier
            <span className="mx-2 text-line">/</span>
            <span className="text-fg/80">{PERIOD_LABEL[period]}</span>
          </p>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-lime/25 bg-lime/[0.07] px-2.5 py-1 font-mono text-[0.55rem] uppercase tracking-[0.2em] text-lime">
            <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-lime" />
            Ranking live
          </span>
        </div>

        <div className="flex flex-col gap-7 md:flex-row md:items-end md:justify-between md:gap-10">
          <ParallaxLayer depth={1} className="min-w-0">
            <div className="relative">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -left-3 -top-16 select-none font-display text-[11rem] leading-none text-white/[0.035] sm:-top-24 sm:text-[15rem]"
              >
                {monogram(artist.name).charAt(0)}
              </span>

              <h1 className="relative max-w-[18ch] text-balance font-display text-[clamp(2.7rem,7.2vw,5.5rem)] font-semibold leading-[0.86] tracking-[-0.03em] text-fg">
                {lead}
                {accent ? (
                  <>
                    {" "}
                    <span className="relative inline-block text-lime">
                      {accent}
                      <span
                        aria-hidden="true"
                        className="absolute -bottom-1 left-0 h-[0.09em] w-full rounded-full bg-lime/40"
                      />
                    </span>
                  </>
                ) : (
                  <span aria-hidden="true" className="ml-1 inline-block h-[0.5em] w-[0.16em] -skew-x-[18deg] bg-lime align-baseline" />
                )}
              </h1>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-1.5">
              {genres.length > 0 ? (
                genres.map((genre) => (
                  <span
                    key={genre}
                    className="rounded-full border border-line/90 bg-ink/40 px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.12em] text-muted backdrop-blur-sm"
                  >
                    {genre}
                  </span>
                ))
              ) : (
                <span className="chip">genre under wraps</span>
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <span className="flex items-baseline gap-2">
                <span className="num text-lg font-semibold text-fg">
                  {formatPoints(artist.followers)}
                </span>
                <span className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted">
                  followers
                </span>
              </span>
              <span aria-hidden="true" className="hidden h-3 w-px bg-line sm:block" />
              <span className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted">
                fan board · {PERIOD_LABEL[period].toLowerCase()}
              </span>
            </div>
          </ParallaxLayer>

          <ParallaxLayer
            depth={2}
            className="flex items-center gap-5 md:flex-col md:items-end md:gap-4"
          >
            <div className="relative shrink-0 rounded-[1.55rem] bg-gradient-to-br from-lime/50 via-line/70 to-peri/40 p-[1px] shadow-[0_18px_40px_-24px_rgba(0,0,0,0.9)]">
              <div className="relative h-24 w-24 overflow-hidden rounded-[1.5rem] bg-ink sm:h-32 sm:w-32">
                {artist.imageUrl ? (
                  <img
                    src={artist.imageUrl}
                    alt={artist.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center font-display text-3xl tracking-tight text-fg/90 sm:text-4xl">
                    {monogram(artist.name)}
                  </span>
                )}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-[1.5rem] ring-1 ring-inset ring-white/10"
                />
              </div>
              <span
                aria-hidden="true"
                className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border border-ink bg-lime shadow-[0_0_14px_rgba(255,82,54,0.7)]"
              />
            </div>

            <div className="min-w-0 text-left md:text-right">
              <p className="font-mono text-[0.58rem] uppercase tracking-[0.24em] text-muted">
                Your rank
              </p>
              <p className="num mt-1 text-5xl font-semibold leading-none text-lime drop-shadow-[0_0_28px_rgba(255,82,54,0.22)] sm:text-6xl">
                {standing ? `#${standing.rank}` : "—"}
              </p>
              <p className="mt-2 text-xs leading-snug text-muted">
                {standing
                  ? `of ${formatPoints(standing.total)} fans · ${formatPoints(standing.points)} pts`
                  : "unranked — sync to enter"}
              </p>
              {standing && rankDelta !== null ? (
                <p
                  className={`num mt-1 inline-flex items-center gap-1 text-xs ${
                    rankDelta > 0 ? "text-lime" : rankDelta < 0 ? "text-magenta" : "text-muted"
                  }`}
                >
                  <span aria-hidden="true">
                    {rankDelta > 0 ? "\u2191" : rankDelta < 0 ? "\u2193" : "\u2013"}
                  </span>
                  {rankDelta > 0 ? `+${rankDelta}` : rankDelta < 0 ? `${rankDelta}` : "no change"} vs
                  last period
                </p>
              ) : null}
            </div>
          </ParallaxLayer>
        </div>
      </div>
    </section>
  );
}