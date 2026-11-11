/**
 * Edge middleware: Content-Security-Policy + cross-site request guard.
 *
 * CSP decision (pragmatic, documented on purpose):
 * - Next 15 streams RSC payloads through inline <script> tags and the App Router
 *   emits inline bootstrap scripts on every page. A nonce-based policy forces
 *   every route into dynamic rendering and breaks static optimization, so we
 *   ship a policy with `script-src 'self' 'unsafe-inline'` instead of a strict
 *   nonce policy that would break the build/render. `object-src 'none'`,
 *   `base-uri 'self'`, `frame-ancestors 'none'` and a tight `connect-src` still
 *   block the classic exfiltration/injection paths, and the app never renders
 *   user HTML (no dangerouslySetInnerHTML), so inline-script risk is bounded.
 * - `style-src 'unsafe-inline'` is required by motion/three inline styles, the
 *   Next font loader and the per-page <style> blocks.
 * - WebGL/three runs in-page (no workers, no eval outside dev), and images come
 *   from next/image (same origin) plus the i.scdn.co / mosaic.scdn.co /
 *   images.unsplash.com / api.dicebear.com remote patterns.
 * - `'unsafe-eval'` and ws: are development-only (webpack HMR / react-refresh).
 *   `upgrade-insecure-requests` is production-only so local http:// stays usable.
 *
 * The static header set lives in next.config.mjs; CSP lives here because it
 * needs the request mode (dev vs prod) and is easier to evolve centrally.
 */
import { NextResponse, type NextRequest } from "next/server";

const DEV = process.env.NODE_ENV !== "production";

const CSP_DIRECTIVES = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "form-action 'self'",
  `script-src 'self' 'unsafe-inline'${DEV ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://i.scdn.co https://mosaic.scdn.co https://images.unsplash.com https://api.dicebear.com",
  "font-src 'self' data:",
  `connect-src 'self'${DEV ? " ws: wss:" : ""}`,
  "media-src 'self'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  ...(DEV ? [] : ["upgrade-insecure-requests"]),
];

const CONTENT_SECURITY_POLICY = CSP_DIRECTIVES.join("; ");

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function isCrossSiteRequest(request: NextRequest): boolean {
  // Browsers label the request context; "cross-site" is the only value we block
  // (same-site subdomains stay allowed so custom domains keep working).
  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site") return true;

  const origin = request.headers.get("origin");
  if (!origin) return false; // curl, server-to-server cron, same-origin form fallbacks
  if (origin === "null") return true;

  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return true;
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  const allowed = new Set(
    [request.headers.get("host"), forwardedHost?.split(",")[0]?.trim()]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.toLowerCase()),
  );
  if (allowed.size === 0) return false;
  return !allowed.has(originHost);
}

function crossSiteBlocked(): NextResponse {
  return NextResponse.json(
    { ok: false, error: "Cross-origin request blocked." },
    { status: 403, headers: { "Cache-Control": "no-store" } },
  );
}

function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return response;
}

export function middleware(request: NextRequest): NextResponse {
  if (UNSAFE_METHODS.has(request.method) && isCrossSiteRequest(request)) {
    return applySecurityHeaders(crossSiteBlocked());
  }

  const response = NextResponse.next();
  return applySecurityHeaders(response);
}

export const config = {
  matcher: [
    // Everything except Next build output and static asset files. API routes are
    // included so the cross-site guard covers every state-changing endpoint.
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|txt|xml|woff|woff2|ttf|otf|map)$).*)",
  ],
};
