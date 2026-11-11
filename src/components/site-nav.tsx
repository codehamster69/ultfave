import Link from "next/link";
import { getSession } from "@/lib/auth";
import { Avatar } from "@/components/ui";
import { MobileMenu, NavLinks, type NavItem, type NavViewer } from "@/components/nav-mobile";

const LINKS: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/friends", label: "Friends" },
  { href: "/activity", label: "Activity" },
  { href: "/me", label: "Me" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/cards", label: "Fan cards" },
];

export async function SiteNav() {
  const user = await getSession();

  // Only serialisable fields cross the server/client boundary.
  const viewer: NavViewer = user
    ? {
        name: user.name,
        handle: user.handle,
        avatarUrl: user.avatarUrl,
        isDemo: user.isDemo,
      }
    : null;

  return (
    <header className="sticky top-0 z-50 border-b border-line/70 bg-ink/70 backdrop-blur-xl backdrop-saturate-150">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-lime/25 to-transparent"
      />

      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-4 sm:h-16 sm:gap-4 sm:px-6">
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-2.5"
          aria-label="Ultfave home"
        >
          <span aria-hidden="true" className="relative block h-6 w-[13px]">
            <span className="absolute inset-y-0 left-[7px] w-[5px] -skew-x-[18deg] rounded-[1px] bg-magenta/35 blur-[1.5px] transition-transform duration-300 group-hover:translate-x-[2px]" />
            <span className="absolute inset-y-0 left-0 w-[6px] -skew-x-[18deg] rounded-[1px] bg-lime shadow-[0_0_20px_rgba(255,82,54,0.55)] transition-transform duration-300 group-hover:-translate-x-[1px]" />
          </span>
          <span className="font-display text-[0.95rem] font-semibold leading-none tracking-[0.24em] text-fg transition-colors group-hover:text-lime sm:text-base">
            ULTFAVE
          </span>
        </Link>

        <span aria-hidden="true" className="ml-1 hidden h-5 w-px bg-line lg:block" />
        <span className="hidden font-mono text-[0.53rem] uppercase leading-tight tracking-[0.2em] text-muted lg:block">
          who really runs
          <br />
          the fandom
        </span>

        <nav
          aria-label="Primary"
          className="ml-1 hidden min-w-0 flex-1 items-center gap-0.5 md:flex"
        >
          <NavLinks links={LINKS} />
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {user ? (
            <>
              <Link
                href="/me"
                className="group hidden items-center gap-2 rounded-full border border-line bg-panel/60 py-1 pl-1 pr-2.5 transition-colors duration-200 hover:border-lime/40 hover:bg-panel2/80 md:flex"
                title={`Signed in as ${user.name}`}
              >
                <Avatar
                  name={user.name}
                  src={user.avatarUrl}
                  size={28}
                  status={user.isDemo ? "peri" : "lime"}
                  statusLabel={user.isDemo ? "demo account" : "signed in"}
                />
                <span className="hidden min-w-0 max-w-[9.5rem] sm:block">
                  <span className="block truncate text-[0.78rem] font-medium leading-tight text-fg">
                    {user.name}
                  </span>
                  <span className="block truncate font-mono text-[0.52rem] uppercase tracking-[0.16em] text-muted">
                    @{user.handle}
                  </span>
                </span>
              </Link>
              <form action="/api/auth/logout" method="post" className="hidden md:block">
                <button
                  type="submit"
                  className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border border-line px-2.5 py-1.5 font-mono text-[0.58rem] uppercase tracking-[0.16em] text-muted transition-colors hover:border-magenta/50 hover:text-fg"
                >
                  <svg
                    viewBox="0 0 12 12"
                    className="h-2.5 w-2.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <path d="M7 2.5H3.5A1.5 1.5 0 0 0 2 4v4a1.5 1.5 0 0 0 1.5 1.5H7M8.5 4 10.5 6l-2 2M5 6h5.5" />
                  </svg>
                  Log out
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="btn btn-primary hidden px-3.5 py-1.5 text-[0.82rem] sm:inline-flex"
            >
              Sign in
            </Link>
          )}

          <MobileMenu links={LINKS} viewer={viewer} />
        </div>
      </div>
    </header>
  );
}
