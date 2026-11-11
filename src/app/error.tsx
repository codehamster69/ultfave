"use client";

import { useEffect } from "react";
import Link from "next/link";

type RouteErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

/**
 * Route-level error boundary.
 * Renders inside the root layout (so globals.css and the dark theme apply) and
 * never shows stack traces: production Next redacts error messages, and we only
 * surface the opaque digest for support correlation.
 */
export default function RouteError({ error, reset }: RouteErrorProps) {
  useEffect(() => {
    // Client-side breadcrumb only; the server log has the real trace.
    console.error(`[ui] route error${error.digest ? ` (digest ${error.digest})` : ""}`);
  }, [error]);

  return (
    <div className="relative mx-auto flex min-h-[60vh] w-full max-w-2xl items-center justify-center py-16">
      <div className="w-full overflow-hidden rounded-[1.35rem] border border-line bg-panel/60 p-6 shadow-[0_40px_120px_-60px_rgba(0,0,0,0.95)] sm:p-9">
        <p className="flex items-center gap-2.5 font-mono text-[0.6rem] uppercase tracking-[0.26em] text-muted">
          <span aria-hidden="true" className="live-dot h-1.5 w-1.5 rounded-full bg-magenta" />
          Signal lost
        </p>

        <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
          That board didn&apos;t load.
        </h1>

        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
          Something interrupted this view — usually a dropped connection or a slow database read.
          Your scores are safe. Try the page again, or head back to the main board.
        </p>

        {error.digest ? (
          <p className="mt-4 font-mono text-[0.55rem] uppercase tracking-[0.2em] text-muted/70">
            Reference: {error.digest}
          </p>
        ) : null}

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="btn btn-primary px-5 py-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
          >
            Try again
          </button>
          <Link
            href="/"
            className="btn btn-ghost px-5 py-3 text-sm transition-colors hover:border-lime/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
          >
            Back to the board
          </Link>
        </div>

        <div className="mt-7 flex items-center justify-between border-t border-line/70 pt-3 font-mono text-[0.5rem] uppercase tracking-[0.18em] text-muted">
          <span>Demo data is fictional</span>
          <span>Ultfave</span>
        </div>
      </div>
    </div>
  );
}
