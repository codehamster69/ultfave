import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession, isSpotifyConfigured } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Sign in — Ultfave",
  description:
    "Enter Ultfave as a Spotify listener or as a demo fan. Weekly, monthly and yearly artist leaderboards built from your listening.",
};

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const ERROR_MESSAGES: Record<string, string> = {
  spotify_not_configured:
    "Spotify sign-in is not configured on this deployment. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to enable it — the demo fan works without them.",
  access_denied: "Spotify sign-in was cancelled before it finished. Nothing was connected.",
  spotify_denied: "Spotify returned an error instead of an account. Start the sign-in again.",
  state_mismatch: "That sign-in link expired or was already used. Start the Spotify sign-in again.",
  spotify_exchange_failed:
    "Spotify rejected the token exchange. Check the app credentials and the redirect URI registered in the Spotify dashboard.",
  spotify_profile_failed: "Spotify authorized the app, but your profile could not be read. Try again.",
  account_failed: "Spotify authorized you, but the Ultfave account could not be saved. Try again.",
  session_failed: "You authorized, but the session cookie could not be set. Check SESSION_SECRET and try again.",
  demo_failed: "The demo fan could not be started. Check the database connection and try again.",
  unknown: "Sign-in failed. Try again, or enter as the demo fan.",
};

const SCORING = [
  {
    tag: "8 MIN CAP",
    title: "Minutes on repeat",
    detail: "Every play adds its length to your artist total, capped at eight minutes per track.",
  },
  {
    tag: "+10 / TRACK",
    title: "New-track bonus",
    detail: "Ten points per distinct track, per artist, per day — up to twenty tracks in the mix.",
  },
  {
    tag: "BONUS",
    title: "Challenges and badges",
    detail: "Show up daily for the extra five, then take weekly challenges for bonus points that move ranks.",
  },
];

const PREVIEW_BOARD = [
  { name: "Maya Okafor", handle: "mayawav", points: 1284 },
  { name: "Dev Raman", handle: "devloop", points: 1190 },
  { name: "Ines Park", handle: "inesonrepeat", points: 1043 },
];

const SEED_STATS = [
  { value: "48", label: "fans" },
  { value: "06", label: "artists" },
  { value: "120", label: "days of plays" },
];

/** Page-scoped ambience. Nothing here runs under prefers-reduced-motion. */
const LOGIN_MOTION = `
@keyframes ultfave-orb-a {
  0%, 100% { transform: translate3d(0, 0, 0) scale(1); opacity: 0.5; }
  50% { transform: translate3d(18px, -24px, 0) scale(1.12); opacity: 0.78; }
}
@keyframes ultfave-orb-b {
  0%, 100% { transform: translate3d(0, 0, 0) scale(1.04); opacity: 0.38; }
  50% { transform: translate3d(-22px, 16px, 0) scale(0.94); opacity: 0.66; }
}
@keyframes ultfave-sheen {
  0% { transform: translateX(-160%) skewX(-14deg); }
  55%, 100% { transform: translateX(260%) skewX(-14deg); }
}
.ultfave-orb-a { animation: ultfave-orb-a 19s ease-in-out infinite; }
.ultfave-orb-b { animation: ultfave-orb-b 25s ease-in-out infinite; }
.ultfave-sheen { animation: ultfave-sheen 6s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .ultfave-orb-a, .ultfave-orb-b, .ultfave-sheen { animation-name: none; }
}
`;

