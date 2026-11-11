"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PERIOD_LABEL, formatPoints } from "@/lib/period";
import type { Period } from "@/lib/types";

type FanCardShareProps = {
  artistId: string;
  artistName: string;
  period: Period;
  rank: number | null;
  points: number;
};

type Feedback = "copied" | "shared" | "error" | null;

const ACTION =
  "btn focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime";

function CopyIcon({ done = false }: { done?: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {done ? (
        <path d="M3 8.6 6.2 12 13 4.5" />
      ) : (
        <>
          <rect x="5.5" y="5.5" width="8" height="9" rx="1.6" />
          <path d="M10.5 5.5V3.6A1.6 1.6 0 0 0 8.9 2H4.1a1.6 1.6 0 0 0-1.6 1.6v6.2a1.6 1.6 0 0 0 1.6 1.6h1" />
        </>
      )}
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6.5 3.5h-3v9h9v-3" />
      <path d="M9.5 2.5h4v4M13 3 7.5 8.5" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="4" cy="8" r="1.8" />
      <circle cx="12" cy="3.6" r="1.8" />
      <circle cx="12" cy="12.4" r="1.8" />
      <path d="M5.6 7.1 10.4 4.5M5.6 8.9l4.8 2.6" />
    </svg>
  );
}

async function copyText(value: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }

  try {
    const field = document.createElement("textarea");
    field.value = value;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.top = "-1000px";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(field);
    return ok;
  } catch {
    return false;
  }
}

export function FanCardShare({ artistId, artistName, period, rank, points }: FanCardShareProps) {
  const [baseUrl, setBaseUrl] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const configured = process.env.NEXT_PUBLIC_APP_URL;
    setBaseUrl(
      (configured && configured.trim().length > 0 ? configured : window.location.origin).replace(
        /\/+$/,
        "",
      ),
    );
  }, []);

  const clearTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const announce = useCallback(
    (next: Exclude<Feedback, null>) => {
      setFeedback(next);
      clearTimer();
      timer.current = setTimeout(() => setFeedback(null), 2000);
    },
    [clearTimer],
  );

  const cardUrl = baseUrl ? `${baseUrl}/api/card/${encodeURIComponent(artistId)}?period=${period}` : "";
  const rankLabel = rank === null ? "\u2014" : `#${rank}`;
  const pointsLabel = formatPoints(points);
  const unranked = rank === null;

  async function handleCopy() {
    if (!cardUrl) return;
    const ok = await copyText(cardUrl);
    announce(ok ? "copied" : "error");
  }

  async function handleShare() {
    if (!cardUrl) return;
    const shareData = {
      title: `${artistName} fan card`,
      text: `My ${PERIOD_LABEL[period].toLowerCase()} fan rank for ${artistName} on Ultfave.`,
      url: cardUrl,
    };

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share(shareData);
        setFeedback(null);
        clearTimer();
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          setFeedback(null);
          clearTimer();
          return;
        }
      }
    }

    const ok = await copyText(cardUrl);
    announce(ok ? "shared" : "error");
  }

  const statusText =
    feedback === "copied"
      ? "Card link copied to clipboard."
      : feedback === "shared"
        ? "Card link copied, share it anywhere."
        : feedback === "error"
          ? "Could not copy the card link. Try opening the card instead."
          : "";

  return (
    <section
      className="panel relative flex w-full min-w-0 flex-col overflow-hidden sm:w-auto sm:flex-1"
      aria-labelledby="fan-card-share-heading"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-peri/15 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-20 bottom-0 h-44 w-44 rounded-full bg-lime/10 blur-3xl"
      />

      <div className="relative flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <span
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-line bg-ink/70 text-lime"
            >
              <ShareIcon />
            </span>
            <div className="min-w-0">
              <h2 id="fan-card-share-heading" className="font-display text-lg leading-tight tracking-tight">
                Share your fan card
              </h2>
              <p className="mt-0.5 text-xs leading-snug text-muted">
                1200 x 630 PNG of your {PERIOD_LABEL[period].toLowerCase()} standing. No watermark.
              </p>
            </div>
          </div>
          <span className="hidden shrink-0 sm:block">
            <span className="chip">{PERIOD_LABEL[period]}</span>
          </span>
        </div>

        <div
          className={`relative overflow-hidden rounded-xl border p-4 ${
            unranked ? "border-line bg-ink/70" : "border-line/80 bg-ink"
          }`}
        >
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 ${unranked ? "opacity-40" : "opacity-100"}`}
            style={{
              background:
                "linear-gradient(125deg, rgba(147,167,255,0.16), rgba(21,10,18,0.2) 48%, rgba(255,82,54,0.12))",
            }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(247,237,227,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(247,237,227,0.05) 1px, transparent 1px)",
              backgroundSize: "26px 26px",
              maskImage: "linear-gradient(180deg, #000, transparent 92%)",
              WebkitMaskImage: "linear-gradient(180deg, #000, transparent 92%)",
            }}
          />

          <div className="relative flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3.5">
              <div className="flex flex-col">
                <span className="font-mono text-[0.55rem] uppercase tracking-[0.22em] text-muted">
                  Rank
                </span>
                <span
                  className={`num text-4xl leading-none tracking-tight ${
                    unranked ? "text-muted" : "text-lime drop-shadow-[0_0_18px_rgba(255,82,54,0.25)]"
                  }`}
                >
                  {rankLabel}
                </span>
              </div>
              <span aria-hidden="true" className="h-10 w-px shrink-0 bg-line" />
              <div className="flex min-w-0 flex-col">
                <p className="truncate font-display text-sm font-semibold tracking-tight text-fg">
                  {artistName}
                </p>
                <p className="truncate font-mono text-[0.58rem] uppercase tracking-[0.18em] text-muted">
                  {unranked ? "Sync to get ranked" : `${PERIOD_LABEL[period]} fan`}
                </p>
                <span className="mt-1.5 inline-flex w-fit items-center gap-1 rounded-full border border-line/80 bg-ink/60 px-1.5 py-0.5 font-mono text-[0.5rem] uppercase tracking-[0.14em] text-muted">
                  1200 x 630
                </span>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end">
              <span className={`num text-lg ${unranked ? "text-muted" : "text-fg"}`}>
                {pointsLabel}
              </span>
              <span className="font-mono text-[0.55rem] uppercase tracking-[0.22em] text-muted">
                pts
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={`${ACTION} btn-primary`}
            onClick={handleCopy}
            disabled={!cardUrl}
            aria-label="Copy fan card link"
          >
            <CopyIcon done={feedback === "copied"} />
            {feedback === "copied" ? "Copied" : "Copy link"}
          </button>
          <a
            href={cardUrl || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className={`${ACTION} btn-ghost`}
            aria-disabled={cardUrl ? undefined : true}
            aria-label="Open fan card image in a new tab"
            onClick={(event) => {
              if (!cardUrl) event.preventDefault();
            }}
          >
            <ExternalIcon />
            Open card
          </a>
          <button
            type="button"
            className={`${ACTION} btn-ghost`}
            onClick={handleShare}
            disabled={!cardUrl}
            aria-label="Share fan card"
          >
            <ShareIcon />
            {feedback === "shared" ? "Link copied" : "Share"}
          </button>
        </div>

        <p aria-live="polite" className="min-h-4 text-xs text-muted">
          {statusText ||
            (unranked
              ? "You are unranked on this board — sync plays and the card fills in."
              : "")}
        </p>
      </div>
    </section>
  );
}

export default FanCardShare;
