import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getAuthorizeUrl, isSpotifyConfigured } from "@/lib/spotify";
import { RATE_LIMITS, enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const OAUTH_STATE_COOKIE = "ultfave_oauth_state";
const OAUTH_STATE_MAX_AGE = 60 * 10; // 10 minutes

export async function GET(request: NextRequest): Promise<NextResponse> {
  const limited = enforceRateLimit(request, RATE_LIMITS.authStart);
  if (limited) return limited;

  if (!isSpotifyConfigured()) {
    return NextResponse.redirect(new URL("/login?error=spotify_not_configured", request.nextUrl.origin));
  }

  // 128 bits of CSPRNG entropy; the callback compares this value in constant time.
  const state = randomUUID();
  const authorizeUrl = getAuthorizeUrl(state);
  const response = NextResponse.redirect(authorizeUrl);

  response.cookies.set({
    name: OAUTH_STATE_COOKIE,
    value: state,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: OAUTH_STATE_MAX_AGE,
    priority: "high",
  });

  // The authorize URL is external and must never be cached.
  response.headers.set("Cache-Control", "no-store");

  return response;
}