function SpotifyMark({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M7.3 9.2c3.3-1 6.6-.6 9.4 1" />
      <path d="M7.9 12.3c2.7-.8 5.3-.4 7.7 1" />
      <path d="M8.6 15.3c2-.5 4-.3 5.9.7" />
    </svg>
  );
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getSession();
  if (session) redirect("/me");

  const params = await searchParams;
  const rawError = Array.isArray(params.error) ? params.error[0] : params.error;
  const errorCode = typeof rawError === "string" && rawError.length > 0 ? rawError : null;
  const errorMessage = errorCode ? (ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.unknown) : null;
  const spotifyReady = isSpotifyConfigured();

  return (
    <div className="rise relative overflow-hidden rounded-[1.5rem] border border-line bg-panel/50">
      <style>{LOGIN_MOTION}</style>

      <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative order-2 px-5 py-9 sm:px-9 sm:py-12 lg:order-1 lg:py-14">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(64,40,58,0.55) 1px, transparent 1px), linear-gradient(to bottom, rgba(64,40,58,0.4) 1px, transparent 1px)",
              backgroundSize: "64px 64px",
              maskImage: "radial-gradient(110% 80% at 0% 0%, #000 12%, transparent 74%)",
              WebkitMaskImage: "radial-gradient(110% 80% at 0% 0%, #000 12%, transparent 74%)",
            }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-24 top-8 h-64 w-64 rounded-full bg-lime/10 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-28 right-0 h-64 w-64 rounded-full bg-peri/10 blur-3xl"
          />

          <div className="relative">
            <p className="flex items-center gap-3 font-mono text-[0.62rem] uppercase tracking-[0.28em] text-muted">
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-lime" aria-hidden="true" />
              Sign in <span aria-hidden="true">/</span> 2026 season
            </p>

            <h1 className="mt-6 font-display text-[2.6rem] leading-[0.9] tracking-tight text-fg sm:text-6xl lg:text-[4rem]">
              PROVE YOU&apos;RE
              <br />
              THE <span className="text-lime">TOP FAN.</span>
            </h1>

            <p className="mt-5 max-w-md text-sm leading-relaxed text-muted sm:text-[0.95rem]">
              Ultfave turns your listening into a fight for rank. Every artist you play has a board:
              weekly, monthly, yearly. Every minute you put in is a point someone else has to chase.
            </p>

            <div className="mt-8">
              <p className="font-mono text-[0.58rem] uppercase tracking-[0.24em] text-muted">
                How points land
              </p>
              <ul className="mt-3.5 grid gap-2.5">
                {SCORING.map((item, index) => (
                  <li
                    key={item.tag}
                    className="flex items-start gap-3.5 rounded-xl border border-line/70 bg-ink/30 px-3.5 py-3 transition-colors hover:border-line"
                  >
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-lime/25 bg-lime/10 font-mono text-[0.58rem] text-lime">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="text-sm font-medium text-fg">{item.title}</p>
                        <span className="rounded border border-lime/25 px-1.5 py-0.5 font-mono text-[0.5rem] uppercase tracking-[0.12em] text-lime/80">
                          {item.tag}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted">{item.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8 border-t border-line/80 pt-5">
              <p className="font-mono text-[0.55rem] uppercase tracking-[0.22em] text-muted">
                Inside the demo universe
              </p>
              <div className="mt-3 grid max-w-sm grid-cols-3 gap-3">
                {SEED_STATS.map((stat) => (
                  <div key={stat.label}>
                    <p className="num text-xl leading-none text-fg sm:text-2xl">{stat.value}</p>
                    <p className="mt-1 font-mono text-[0.5rem] uppercase tracking-[0.16em] text-muted">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-3 max-w-md text-xs leading-relaxed text-muted">
                Invented fans, artists and four months of listening — same boards, same scoring,
                same rivalries as the live mode.
              </p>
            </div>
          </div>
        </section>

        <aside className="relative order-1 flex items-center justify-center overflow-hidden border-b border-line/80 px-5 py-9 sm:px-8 sm:py-12 lg:order-2 lg:border-b-0 lg:border-l lg:py-14">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(64,40,58,0.6) 1px, transparent 1px), linear-gradient(to bottom, rgba(64,40,58,0.45) 1px, transparent 1px)",
              backgroundSize: "72px 72px",
              maskImage: "radial-gradient(120% 90% at 70% 0%, #000 20%, transparent 72%)",
              WebkitMaskImage: "radial-gradient(120% 90% at 70% 0%, #000 20%, transparent 72%)",
            }}
          />
          <div
            aria-hidden="true"
            className="ultfave-orb-a pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-lime/15 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="ultfave-orb-b pointer-events-none absolute -bottom-24 -left-12 h-60 w-60 rounded-full bg-peri/20 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-10 top-10 h-40 rounded-full bg-lime/5 blur-2xl"
          />

          <div className="relative w-full max-w-sm">
            <div className="relative overflow-hidden rounded-[1.35rem] border border-white/10 bg-panel2/55 p-5 shadow-[0_36px_90px_-48px_rgba(0,0,0,0.95)] backdrop-blur-xl sm:p-6">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-lime/60 to-transparent"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-10%,rgba(255,82,54,0.1),transparent_62%)]"
              />

              <div className="relative">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-[0.55rem] uppercase tracking-[0.24em] text-muted">
                    Fan access
                  </p>
                  <span className="flex items-center gap-1.5 font-mono text-[0.5rem] uppercase tracking-[0.18em] text-lime/80">
                    <span className="live-dot h-1 w-1 rounded-full bg-lime" aria-hidden="true" />
                    Open
                  </span>
                </div>

                <h2 className="mt-2.5 font-display text-2xl font-semibold leading-tight tracking-tight text-fg">
                  Enter the board
                </h2>
                <p className="mt-1.5 text-[0.82rem] leading-relaxed text-muted">
                  One tap, no password. A demo session starts instantly and stays on this device.
                </p>

                {errorMessage ? (
                  <div
                    role="alert"
                    className="rise mt-4 rounded-xl border border-magenta/40 bg-magenta/10 px-3.5 py-3"
                  >
                    <p className="font-mono text-[0.55rem] uppercase tracking-[0.22em] text-magenta">
                      Sign-in problem
                    </p>
                    <p className="mt-1.5 text-[0.8rem] leading-relaxed text-fg">{errorMessage}</p>
                  </div>
                ) : null}

                <div className="mt-5 flex flex-col gap-3">
                  <form action="/api/auth/demo" method="post">
                    <button
                      type="submit"
                      className="btn btn-primary relative w-full overflow-hidden py-4 text-[0.95rem] tracking-wide shadow-[0_0_0_1px_rgba(255,82,54,0.5),0_18px_48px_-20px_rgba(255,82,54,0.9)] transition-[transform,box-shadow,background] duration-200 hover:-translate-y-px hover:shadow-[0_0_0_1px_rgba(255,82,54,0.75),0_22px_58px_-18px_rgba(255,82,54,1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
                    >
                      <span
                        aria-hidden="true"
                        className="ultfave-sheen pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                      />
                      <span className="relative flex items-center justify-center gap-2">
                        Enter as demo fan
                        <svg
                          viewBox="0 0 12 12"
                          className="h-3.5 w-3.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M2.5 6h7M6.5 3 9.5 6l-3 3" />
                        </svg>
                      </span>
                    </button>
                  </form>

                  {spotifyReady ? (
                    <a
                      href="/api/auth/spotify"
                      className="btn btn-ghost w-full py-4 text-[0.95rem] transition-colors hover:border-lime/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
                    >
                      <SpotifyMark className="h-4 w-4 text-lime" />
                      Continue with Spotify
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      aria-describedby="spotify-note"
                      className="btn btn-ghost w-full py-4 text-[0.95rem]"
                    >
                      <SpotifyMark className="h-4 w-4 text-muted" />
                      Continue with Spotify
                      <span className="ml-auto rounded-full border border-line px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-[0.14em] text-muted">
                        Off
                      </span>
                    </button>
                  )}

                  <p id="spotify-note" className="text-[0.72rem] leading-relaxed text-muted">
                    {spotifyReady
                      ? "Spotify sign-in imports your recently played tracks and keeps the board fresh. Ultfave never posts anything."
                      : "Spotify sign-in is off in this deployment. Add SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET and SPOTIFY_REDIRECT_URI to switch it on."}
                  </p>
                </div>

                <div className="mt-5 flex items-center justify-between gap-3 border-t border-line/70 pt-3 font-mono text-[0.5rem] uppercase tracking-[0.16em] text-muted">
                  <span>Demo data is fictional</span>
                  <span>Season 2026</span>
                </div>
              </div>
            </div>

            <div className="hidden rounded-[1.15rem] border border-line/70 bg-ink/30 p-4 backdrop-blur-sm lg:block">
              <div className="flex items-center justify-between gap-3 font-mono text-[0.5rem] uppercase tracking-[0.18em] text-muted">
                <span>Preview board</span>
                <span>Week 46 · demo</span>
              </div>
              <p className="mt-3 font-display text-sm font-semibold tracking-tight text-fg/85">
                NOVA KESTREL
              </p>
              <div className="mt-2 border-t border-line/60">
                {PREVIEW_BOARD.map((fan, index) => (
                  <div
                    key={fan.handle}
                    className="flex items-baseline justify-between gap-3 border-b border-line/50 py-2"
                  >
                    <span className="flex min-w-0 items-baseline gap-2.5">
                      <span
                        className={`num text-[0.68rem] ${index === 0 ? "text-gold" : "text-muted/60"}`}
                      >
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="truncate text-[0.72rem] text-fg/85">{fan.name}</span>
                    </span>
                    <span
                      className={`num shrink-0 text-[0.72rem] ${index === 0 ? "text-lime" : "text-fg/70"}`}
                    >
                      {fan.points.toLocaleString("en-US")}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-2.5 text-[0.62rem] leading-relaxed text-muted">
                Invented fans, four months of plays, the same scoring as the live board.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
