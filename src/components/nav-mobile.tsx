"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/ui";

export type NavItem = { href: string; label: string };

export type NavViewer = {
  name: string;
  handle: string;
  avatarUrl: string | null;
  isDemo: boolean;
} | null;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Desktop links with an active marker. Kept client-side only for usePathname. */
export function NavLinks({ links }: { links: NavItem[] }) {
  const pathname = usePathname() ?? "/";

  return (
    <>
      {links.map((link) => {
        const active = isActive(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            data-active={active ? "true" : undefined}
            aria-current={active ? "page" : undefined}
            className="nav-link"
          >
            {link.label}
          </Link>
        );
      })}
    </>
  );
}

export function MobileMenu({ links, viewer }: { links: NavItem[]; viewer: NavViewer }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? "/";
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // A route change always dismisses the sheet.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Escape closes and returns focus; widening past md closes silently.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onResize = () => {
      if (window.innerWidth >= 768) setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  // Lock the page behind the sheet, compensating for the scrollbar width.
  useEffect(() => {
    if (!open) return;

    const body = document.body;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;

    panelRef.current?.querySelector<HTMLElement>("a, button")?.focus({ preventScroll: true });

    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPadding;
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((value) => !value)}
        className="relative inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line bg-panel/60 text-fg transition-colors hover:border-lime/40 hover:text-lime md:hidden"
      >
        <span aria-hidden="true" className="relative block h-3 w-4">
          <span
            className={`absolute left-0 block h-px w-full bg-current transition-all duration-200 ${
              open ? "top-1.5 rotate-45" : "top-0"
            }`}
          />
          <span
            className={`absolute left-0 top-1.5 block h-px w-full bg-current transition-opacity duration-200 ${
              open ? "opacity-0" : "opacity-100"
            }`}
          />
          <span
            className={`absolute left-0 block h-px w-full bg-current transition-all duration-200 ${
              open ? "top-1.5 -rotate-45" : "top-3"
            }`}
          />
        </span>
      </button>

      {open ? (
        <>
          <div
            aria-hidden="true"
            onClick={() => setOpen(false)}
            className="absolute inset-x-0 top-full z-40 h-[140dvh] cursor-default bg-ink/50 md:hidden"
          />
          <div
            id="mobile-menu"
            ref={panelRef}
            className="menu-in absolute inset-x-0 top-full z-50 overflow-hidden border-b border-line bg-ink md:hidden"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-lime/40 to-transparent"
            />
            <nav aria-label="Mobile" className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6">
              <ul className="grid gap-0.5">
                {links.map((link, index) => {
                  const active = isActive(pathname, link.href);
                  return (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        onClick={() => setOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                          active
                            ? "bg-lime/[0.07] text-lime"
                            : "text-fg/85 hover:bg-panel2/70 hover:text-fg"
                        }`}
                      >
                        <span className="flex items-baseline gap-3">
                          <span className="num text-[0.58rem] text-muted">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span className="font-display text-base tracking-tight">{link.label}</span>
                        </span>
                        {active ? (
                          <span className="font-mono text-[0.55rem] uppercase tracking-[0.2em] text-lime">
                            here
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-3 border-t border-line/80 pt-3">
                {viewer ? (
                  <div className="flex items-center gap-3">
                    <Link
                      href="/me"
                      onClick={() => setOpen(false)}
                      className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-line bg-panel/70 p-2 transition-colors hover:border-lime/40"
                      title={`Signed in as ${viewer.name}`}
                    >
                      <Avatar
                        name={viewer.name}
                        src={viewer.avatarUrl}
                        size={36}
                        status={viewer.isDemo ? "peri" : "lime"}
                        statusLabel={viewer.isDemo ? "demo account" : "signed in"}
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-[0.85rem] font-medium text-fg">
                          {viewer.name}
                        </span>
                        <span className="block truncate font-mono text-[0.58rem] uppercase tracking-[0.16em] text-muted">
                          @{viewer.handle}
                        </span>
                      </span>
                      <span
                        aria-hidden="true"
                        className="ml-auto font-mono text-xs text-muted"
                      >
                        &rarr;
                      </span>
                    </Link>
                    <form action="/api/auth/logout" method="post" className="shrink-0">
                      <button
                        type="submit"
                        className="cursor-pointer whitespace-nowrap rounded-full border border-line px-3 py-2 font-mono text-[0.58rem] uppercase tracking-[0.16em] text-muted transition-colors hover:border-magenta/50 hover:text-fg"
                      >
                        Log out
                      </button>
                    </form>
                  </div>
                ) : (
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="btn btn-primary w-full"
                  >
                    Sign in
                  </Link>
                )}
              </div>
            </nav>
          </div>
        </>
      ) : null}
    </>
  );
}
