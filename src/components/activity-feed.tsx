"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react";
import { Avatar } from "@/components/ui";
import { LiveBadge } from "@/components/live-badge";
import type { ActivityEvent } from "@/lib/types";

type Scope = "global" | "friends";

const POLL_INTERVAL_MS = 20_000;
const CLOCK_TICK_MS = 5_000;
const MAX_VISIBLE = 12;

const KIND_STYLE: Record<string, { text: string; node: string }> = {
  milestone: { text: "text-lime", node: "border-lime/30 bg-lime/[0.08]" },
  badge: { text: "text-gold", node: "border-gold/30 bg-gold/[0.07]" },
  overtake: { text: "text-magenta", node: "border-magenta/30 bg-magenta/[0.07]" },
  challenge: { text: "text-lime", node: "border-lime/30 bg-lime/[0.08]" },
  join: { text: "text-peri", node: "border-peri/30 bg-peri/[0.07]" },
};

function kindStyle(kind: string): { text: string; node: string } {
  return KIND_STYLE[kind] ?? { text: "text-muted", node: "border-line bg-panel2" };
}

function KindIcon({ kind }: { kind: string }) {
  const shared = {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (kind === "milestone") {
    return (
      <svg {...shared}>
        <path d="M4 17l5-5 3.5 3.5L20 8" />
        <path d="M15 8h5v5" />
      </svg>
    );
  }
  if (kind === "badge") {
    return (
      <svg {...shared}>
        <circle cx="12" cy="9" r="5" />
        <path d="M8.5 13.5L7 21l5-2.5L17 21l-1.5-7.5" />
      </svg>
    );
  }
  if (kind === "overtake") {
    return (
      <svg {...shared}>
        <path d="M5 19L19 5" />
        <path d="M11 5h8v8" />
        <path d="M4 12v4a3 3 0 003 3h4" />
      </svg>
    );
  }
  if (kind === "challenge") {
    return (
      <svg {...shared}>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="3.5" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      </svg>
    );
  }
  if (kind === "join") {
    return (
      <svg {...shared}>
        <circle cx="10" cy="12" r="7" />
        <path d="M14 12h7M18 9l3 3-3 3" />
      </svg>
    );
  }
  return (
    <svg {...shared}>
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
      <path d="M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8z" />
    </svg>
  );
}

/** Dedupe by id so a racing poll can never produce duplicate React keys. */
function dedupe(list: ActivityEvent[]): ActivityEvent[] {
  const ids = new Set<string>();
  const out: ActivityEvent[] = [];
  for (const event of list) {
    if (!event || ids.has(event.id)) continue;
    ids.add(event.id);
    out.push(event);
  }
  return out;
}

/**
 * Relative stamps depend on the visitor's clock, so the server text can differ
 * from the first client render by a second. The server keeps its own value until
 * the next 5s tick re-renders; hydration warnings are suppressed on purpose.
 */
function relativeStamp(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "just now";
  const mins = Math.max(0, Math.floor((Date.now() - then) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function ActivityFeed({
  initialEvents,
  scope,
  viewerId,
}: {
  initialEvents: ActivityEvent[];
  scope: Scope;
  viewerId: string | null;
}) {
  const reduce = useReducedMotion();
  const [events, setEvents] = useState<ActivityEvent[]>(() => dedupe(initialEvents));
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);
  const [, setClock] = useState(0);
  const inFlight = useRef(false);
  const seen = useRef<Set<string>>(new Set(dedupe(initialEvents).map((event) => event.id)));

  useEffect(() => {
    const next = dedupe(initialEvents);
    for (const event of next) seen.current.add(event.id);
    setEvents(next);
    setLastSync(Date.now());
    setError(null);
  }, [initialEvents, scope]);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    try {
      const response = await fetch(`/api/feed?scope=${scope}&limit=30`, { cache: "no-store" });
      const payload = (await response.json()) as {
        ok?: boolean;
        events?: ActivityEvent[];
        error?: string;
      };
      if (!response.ok || !payload.ok || !Array.isArray(payload.events)) {
        throw new Error(payload.error ?? "Feed unavailable");
      }
      setEvents(dedupe(payload.events));
      setLastSync(Date.now());
      setError(null);
    } catch {
      setError("Live feed paused. We will keep retrying.");
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  }, [scope]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      void load();
    }, POLL_INTERVAL_MS);

    const onVisibility = () => {
      setTabHidden(document.hidden);
      if (!document.hidden) void load();
    };
    setTabHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock((value) => (value + 1) % 10_000), CLOCK_TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  const visible = useMemo(() => dedupe(events).slice(0, MAX_VISIBLE), [events]);

  // Anything already on screen is "seen" after paint, so only genuinely new
  // arrivals get the entrance spring on later polls.
  useEffect(() => {
    for (const event of visible) seen.current.add(event.id);
  });

  const secondsAgo = lastSync === null ? null : Math.max(0, Math.floor((Date.now() - lastSync) / 1000));
  const updatedLabel =
    secondsAgo === null
      ? "connecting"
      : secondsAgo < 5
        ? "updated just now"
        : `updated ${secondsAgo}s ago`;

  const badgeState = error ? "error" : tabHidden ? "paused" : "live";
  const badgeLabel = error ? "reconnecting" : tabHidden ? "paused" : "live";
  const total = dedupe(events).length;

  return (
    <MotionConfig reducedMotion="user">
      <section className="panel overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-line px-4 py-3">
          <div className="flex items-center gap-2.5">
            <LiveBadge state={badgeState} label={badgeLabel} />
            <span className="font-mono text-[0.55rem] uppercase tracking-[0.2em] text-muted">
              {scope === "friends" ? "your circle" : "all fans"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="font-mono text-[0.55rem] uppercase tracking-[0.16em] text-muted"
              aria-live="off"
            >
              {updatedLabel}
            </span>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 font-mono text-[0.55rem] uppercase tracking-[0.16em] text-lime transition hover:border-lime/40 disabled:opacity-40"
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className={loading && !reduce ? "origin-center animate-spin" : ""}
              >
                <path d="M20 11a8 8 0 10-2.6 6" />
                <path d="M20 5v6h-6" />
              </svg>
              {loading ? "syncing" : "refresh"}
            </button>
          </div>
        </header>

        {error ? (
          <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-magenta/[0.04] px-4 py-2"
          >
            <span className="inline-flex items-center gap-2 text-[0.7rem] leading-snug text-muted">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-magenta/80" aria-hidden="true" />
              Live updates paused — retrying every 20s.
            </span>
            <button
              type="button"
              onClick={() => void load()}
              className="font-mono text-[0.55rem] uppercase tracking-[0.16em] text-magenta transition-opacity hover:opacity-70"
            >
              retry now
            </button>
          </div>
        ) : null}

        {visible.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <p className="font-display text-lg tracking-tight text-fg">Quiet in here</p>
            <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-muted">
              {scope === "friends" && viewerId
                ? "Nobody in your circle has moved yet. Follow more fans to widen the signal."
                : "No events logged yet. The moment a fan scores, it lands here."}
            </p>
          </div>
        ) : (
          <ul
            className="relative px-3 py-1"
            aria-label="Activity timeline"
            aria-live="polite"
            aria-relevant="additions"
            aria-atomic="false"
          >
            <AnimatePresence initial={false} mode="popLayout">
              {visible.map((event, index) => {
                const isNew = !seen.current.has(event.id);
                const style = kindStyle(event.kind);
                const isLast = index === visible.length - 1;
                return (
                  <motion.li
                    key={event.id}
                    layout={reduce ? false : "position"}
                    initial={isNew ? { opacity: 0, y: -10 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 320, damping: 32, mass: 0.6 }}
                    className="relative flex gap-2.5 rounded-xl px-1 py-2.5 transition-colors hover:bg-panel2/40"
                  >
                    <span className="relative flex w-7 shrink-0 flex-col items-center" aria-hidden="true">
                      <span
                        className={`absolute left-1/2 w-px -translate-x-1/2 bg-line ${
                          index === 0 ? "top-1/2" : "-top-3"
                        } ${isLast ? "bottom-1/2" : "-bottom-3"}`}
                      />
                      <span
                        className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full border ${style.node} ${style.text}`}
                      >
                        <KindIcon kind={event.kind} />
                      </span>
                    </span>

                    <div className="flex min-w-0 flex-1 items-start gap-2.5">
                      <Avatar name={event.actorName ?? "Ultfave"} src={event.actorAvatarUrl} size={28} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[0.85rem] leading-snug text-fg">{event.message}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[0.52rem] uppercase tracking-[0.14em] text-muted">
                          <span className={`inline-flex items-center gap-1 ${style.text}`}>
                            {event.kind}
                          </span>
                          {event.actorHandle ? <span>@{event.actorHandle}</span> : null}
                          {event.artistName ? (
                            <span className="max-w-[7.5rem] truncate text-peri">{event.artistName}</span>
                          ) : null}
                          <time
                            dateTime={event.createdAt}
                            title={event.createdAt}
                            suppressHydrationWarning
                            className="num lowercase tracking-[0.08em]"
                          >
                            {relativeStamp(event.createdAt)}
                          </time>
                        </div>
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}

        <footer className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5">
          <p className="font-mono text-[0.52rem] uppercase tracking-[0.18em] text-muted">
            auto-refresh 20s · {tabHidden ? "paused while hidden" : "polling live"}
          </p>
          <p className="num font-mono text-[0.52rem] uppercase tracking-[0.16em] text-muted">
            {total > MAX_VISIBLE ? `showing ${MAX_VISIBLE} of ${total}` : `${total} events`}
          </p>
        </footer>
      </section>
    </MotionConfig>
  );
}

export default ActivityFeed;
