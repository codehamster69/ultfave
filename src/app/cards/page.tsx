import { Metadata } from "next";
import Link from "next/link";

import { pageMetadata } from "@/lib/seo";
import { listArtists } from "@/lib/queries";
import { EmptyState, SectionHeader } from "@/components/ui";
import { Avatar } from "@/components/ui";
import type { ArtistSummary } from "@/lib/types";

export const metadata: Metadata = pageMetadata({
  title: "Fan Card Gallery",
  description: "Shareable fan cards for every artist. Generate your PNG card and prove your ult fave.",
  path: "/cards",
});

export default async function CardsPage() {
  const artists: ArtistSummary[] = await listArtists();

  if (artists.length === 0) {
    return (
      <div className="flex flex-col gap-8 py-2 sm:py-4">
        <SectionHeader
          eyebrow="Gallery"
          title="Fan card gallery"
          description="Shareable PNG cards for every artist on the board."
        />
        <EmptyState
          title="No artists yet"
          description="Artists appear here once fans start scoring points. Sync your listening to get on the board."
          action={
            <Link href="/" className="btn btn-ghost">
              Find an artist
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 py-2 sm:py-4">
      <SectionHeader
        eyebrow="Gallery"
        title="Fan card gallery"
        description="Generate a shareable PNG card for any artist. Cards are cached for 5 minutes and render anywhere."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {artists.map((artist) => (
          <article
            key={artist.id}
            className="panel panel-hover relative overflow-hidden rounded-[1.2rem] border p-4 group"
          >
            <div className="relative h-40 w-full rounded-[1rem] overflow-hidden border border-line mb-3 bg-panel2">
              {artist.imageUrl ? (
                <img
                  src={artist.imageUrl}
                  alt={artist.name}
                  width={480}
                  height={270}
                  loading="lazy"
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-panel2/50">
                  <Avatar name={artist.name} size={64} ring />
                </div>
              )}
            </div>
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <Link
                  href={`/api/card/${artist.id}?period=week`}
                  className="font-display text-base font-semibold tracking-tight text-fg transition hover:text-lime"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {artist.name}
                </Link>
                <p className="mt-0.5 font-mono text-[0.55rem] uppercase tracking-[0.14em] text-muted">
                  {artist.followers.toLocaleString()} fans
                </p>
              </div>
              <Link
                href={`/api/card/${artist.id}?period=week`}
                className="shrink-0 flex h-9 w-9 items-center justify-center rounded-full border border-line bg-panel2/80 text-[0.6rem] uppercase tracking-[0.1em] text-muted transition hover:border-lime/50 hover:text-lime"
                target="_blank"
                rel="noopener noreferrer"
                title={`Open ${artist.name} fan card`}
              >
                <svg
                  viewBox="0 0 12 12"
                  className="h-3 w-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M3 2l2 2M3 2l2-2M3 2l0 8M3 10l2 2M3 10l2-2" />
                </svg>
              </Link>
            </div>
            <div className="mt-3 flex gap-2">
              <Link
                href={`/api/card/${artist.id}?period=week`}
                className="flex-1 px-3 py-1.5 rounded-md border border-line/60 bg-panel2 text-[0.58rem] uppercase tracking-[0.12em] text-muted transition hover:border-lime/50 hover:text-lime"
                target="_blank"
                rel="noopener noreferrer"
              >
                Week
              </Link>
              <Link
                href={`/api/card/${artist.id}?period=month`}
                className="flex-1 px-3 py-1.5 rounded-md border border-line/60 bg-panel2 text-[0.58rem] uppercase tracking-[0.12em] text-muted transition hover:border-lime/50 hover:text-lime"
                target="_blank"
                rel="noopener noreferrer"
              >
                Month
              </Link>
              <Link
                href={`/api/card/${artist.id}?period=year`}
                className="flex-1 px-3 py-1.5 rounded-md border border-line/60 bg-panel2 text-[0.58rem] uppercase tracking-[0.12em] text-muted transition hover:border-lime/50 hover:text-lime"
                target="_blank"
                rel="noopener noreferrer"
              >
                Year
              </Link>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-line bg-ink/50 p-4">
        <p className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted">
          About fan cards
        </p>
        <p className="mt-1 text-sm leading-relaxed text-fg/90">
          Each card is a 1200×630 PNG showing your rank and points for an artist, generated on demand
          with <code className="bg-panel2/50 px-1 py-0.5 rounded text-[0.55rem]">next/og</code>. No external
          fonts or images are fetched at request time. Cards are cached for 5 minutes. Open a card in a new tab
          to download or share it.
        </p>
      </div>
    </div>
  );
}
