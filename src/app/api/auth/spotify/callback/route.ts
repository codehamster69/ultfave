import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { get, run } from "@/lib/db";
import { isSpotifyConfigured, setSession } from "@/lib/auth";
import { exchangeCode, fetchSpotifyProfile } from "@/lib/spotify";
import { syncUserPlays } from "@/lib/ingest";
import { resolveAppOrigin } from "@/lib/env";
import { RATE_LIMITS, enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const OAUTH_STATE_COOKIE = "ultfave_oauth_state";

type UserRow = {
  id: string;
  displayName: string;
  handle: string;
  avatarUrl: string | null;
};

const HANDLE_MAX = 18;
const MAX_SPOTIFY_ID_LENGTH = 128;
const MAX_DISPLAY_NAME_LENGTH = 80;

/** Query parameters are attacker controlled: validate before they are used. */
const querySchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(1024)
    .regex(/^[\x20-\x7E]+$/, "invalid characters")
    .optional(),
  state: z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z0-9-]+$/, "invalid characters")
    .optional(),
  error: z.string().trim().max(64).optional(),
});

/** Constant-time string comparison (hashing first keeps both buffers equal length). */
function safeEqual(a: string, b: string): boolean {
  const left = createHash("sha256").update(a, "utf8").digest();
  const right = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(left, right);
}

function sanitizeAvatarUrl(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (raw.length === 0 || raw.length > 512) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function slugifyHandle(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, HANDLE_MAX)
    .replace(/-+$/g, "");
  return base.length > 0 ? base : "ult";
}

function shortSuffix(): string {
  return randomUUID().replace(/-/g, "").slice(0, 4);
}

async function uniqueHandle(name: string): Promise<string> {
  const base = slugifyHandle(name);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base.slice(0, HANDLE_MAX - 5)}-${shortSuffix()}`;
    const clash = await get<{ id: string }>(`SELECT id FROM users WHERE handle = ? LIMIT 1`, [candidate]);
    if (!clash) return candidate;
  }

  return `${base.slice(0, HANDLE_MAX - 7)}-${Date.now().toString(36).slice(-6)}`;
}

function clearStateCookie(response: NextResponse): void {
  response.cookies.set({
    name: OAUTH_STATE_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  response.headers.set("Cache-Control", "no-store");
}

/**
 * Redirects back to /login with a coarse error code. The origin comes from
 * config (NEXT_PUBLIC_APP_URL) so a spoofed Host header cannot turn the callback
 * into an open redirect, and nothing from Spotify is echoed back.
 */
function fail(request: NextRequest, code: string): NextResponse {
  const target = new URL("/login", resolveAppOrigin(request.nextUrl.origin));
  target.searchParams.set("error", code);
  const response = NextResponse.redirect(target);
  clearStateCookie(response);
  return response;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const limited = enforceRateLimit(request, RATE_LIMITS.authCallback);
  if (limited) return limited;

  if (!isSpotifyConfigured()) {
    return fail(request, "spotify_not_configured");
  }

  const rawParams = request.nextUrl.searchParams;
  const parsedQuery = querySchema.safeParse({
    code: rawParams.get("code") ?? undefined,
    state: rawParams.get("state") ?? undefined,
    error: rawParams.get("error") ?? undefined,
  });
  if (!parsedQuery.success) {
    return fail(request, "state_mismatch");
  }

  const { code, state, error: oauthError } = parsedQuery.data;
  if (oauthError) {
    return fail(request, oauthError === "access_denied" ? "access_denied" : "spotify_denied");
  }

  const expectedState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
  if (!code || !state || !expectedState || !safeEqual(state, expectedState)) {
    return fail(request, "state_mismatch");
  }

  let tokens: { accessToken: string; refreshToken: string; expiresIn: number };
  try {
    tokens = await exchangeCode(code);
  } catch {
    return fail(request, "spotify_exchange_failed");
  }

  let profile: { id: string; displayName: string; avatarUrl: string | null; country: string | null };
  try {
    profile = await fetchSpotifyProfile(tokens.accessToken);
  } catch {
    return fail(request, "spotify_profile_failed");
  }

  const spotifyId = profile.id?.trim().slice(0, MAX_SPOTIFY_ID_LENGTH);
  if (!spotifyId) {
    return fail(request, "spotify_profile_failed");
  }

  const displayName =
    (profile.displayName ?? "").trim().slice(0, MAX_DISPLAY_NAME_LENGTH) || "Spotify Fan";
  const avatarUrl = sanitizeAvatarUrl(profile.avatarUrl);
  const country = profile.country?.trim().slice(0, 8) || null;
  const tokenExpiresAt = Math.floor(Date.now() / 1000) + Math.max(0, Math.floor(tokens.expiresIn));

  let user: UserRow;
  try {
    const existing = await get<UserRow>(
      `SELECT id, display_name AS "displayName", handle, avatar_url AS "avatarUrl"
       FROM users WHERE spotify_id = ? LIMIT 1`,
      [spotifyId],
    );

    if (existing) {
      user = {
        id: existing.id,
        displayName,
        handle: existing.handle,
        avatarUrl: avatarUrl ?? existing.avatarUrl,
      };
      await run(
        `UPDATE users
         SET display_name = ?,
             avatar_url = COALESCE(?, avatar_url),
             country = COALESCE(?, country),
             spotify_access_token = ?,
             spotify_refresh_token = ?,
             token_expires_at = ?
         WHERE id = ?`,
        [
          displayName,
          avatarUrl,
          country,
          tokens.accessToken,
          tokens.refreshToken,
          tokenExpiresAt,
          existing.id,
        ],
      );
    } else {
      const handle = await uniqueHandle(displayName);
      const newUserId = `sp_${spotifyId}`;
      user = {
        id: newUserId,
        displayName,
        handle,
        avatarUrl,
      };
      await run(
        `INSERT INTO users
           (id, spotify_id, display_name, handle, avatar_url, country, is_demo,
            spotify_access_token, spotify_refresh_token, token_expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           spotify_id = excluded.spotify_id,
           display_name = excluded.display_name,
           avatar_url = COALESCE(excluded.avatar_url, users.avatar_url),
           country = COALESCE(excluded.country, users.country),
           spotify_access_token = excluded.spotify_access_token,
           spotify_refresh_token = excluded.spotify_refresh_token,
           token_expires_at = excluded.token_expires_at`,
        [
          newUserId,
          spotifyId,
          displayName,
          handle,
          avatarUrl,
          country,
          tokens.accessToken,
          tokens.refreshToken,
          tokenExpiresAt,
          new Date().toISOString(),
        ],
      );
    }
  } catch {
    return fail(request, "account_failed");
  }

  try {
    // Always mint a brand-new session (fresh jti/iat) after a successful OAuth
    // exchange: an existing cookie is replaced, never adopted (no fixation).
    await setSession({
      id: user.id,
      name: user.displayName,
      handle: user.handle,
      avatarUrl: user.avatarUrl,
      isDemo: false,
    });
  } catch {
    return fail(request, "session_failed");
  }

  // Import listening history in the background; never block or break the redirect.
  try {
    void syncUserPlays(user.id).catch(() => undefined);
  } catch {
    // ignored on purpose
  }

  const response = NextResponse.redirect(
    new URL("/me?welcome=1", resolveAppOrigin(request.nextUrl.origin)),
  );
  clearStateCookie(response);
  return response;
}
