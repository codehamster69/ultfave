"use client";

import { useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { Avatar, Delta, EmptyState } from "@/components/ui";
import { Podium } from "@/components/podium";
import { PERIOD_LABEL, formatMinutes, formatPoints } from "@/lib/period";
import type { LeaderboardRow, Period } from "@/lib/types";

type Props = {
  rows: LeaderboardRow[];
  meId: string | null;
  artistId: string;
  period: Period;
};

const YOU_CHIP: CSSProperties = {
  color: "var(--color-lime)",
  borderColor: "rgba(255, 82, 54, 0.45)",
  background: "rgba(255, 82, 54, 0.08)",
};

const TIER_STYLE: Record<string, CSSProperties> = {
  gold: { color: "var(--color-gold)", borderColor: "rgba(242, 178, 76, 0.45)" },
  elite: { color: "var(--color-lime)", borderColor: "rgba(255, 82, 54, 0.45)" },
  silver: { color: "var(--color-peri)", borderColor: "rgba(147, 167, 255, 0.45)" },
  bronze: { color: "var(--color-magenta)", borderColor: "rgba(242, 65, 124, 0.4)" },
};

const FOLLOW_BASE =
  "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 font-mono text-[0.58rem] uppercase tracking-[0.12em] transition disabled:cursor-not-allowed disabled:opacity-50";

function followClasses(following: boolean): string {
  return following
    ? `${FOLLOW_BASE} border-lime/40 bg-lime/10 text-lime hover:border-magenta/50 hover:text-magenta`
    : `${FOLLOW_BASE} border-line text-muted hover:border-lime/60 hover:text-fg`;
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 12 12"
      className="h-2.5 w-2.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 6.4 4.6 9 10 3.2" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 12 12"
      className="h-2.5 w-2.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 2v8M2 6h8" />
    </svg>
  );
}

function BadgeChips({
  badges,
  max = 1,
}: {
  badges: LeaderboardRow["badges"];
  max?: number;
}) {
  if (badges.length === 0) return null;
  const shown = badges.slice(0, max);
  const extra = badges.slice(max);

  return (
    <>
      {shown.map((badge) => (
        <span
          key={badge.id}
          className="chip max-w-[7.5rem] truncate px-2 py-0.5 text-[0.6rem] tracking-[0.06em]"
          style={TIER_STYLE[badge.tier]}
          title={`${badge.name} badge`}
        >
          {badge.name}
        </span>
      ))}
      {extra.length > 0 ? (
        <span
          className="chip shrink-0 px-1.5 py-0.5 text-[0.56rem] text-muted"
          title={extra.map((badge) => badge.name).join(", ")}
        >
          +{extra.length}
        </span>
      ) : null}
    </>
  );
}

function DeltaPill({ value, className = "inline-flex" }: { value: number | null; className?: string }) {
  const tone =
    (value ?? 0) > 0
      ? "border-lime/30 bg-lime/[0.06]"
      : (value ?? 0) < 0
        ? "border-magenta/30 bg-magenta/[0.06]"
        : "border-line/70 bg-ink/40";
  return (
    <span className={`items-center rounded-full border px-1.5 py-0.5 ${tone} ${className}`}>
      <Delta value={value} />
    </span>
  );
}

