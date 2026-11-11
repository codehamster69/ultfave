"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MotionConfig, motion } from "motion/react";
import { EmptyState } from "@/components/ui";
import { ProgressRing } from "@/components/progress-ring";
import { formatPoints, todayUtc } from "@/lib/period";
import type { Challenge } from "@/lib/types";

const METRIC_LABEL: Record<Challenge["metric"], string> = {
  minutes: "Minutes listened",
  plays: "Plays logged",
  distinct_tracks: "Distinct tracks",
};

function metricUnit(metric: Challenge["metric"]): string {
  if (metric === "minutes") return "min";
  if (metric === "plays") return "plays";
  return "tracks";
}

function shortDate(day: string): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return day;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function daysBetween(fromDay: string, toDay: string): number {
  const from = new Date(`${fromDay}T00:00:00.000Z`).getTime();
  const to = new Date(`${toDay}T00:00:00.000Z`).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.round((to - from) / 86_400_000);
}

const CHIP_TONE: Record<string, string> = {
  muted: "border-line text-muted",
  lime: "border-lime/35 bg-lime/[0.07] text-lime",
  peri: "border-peri/35 bg-peri/[0.07] text-peri",
  gold: "border-gold/30 bg-gold/[0.06] text-gold",
};

/** Utility-only chip: avoids clashing with the unlayered `.chip` colour rules. */
function Chip({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "lime" | "peri" | "gold";
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-[0.15rem] font-mono text-[0.55rem] uppercase tracking-[0.12em] ${CHIP_TONE[tone]}`}
    >
      {children}
    </span>
  );
}

function CheckMark() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 12.5l5 5L20 6.5" />
    </svg>
  );
}

export function ChallengeGrid({
  challenges,
  viewerId,
}: {
  challenges: Challenge[];
  viewerId: string | null;
}) {
  const router = useRouter();
  const [today] = useState(() => todayUtc());
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [joinedNow, setJoinedNow] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function join(challengeId: string) {
    if (pendingId) return;
    setPendingId(challengeId);
    setErrors((prev) => {
      const next = { ...prev };
      delete next[challengeId];
      return next;
    });
    // Optimistic: the card flips to "in the hunt" immediately, then reverts on failure.
    setJoinedNow((prev) => ({ ...prev, [challengeId]: true }));
    try {
      const response = await fetch(`/api/challenges/${challengeId}/join`, { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Could not join this challenge.");
      }
      router.refresh();
    } catch (error) {
      setJoinedNow((prev) => {
        const next = { ...prev };
        delete next[challengeId];
        return next;
      });
      const message =
        error instanceof Error ? error.message : "Could not join this challenge.";
      setErrors((prev) => ({ ...prev, [challengeId]: message }));
    } finally {
      setPendingId(null);
    }
  }

  if (challenges.length === 0) {
    return (
      <div className="panel p-6">
        <EmptyState
          title="No live challenges"
          description="Nothing is running today. New targets drop every week — check back when the next round opens."
        />
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="grid gap-3">
        {challenges.map((challenge, index) => {
          const joined = challenge.joined || Boolean(joinedNow[challenge.id]);
          const completed = challenge.completed;
          const target = Math.max(0, challenge.target);
          const progress = Math.max(0, completed ? Math.max(challenge.progress, target) : challenge.progress);
          const ratio = target > 0 ? Math.min(1, progress / target) : completed ? 1 : 0;
          const percent = Math.round(ratio * 100);
          const finished = completed || ratio >= 1;
          const daysLeft = daysBetween(today, challenge.endsOn);
          const error = errors[challenge.id];
          const pending = pendingId === challenge.id;

          return (
            <div
              key={challenge.id}
              className="rise"
              style={{ animationDelay: `${Math.min(index, 6) * 55}ms` }}
            >
              <motion.article
                whileHover={{ y: -3 }}
                transition={{ type: "spring", stiffness: 280, damping: 24 }}
                className={`panel group relative overflow-hidden p-4 ${
                  finished
                    ? "shadow-[0_0_0_1px_rgba(255,82,54,0.18),0_22px_48px_-30px_rgba(255,82,54,0.45)]"
                    : "panel-hover"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute -right-16 -top-20 h-40 w-40 rounded-full blur-3xl transition-opacity duration-500 ${
                    finished
                      ? "bg-lime/[0.12]"
                      : "bg-peri/[0.07] opacity-0 group-hover:opacity-100"
                  }`}
                />

                <div className="relative flex items-center justify-between gap-2">
                  <p className="font-mono text-[0.55rem] uppercase tracking-[0.2em] text-muted">
                    {METRIC_LABEL[challenge.metric]}
                  </p>
                  <Chip tone={finished ? "lime" : "gold"}>
                    +{formatPoints(challenge.bonusPoints)} pts bonus
                  </Chip>
                </div>

                <div className="relative mt-2.5 flex items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-[1.05rem] font-semibold leading-tight tracking-tight text-fg">
                      {challenge.title}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">
                      {challenge.description}
                    </p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      <Chip>{challenge.artistName ?? "Any artist"}</Chip>
                      <Chip>{challenge.participants} joined</Chip>
                      <Chip>
                        {daysLeft > 0
                          ? `${daysLeft}d left · ends ${shortDate(challenge.endsOn)}`
                          : `ends today · ${shortDate(challenge.endsOn)}`}
                      </Chip>
                    </div>
                  </div>

                  <ProgressRing
                    value={ratio}
                    size={74}
                    thickness={5.5}
                    tone={finished ? "lime" : joined ? "peri" : "muted"}
                    glow={finished}
                    label={`${challenge.title}: ${percent} percent of ${Math.round(target)} ${metricUnit(
                      challenge.metric,
                    )}`}
                  >
                    <span
                      className={`num text-[0.95rem] font-semibold ${finished ? "text-lime" : "text-fg"}`}
                    >
                      {percent}
                      <span className="text-[0.55rem] text-muted">%</span>
                    </span>
                    <span className="mt-1 font-mono text-[0.42rem] uppercase tracking-[0.14em] text-muted">
                      target
                    </span>
                  </ProgressRing>
                </div>

                <div className="relative mt-3 flex items-baseline justify-between gap-2 border-t border-line/70 pt-2.5">
                  <span className="num text-xs text-fg">
                    {Math.round(progress)}
                    <span className="text-[0.6rem] text-muted">
                      {" / "}
                      {formatPoints(target)} {metricUnit(challenge.metric)}
                    </span>
                  </span>
                  <span
                    className={`font-mono text-[0.52rem] uppercase tracking-[0.14em] ${
                      finished ? "text-lime" : "text-muted"
                    }`}
                  >
                    {finished
                      ? "target cleared"
                      : `${formatPoints(Math.max(0, target - Math.round(progress)))} to go`}
                  </span>
                </div>

                {error ? (
                  <p className="relative mt-2 font-mono text-[0.55rem] uppercase tracking-[0.1em] text-magenta">
                    {error}
                  </p>
                ) : null}

                <div className="relative mt-3 flex items-center justify-between gap-3">
                  {completed ? (
                    <span className="inline-flex items-center gap-1.5 font-mono text-[0.55rem] uppercase tracking-[0.16em] text-lime">
                      <CheckMark />
                      completed · bonus banked
                    </span>
                  ) : joined ? (
                    <span className="inline-flex items-center gap-1.5 font-mono text-[0.55rem] uppercase tracking-[0.16em] text-peri">
                      <span className="h-1.5 w-1.5 rounded-full bg-peri" aria-hidden="true" />
                      in the hunt
                    </span>
                  ) : finished ? (
                    <span className="font-mono text-[0.55rem] uppercase tracking-[0.16em] text-lime">
                      goal met · join to bank
                    </span>
                  ) : (
                    <span className="font-mono text-[0.55rem] uppercase tracking-[0.16em] text-muted">
                      target {formatPoints(target)} {metricUnit(challenge.metric)}
                    </span>
                  )}

                  {completed ? (
                    <Chip tone="lime">cleared</Chip>
                  ) : joined ? (
                    <Chip tone="peri">joined</Chip>
                  ) : viewerId ? (
                    <button
                      type="button"
                      onClick={() => void join(challenge.id)}
                      disabled={pending}
                      className="inline-flex items-center gap-1.5 rounded-full bg-lime px-3.5 py-1.5 text-[0.72rem] font-semibold tracking-wide text-ink transition hover:bg-[#ff7a5c] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {pending ? "joining" : "join"}
                    </button>
                  ) : (
                    <Link
                      href="/login"
                      className="inline-flex items-center rounded-full border border-line bg-panel2/60 px-3.5 py-1.5 text-[0.72rem] tracking-wide text-fg transition hover:border-fg/30"
                    >
                      sign in to join
                    </Link>
                  )}
                </div>
              </motion.article>
            </div>
          );
        })}
      </div>
    </MotionConfig>
  );
}

export default ChallengeGrid;
