import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState, SectionHeader } from "@/components/ui";
import { PointsCalculator } from "@/components/points-calculator";
import { pageMetadata } from "@/lib/seo";

const FAQS: { question: string; answer: string }[] = [
  {
    question: "How are points scored?",
    answer:
      "Every play adds its listening length to your artist total, capped at eight minutes per track. You also get ten points per distinct track per artist per day (up to twenty tracks), plus a five-point daily activity bonus when you play anything that day. Points reset weekly, monthly and yearly on their own boards.",
  },
  {
    question: "What is the eight-minute cap?",
    answer:
      "No single track can contribute more than eight minutes of listening to your score, no matter how many times you replay it. This keeps a 45-minute prog track or a looped ambient record from buying a rank — the board rewards breadth and consistency, not one track on repeat.",
  },
  {
    question: "How do streaks work?",
    answer:
      "A streak is consecutive calendar days with at least one scored play for the same artist. Miss a day and the fuse goes out. Your current and longest streak are tracked per artist, and hitting seven or thirty days unlocks streak badges.",
  },
  {
    question: "What are badges and how do I earn them?",
    answer:
      "There are eight badges across four tiers: bronze, silver, gold and elite. First-blood goes to the first fan to 100 points on an artist. Streak-7 and streak-30 reward consecutive listening days. Top-1 goes to the top 1% of fans on an artist's weekly board (minimum twenty fans). Crate-digger is forty distinct tracks on one artist in one week. Night-owl is fifty plays between midnight and 5am UTC. Rivalry is any overtake where you pass another fan. Challenger is completing any weekly challenge.",
  },
  {
    question: "How do challenges work?",
    answer:
      "Challenges are weekly targets on minutes, plays or distinct tracks, optionally scoped to one artist. Join a challenge, hit the target before it ends, and you earn bonus points plus the challenger badge. Joining is idempotent — you only get the bonus once.",
  },
  {
    question: "Can I connect Spotify?",
    answer:
      "Yes. Connecting Spotify imports your recently played tracks and keeps your scores fresh. Ultfave never posts anything to Spotify, and your access tokens are never stored in your session cookie — they live in your database row only. If Spotify isn't configured on this deployment, you can still enter as the demo fan.",
  },
  {
    question: "Is the demo data real?",
    answer:
      "No. Demo artists, fans, plays and activity are fictional and generated for the scoreboard. The demo fan resets each session and plays against a seeded universe of 6 artists and 48 fans across 120 days of scores.",
  },
  {
    question: "What happens when a season resets?",
    answer:
      "Leaderboards reset weekly (Monday 00:00 UTC), monthly (first of month) and yearly (January 1). Your all-time totals, streaks and badges carry over — only the period boards are wiped. Past period ranks are kept as snapshots so deltas remain visible.",
  },
  {
    question: "Is my data private?",
    answer:
      "Listening data belongs to you. Session identity is a signed JWT cookie — Spotify tokens are never placed in the session. There are no email/password accounts; identity is a Spotify account or the demo fan. No public profile is indexed unless you visit it directly.",
  },
];

export const metadata: Metadata = pageMetadata({
  title: "How it works",
  description:
    "How Ultfave scoring works: points, streaks, badges, challenges, the eight-minute cap and what happens when seasons reset.",
  path: "/how-it-works",
});

export default function HowItWorksPage() {
  return (
    <div className="flex flex-col gap-8 py-2 sm:py-4">
      <section aria-label="What Ultfave is" className="scroll-mt-24 space-y-4">
        <SectionHeader
          eyebrow="The board"
          title="Listening, turned into standing"
          description={
            <>
              Ultfave is a fan leaderboard for Spotify listeners. Connect Spotify, earn points for listening minutes,{" "}
              <br />
              distinct tracks and streaks, then climb weekly, monthly and yearly leaderboards for the artists you love.
            </>
          }
        />
        <p className="text-sm leading-relaxed text-muted">
          Points descend by total, then minutes, then user id for stability. Ties share a rank. No emoji, no light mode, no
          corporate dashboard — just a late-night scoreboard for people who take their favorite artists personally.
        </p>
      </section>

      <section aria-label="Scoring" className="scroll-mt-24 space-y-4">
        <SectionHeader
          eyebrow="Points"
          title="How the scoring works"
          description="Every play counts. The eight-minute cap keeps a single track from dominating the board."
        />
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: "Listening minutes", detail: "Every play adds its length, capped at 8 min per track." },
            { label: "New-track bonus", detail: "+10 per distinct track, per artist, per day (max 20 tracks)." },
            { label: "Daily activity", detail: "+5 points when you play anything that day." },
            { label: "Weekly challenges", detail: "Bonus points for hitting targets before the week ends." },
            { label: "Badges", detail: "First-blood, streaks, top-1, crate-digger, night-owl, rivalry, challenger." },
            { label: "Season resets", detail: "Weekly Monday, monthly 1st, yearly January 1 UTC." },
          ].map((item) => (
            <li key={item.label} className="panel p-4">
              <div className="font-display text-base font-semibold tracking-tight text-fg">
                {item.label}
              </div>
              <p className="mt-1 text-sm text-muted">{item.detail}</p>
            </li>
          ))}
        </ul>
      </section>

      <PointsCalculator />

      <section aria-label="FAQ" className="scroll-mt-24 space-y-4">
        <SectionHeader eyebrow="FAQ" title="Frequently asked questions" />
        <ul className="space-y-3">
          {FAQS.map(({ question, answer }, index) => (
            <li key={question} className="panel p-4">
              <p className="font-display text-sm font-semibold tracking-tight text-fg">
                Q{index + 1}. {question}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{answer}</p>
            </li>
          ))}
        </ul>
      </section>

      <EmptyState
        title="Still have questions?"
        description="Catch us on the activity feed or open a thread in the fandom. The board is public — the conversation is too."
        action={
          <Link href="/" className="btn btn-ghost">
            Back to the board
          </Link>
        }
      />
    </div>
  );
}
