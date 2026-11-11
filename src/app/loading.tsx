export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[62vh] flex-col items-center justify-center py-16"
    >
      <div className="relative flex h-20 w-20 items-center justify-center">
        <span
          aria-hidden="true"
          className="pulse-ring absolute inset-0 rounded-full border border-lime/30"
        />
        <span
          aria-hidden="true"
          className="absolute inset-[7px] rounded-full border border-line/80"
        />
        <span
          aria-hidden="true"
          className="logo-pulse relative block h-10 w-[11px] -skew-x-[18deg] rounded-[2px] bg-lime shadow-[0_0_30px_rgba(255,82,54,0.45)]"
        />
      </div>

      <p className="mt-7 pl-[0.5em] font-display text-[0.78rem] font-semibold uppercase tracking-[0.5em] text-fg">
        Ultfave
      </p>
      <p className="mt-2 font-mono text-[0.56rem] uppercase tracking-[0.26em] text-muted">
        loading the scoreboard
      </p>

      <div aria-hidden="true" className="mt-10 w-full max-w-sm space-y-2.5 px-4">
        <div className="skeleton h-2.5 w-2/5" />
        <div className="skeleton h-11 w-full rounded-xl" />
        <div className="skeleton h-11 w-full rounded-xl opacity-80" />
        <div className="skeleton h-11 w-full rounded-xl opacity-60" />
        <div className="skeleton h-2.5 w-1/4" />
      </div>

      <span className="sr-only">Loading</span>
    </div>
  );
}
