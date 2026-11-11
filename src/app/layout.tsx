import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Bricolage_Grotesque, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import { Logo } from "@/components/logo";
import { SiteNav } from "@/components/site-nav";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_URL,
  absoluteUrl,
  jsonLdScript,
  organizationLd,
  websiteLd,
} from "@/lib/seo";
import "./globals.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const sans = Instrument_Sans({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(absoluteUrl("/")),
  title: {
    default: `${SITE_NAME} - Fan leaderboards for Spotify listeners`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: SITE_URL ? { canonical: "/" } : undefined,
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/brand/app-icon.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    title: `${SITE_NAME} - ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    siteName: SITE_NAME,
    type: "website",
    locale: "en_US",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} - ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  themeColor: "#150a12",
  colorScheme: "dark",
};

const FOOTER_LINKS: { href: string; label: string }[] = [
  { href: "/", label: "Home" },
  { href: "/friends", label: "Friends" },
  { href: "/activity", label: "Activity" },
  { href: "/me", label: "Me" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/cards", label: "Fan cards" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="relative">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript([organizationLd(), websiteLd()]) }}
        />
        {/* Cinematic backdrop — fixed, inert, never intercepts input. */}
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-0 bg-ink" />
          <div
            className="aurora-blob left-[-18%] top-[-24%] h-[46rem] w-[46rem]"
            style={{
              background:
                "radial-gradient(closest-side, rgba(255,82,54,0.16), rgba(255,82,54,0.04) 55%, transparent 72%)",
            }}
          />
          <div
            className="aurora-blob aurora-blob-b right-[-20%] top-[-18%] h-[52rem] w-[52rem]"
            style={{
              background:
                "radial-gradient(closest-side, rgba(147,167,255,0.19), rgba(147,167,255,0.05) 55%, transparent 74%)",
            }}
          />
          <div
            className="aurora-blob aurora-blob-c bottom-[-30%] left-[22%] h-[44rem] w-[44rem]"
            style={{
              background:
                "radial-gradient(closest-side, rgba(242,65,124,0.12), rgba(242,65,124,0.03) 55%, transparent 74%)",
            }}
          />
          <div
            className="grid-lines absolute inset-0 opacity-[0.45]"
            style={{
              maskImage: "radial-gradient(120% 85% at 50% -10%, #000 18%, transparent 72%)",
              WebkitMaskImage: "radial-gradient(120% 85% at 50% -10%, #000 18%, transparent 72%)",
            }}
          />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-lime/30 to-transparent" />
        </div>

        {/* Film grain over everything, purely cosmetic. */}
        <div
          aria-hidden="true"
          className="bg-grain pointer-events-none fixed inset-0 z-[60] opacity-[0.035] mix-blend-soft-light"
        />

        {/* Scroll-linked accent; disappears entirely where scroll-timeline is unsupported. */}
        <div aria-hidden="true" className="scroll-progress" />

        <a href="#main" className="skip-link">
          Skip to content
        </a>

        <SiteNav />

        <main
          id="main"
          className="relative mx-auto w-full max-w-6xl px-4 pb-24 pt-6 sm:px-6 sm:pt-8"
        >
          {children}
        </main>

        <footer className="relative mt-6 border-t border-line/80">
          <div aria-hidden="true" className="divider-glow absolute inset-x-0 top-0 opacity-60" />
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto] md:gap-8">
            <div className="min-w-0">
              <Link
                href="/"
                className="group inline-flex items-center gap-2.5"
                aria-label={`${SITE_NAME} home`}
              >
                <Logo markClassName="h-6 w-6" wordmarkClassName="h-[1.05rem] w-auto" />
              </Link>
              <p className="mt-3 max-w-[34ch] text-sm leading-relaxed text-muted">
                A late-night scoreboard for people who take their favorite artists personally.
                Minutes, crate depth and streaks decide the ranking.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="chip border-lime/25 bg-lime/[0.05] text-lime">
                  <span aria-hidden="true" className="live-dot h-1.5 w-1.5 rounded-full bg-lime" />
                  Live index
                </span>
                <span className="chip">demo data is fictional</span>
              </div>
            </div>

            <nav aria-label="Footer" className="min-w-0">
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.24em] text-muted">Boards</p>
              <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2">
                {FOOTER_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-fg/80 transition-colors hover:text-lime"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link
                    href="/login"
                    className="text-sm text-fg/80 transition-colors hover:text-lime"
                  >
                    Sign in
                  </Link>
                </li>
                <li>
                  <Link
                    href="/#artists"
                    className="text-sm text-fg/80 transition-colors hover:text-lime"
                  >
                    Artists
                  </Link>
                </li>
              </ul>
            </nav>

            <div className="min-w-0 md:max-w-[15rem]">
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.24em] text-muted">
                Data note
              </p>
              <p className="mt-3 text-xs leading-relaxed text-muted">
                Listening data belongs to you. Demo accounts and their play history are fictional
                and generated for the scoreboard.
              </p>
            </div>
          </div>

          <div className="border-t border-line/60">
            <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-5 sm:px-6">
              <p className="font-mono text-[0.58rem] uppercase tracking-[0.2em] text-muted">
                Ultfave · built for the late-night scoreboard
              </p>
              <p className="font-mono text-[0.58rem] uppercase tracking-[0.2em] text-muted">
                points desc · minutes tiebreak
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
