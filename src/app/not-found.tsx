import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Off the board — Ultfave",
  description: "This page is not on the scoreboard.",
};

export default function NotFound() {
  return (
    <div className="halo relative flex min-h-[64vh] flex-col items-center justify-center overflow-hidden py-20 text-center">
      <div
        aria-hidden="true"
        className="grid-lines pointer-events-none absolute inset-0 opacity-40"
        style={{
          maskImage: "radial-gradient(80% 70% at 50% 40%, #000 10%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(80% 70% at 50% 40%, #000 10%, transparent 75%)",
        }}
      />

      <div className="relative flex items-center gap-2 font-mono text-[0.6rem] uppercase tracking-[0.26em] text-lime">
        <span
          aria-hidden="true"
          className="block h-3 w-[3px] -skew-x-[18deg] rounded-[1px] bg-lime"
        />
        error 404 · off the board
      </div>

      <p className="num relative mt-5 select-none text-[clamp(5rem,18vw,10rem)] font-semibold leading-[0.8] tracking-tighter">
        <span className="text-gradient">404</span>
      </p>

      <h1 className="relative mt-6 font-display text-[clamp(1.7rem,4vw,2.6rem)] font-semibold leading-[1.05] tracking-tight text-fg">
        This page left the stadium.
      </h1>
      <p className="relative mt-3 max-w-md text-sm leading-relaxed text-muted">
        The link is broken, the artist was delisted, or the scoreboard reset. The board is still
        live — head back and pick a fandom to follow.
      </p>

      <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link href="/" className="btn btn-primary">
          Back to the board
        </Link>
        <Link href="/#artists" className="btn btn-ghost">
          Explore artists
        </Link>
      </div>

      <p className="num relative mt-10 text-[0.6rem] uppercase tracking-[0.2em] text-muted">
        points desc · minutes tiebreak
      </p>
    </div>
  );
}