function LeaderRow({
  row,
  isViewer,
  action,
  index,
  pinned = false,
}: {
  row: LeaderboardRow;
  isViewer: boolean;
  action: ReactNode;
  index: number;
  pinned?: boolean;
}) {
  const reduce = useReducedMotion();

  function spotlight(event: ReactPointerEvent<HTMLLIElement>) {
    const target = event.currentTarget;
    const rect = target.getBoundingClientRect();
    target.style.setProperty("--mx", `${Math.round(event.clientX - rect.left)}px`);
    target.style.setProperty("--my", `${Math.round(event.clientY - rect.top)}px`);
  }

  return (
    <motion.li
      aria-current={isViewer ? "true" : undefined}
      custom={index}
      variants={
        reduce
          ? undefined
          : {
              hidden: { y: 6 },
              show: (i: number) => ({
                y: 0,
                transition: {
                  duration: 0.3,
                  delay: Math.min(i * 0.02, 0.16),
                  ease: [0.22, 1, 0.36, 1],
                },
              }),
            }
      }
      onPointerMove={spotlight}
      className={`group relative flex items-center gap-2 px-3 py-2.5 transition-colors sm:gap-3 ${
        isViewer ? "bg-lime/[0.07] ring-1 ring-inset ring-lime/25" : "hover:bg-panel2/60"
      } ${
        pinned
          ? "sticky bottom-0 z-10 border-t border-lime/30 bg-panel/95 shadow-[0_-14px_28px_-20px_rgba(0,0,0,0.95)] backdrop-blur-xl"
          : ""
      }`}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(220px circle at var(--mx, 50%) var(--my, 50%), rgba(255,82,54,0.09), transparent 68%)",
        }}
      />
      {isViewer ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-[2px] bg-gradient-to-b from-transparent via-lime to-transparent"
        />
      ) : null}

      <div className="relative flex w-10 shrink-0 items-center justify-end gap-1 sm:w-[4.25rem] sm:gap-1.5">
        <span className={`num text-sm font-semibold ${isViewer ? "text-lime" : "text-fg"}`}>
          {row.rank}
        </span>
        <DeltaPill value={row.delta} className="hidden sm:inline-flex" />
      </div>

      <Avatar name={row.name} src={row.avatarUrl} size={28} />

      <div className="relative min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[0.85rem] font-medium leading-tight text-fg">
            {row.name}
          </span>
          {isViewer ? (
            <span className="chip shrink-0" style={YOU_CHIP}>
              You
            </span>
          ) : null}
        </div>
        <div className="truncate font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted">
          @{row.handle}
        </div>
      </div>

      <div className="relative hidden w-40 shrink-0 items-center justify-end gap-1 lg:flex">
        <BadgeChips badges={row.badges} />
      </div>

      <div
        className="num relative hidden w-16 shrink-0 text-right text-xs text-muted sm:block"
        title="Minutes listened"
      >
        {formatMinutes(row.minutes)}
      </div>

      <div
        className="num relative hidden w-14 shrink-0 text-right text-xs text-muted md:block"
        title="Plays logged"
      >
        {formatPoints(row.plays)}
      </div>

      <div className="num relative w-16 shrink-0 text-right text-sm font-semibold tabular-nums text-fg sm:w-20 sm:text-base">
        {formatPoints(row.points)}
      </div>

      <div className="relative hidden w-[5.5rem] shrink-0 justify-end sm:flex">{action}</div>
    </motion.li>
  );
}

