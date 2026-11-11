import Link from "next/link";
import type { Metadata } from "next";
import { ActivityFeed } from "@/components/activity-feed";
import { ChallengeGrid } from "@/components/challenge-grid";
import { LiveBadge } from "@/components/live-badge";
import { SectionHeader } from "@/components/ui";
import { getFeed, type FeedScope } from "@/lib/activity";
import { getSession } from "@/lib/auth";
import { getActiveChallenges } from "@/lib/challenges";
import type { SessionUser } from "@/lib/types";

export const metadata: Metadata = {
  title: "Activity — Ultfave",
  description: "Every milestone, badge, overtake and challenge completion, live.",
};

async function readSession(): Promise<SessionUser | null> {
  try {
    return await getSession();
  } catch {
    return null;
  }
}

function readScope(raw: string | string[] | undefined): FeedScope {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === "friends" ? "friends" : "global";
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string | string[] }>;
}) {
  const params = await searchParams;
  const requestedScope = readScope(params.scope);
  const user = await readSession();
  const scope: FeedScope = requestedScope === "friends" && !user ? "global" : requestedScope;

  const [events, challenges] = await Promise.all([
    getFeed(user?.id ?? null, scope, 30),
    getActiveChallenges(user?.id ?? null),
  ]);

  const scopeLinks: { id: FeedScope; label: string; hint: string }[] = [
    { id: "global", label: "Global", hint: "Every fan on Ultfave" },
    { id: "friends", label: "Your circle", hint: "You and the fans you follow" },
  ];

  return (
    <div className="rise space-y-6 pb-2">
      <header className="border-b border-line pb-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <LiveBadge label="Live" detail={`${events.length} events`} />
          <span className="font-mono text-[0.55rem] uppercase tracking-[0.22em] text-muted">
            Fandom index · {challenges.length} challenges running
          </span>
        </div>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-fg sm:text-5xl">
          THE FANDOM NEVER SLEEPS
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
          Milestones, badges, overtakes and challenge runs land here the second they happen. Watch the
          whole platform move, or scope it down to the fans who actually matter to you.
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav
          aria-label="Feed scope"
          className="inline-flex items-center gap-1 rounded-full border border-line bg-panel p-1"
        >
          {scopeLinks.map((link) => {
            const active = scope === link.id;
            const locked = link.id === "friends" && !user;
            return (
              <Link
                key={link.id}
                href={`/activity?scope=${link.id}`}
                aria-current={active ? "page" : undefined}
                title={link.hint}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-mono text-[0.6rem] uppercase tracking-[0.14em] transition-colors ${
                  active
                    ? "bg-lime text-ink shadow-[0_0_0_1px_rgba(255,82,54,0.45)]"
                    : "text-muted hover:bg-panel2 hover:text-fg"
                }`}
              >
                {link.label}
                {locked ? (
                  <span className="text-[0.45rem] tracking-[0.08em] opacity-60">sign in</span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <span className="font-mono text-[0.55rem] uppercase tracking-[0.16em] text-muted">
          {challenges.length} live challenges · {events.length} recent events
        </span>
      </div>

      {requestedScope === "friends" && !user ? (
        <p className="text-xs leading-relaxed text-muted">
          Your circle needs an identity. Sign in to switch this feed to the fans you follow — until
          then we are showing the global stream.
        </p>
      ) : null}

      {!user ? (
        <div className="panel flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="font-display text-sm tracking-tight text-fg">You are browsing as a guest</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">
              The global feed is open to everyone. Sign in to join challenges, log a target and climb
              the boards.
            </p>
          </div>
          <Link
            href="/login"
            className="inline-flex items-center rounded-full bg-lime px-4 py-1.5 text-xs font-semibold text-ink transition hover:bg-[#ff7a5c]"
          >
            sign in
          </Link>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <SectionHeader
            eyebrow="Live feed"
            title={scope === "friends" ? "Your circle, right now" : "All fans, right now"}
            action={
              <span className="rounded-full border border-line px-2.5 py-[0.2rem] font-mono text-[0.52rem] uppercase tracking-[0.14em] text-muted">
                {events.length} events
              </span>
            }
          />
          <div className="mt-3">
            <ActivityFeed initialEvents={events} scope={scope} viewerId={user?.id ?? null} />
          </div>
        </div>

        <aside className="min-w-0">
          <SectionHeader
            eyebrow="This week's targets"
            title="Challenges"
            action={
              challenges.length > 0 ? (
                <span className="rounded-full border border-line px-2.5 py-[0.2rem] font-mono text-[0.52rem] uppercase tracking-[0.14em] text-muted">
                  {challenges.length} running
                </span>
              ) : null
            }
          />
          <div className="mt-3">
            <ChallengeGrid challenges={challenges} viewerId={user?.id ?? null} />
          </div>
          {user ? (
            <p className="mt-3 px-1 text-[11px] leading-relaxed text-muted">
              Challenges settle automatically as your points land. Clear the target and the bonus is
              added to today&apos;s score on the challenge artist.
            </p>
          ) : null}
        </aside>
      </div>

      <p className="font-mono text-[0.52rem] uppercase tracking-[0.18em] text-muted">
        feed refreshes every 20s · challenges settle on sync
      </p>
    </div>
  );
}
