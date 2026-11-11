"use client";

/**
 * Live activity marquee. The event list is duplicated once and translated by
 * exactly -50%, so the loop is seamless and the animation runs on the
 * compositor (no layout work per frame). Hover pauses; reduced motion stops it
 * entirely and leaves the first events readable.
 */
export type TickerEvent = {
  id: string;
  message: string;
  ago: string;
};

const TICKER_CSS = `
@keyframes fr-marquee {
  from { transform: translate3d(0, 0, 0); }
  to   { transform: translate3d(-50%, 0, 0); }
}
.fr-marquee {
  animation: fr-marquee 84s linear infinite;
  will-change: transform;
  backface-visibility: hidden;
}
.fr-ticker-mask {
  mask-image: linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent);
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent);
}
.fr-marquee-shell:hover .fr-marquee,
.fr-marquee-shell:focus-within .fr-marquee {
  animation-play-state: paused;
}
@media (prefers-reduced-motion: reduce) {
  .fr-marquee { animation: none; }
}
`;

export function LiveTicker({
  events,
  emptyLabel,
}: {
  events: TickerEvent[];
  emptyLabel: string;
}) {
  return (
    <>
      <style>{TICKER_CSS}</style>
      <div className="relative flex items-stretch overflow-hidden rounded-full border border-line bg-panel/50">
        <div className="relative z-10 flex shrink-0 items-center gap-2 border-r border-line bg-panel/90 px-3.5 py-2.5 font-mono text-[0.58rem] uppercase tracking-[0.22em] text-lime sm:px-4">
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-lime" />
          Live
        </div>

        <div className="fr-ticker-mask fr-marquee-shell relative min-w-0 flex-1 overflow-hidden">
          {events.length === 0 ? (
            <div className="truncate px-4 py-2.5 text-xs text-muted">{emptyLabel}</div>
          ) : (
            <div className="fr-marquee flex w-max items-center py-2.5">
              {[0, 1].map((copy) => (
                <div
                  key={copy}
                  className="flex shrink-0 items-center"
                  aria-hidden={copy === 1 ? "true" : undefined}
                >
                  {events.map((event) => (
                    <span
                      key={`${copy}-${event.id}`}
                      className="flex shrink-0 items-center gap-2.5 pl-6 text-xs"
                    >
                      <span aria-hidden="true" className="h-1 w-1 rounded-full bg-line" />
                      <span className="text-fg/85">{event.message}</span>
                      <span className="num text-[0.62rem] text-muted">{event.ago}</span>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