export function LeaderboardTable({ rows, meId, artistId, period }: Props) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [justChanged, setJustChanged] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const viewerId = meId;

  function isViewerRow(row: LeaderboardRow): boolean {
    return row.isMe || (viewerId !== null && row.userId === viewerId);
  }

  async function toggleFollow(row: LeaderboardRow) {
    if (viewerId === null || pending[row.userId]) return;

    const currentlyFollowing = overrides[row.userId] ?? row.isFriend;
    const nextFollowing = !currentlyFollowing;
    const action = nextFollowing ? "follow" : "unfollow";

    setError(null);
    setOverrides((prev) => ({ ...prev, [row.userId]: nextFollowing }));
    setPending((prev) => ({ ...prev, [row.userId]: true }));

    try {
      const res = await fetch("/api/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: row.userId, action }),
      });
      const payload = (await res.json().catch(() => null)) as
        | { ok?: boolean; following?: boolean; error?: string }
        | null;

      if (!res.ok || !payload || payload.ok === false) {
        throw new Error(payload?.error ?? "Could not update follow");
      }

      setOverrides((prev) => ({
        ...prev,
        [row.userId]: typeof payload.following === "boolean" ? payload.following : nextFollowing,
      }));
      setJustChanged((prev) => ({ ...prev, [row.userId]: true }));
      window.setTimeout(() => {
        setJustChanged((prev) => {
          const copy = { ...prev };
          delete copy[row.userId];
          return copy;
        });
      }, 900);
      router.refresh();
    } catch (err) {
      setOverrides((prev) => {
        const copy = { ...prev };
        delete copy[row.userId];
        return copy;
      });
      setError(err instanceof Error ? err.message : "Could not update follow");
    } finally {
      setPending((prev) => {
        const copy = { ...prev };
        delete copy[row.userId];
        return copy;
      });
    }
  }

  function followControl(row: LeaderboardRow): ReactNode {
    if (viewerId === null) {
      return (
        <Link href="/login" className={followClasses(false)} title={`Sign in to follow ${row.name}`}>
          Follow
        </Link>
      );
    }
    if (isViewerRow(row)) return null;

    const busy = Boolean(pending[row.userId]);
    const following = overrides[row.userId] ?? row.isFriend;
    const pulse = Boolean(justChanged[row.userId]);

    return (
      <motion.button
        type="button"
        onClick={() => void toggleFollow(row)}
        disabled={busy}
        aria-pressed={following}
        aria-label={`${following ? "Unfollow" : "Follow"} ${row.name}`}
        className={followClasses(following)}
        whileTap={reduce ? undefined : { scale: 0.93 }}
        animate={reduce ? undefined : pulse ? { scale: [1, 1.08, 1] } : { scale: 1 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        {busy ? (
          <span className="num" aria-hidden="true">
            &hellip;
          </span>
        ) : following ? (
          <CheckIcon />
        ) : (
          <PlusIcon />
        )}
        <span>{busy ? "Saving" : following ? "Following" : "Follow"}</span>
      </motion.button>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="panel p-6" data-artist={artistId}>
        <EmptyState
          title="No fans ranked yet"
          description={`No points recorded ${PERIOD_LABEL[period].toLowerCase()}. Log a listen for this artist and take rank #1 before anyone else does.`}
        />
      </div>
    );
  }

  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);
  const viewerInPodium = podium.some(isViewerRow);
  const viewerRow = viewerInPodium ? null : rest.find(isViewerRow) ?? null;
  const restOthers = rest.filter((row) => !isViewerRow(row));

  const listVariants = reduce
    ? undefined
    : {
        hidden: {},
        show: { transition: { staggerChildren: 0.02 } },
      };

  return (
    <section className="space-y-3" data-artist={artistId} data-period={period}>
      {error ? (
        <p role="alert" className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-magenta">
          {error}
        </p>
      ) : null}

      <Podium rows={podium} meId={viewerId} actionFor={followControl} />

      {rest.length > 0 ? (
        <div className="panel overflow-clip">
          <div className="sticky top-[6.75rem] z-20 flex items-center gap-2 border-b border-line bg-panel/95 px-3 py-2 font-mono text-[0.56rem] uppercase tracking-[0.16em] text-muted backdrop-blur-md sm:top-[7.25rem] sm:gap-3">
            <span className="w-10 shrink-0 text-right sm:w-[4.25rem]">Rank</span>
            <span className="w-7 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">Fan</span>
            <span className="hidden w-40 shrink-0 text-right lg:block">Badges</span>
            <span className="hidden w-16 shrink-0 text-right sm:block">Mins</span>
            <span className="hidden w-14 shrink-0 text-right md:block">Plays</span>
            <span className="w-16 shrink-0 text-right sm:w-20">Points</span>
            <span className="hidden w-[5.5rem] shrink-0 sm:block" aria-hidden="true" />
          </div>
          <motion.ul
            className="list-none divide-y divide-line"
            variants={listVariants}
            initial={reduce ? undefined : "hidden"}
            whileInView={reduce ? undefined : "show"}
            viewport={{ once: true, amount: 0.05 }}
          >
            {restOthers.map((row, index) => (
              <LeaderRow
                key={row.userId}
                row={row}
                isViewer={false}
                action={followControl(row)}
                index={index}
              />
            ))}
            {viewerRow ? (
              <LeaderRow
                key={viewerRow.userId}
                row={viewerRow}
                isViewer
                action={followControl(viewerRow)}
                index={0}
                pinned
              />
            ) : null}
          </motion.ul>
        </div>
      ) : null}
    </section>
  );
}
