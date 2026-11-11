import { randomUUID } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { getSessionSecret } from "@/lib/env";
import type { SessionUser } from "@/lib/types";

/**
 * Session model
 * -------------
 * The cookie is a short, signed JWT carrying only the public profile fields the
 * UI needs plus the authoritative user id in `sub`. OAuth access/refresh tokens
 * are never placed in the session; they live in the users table only.
 *
 * Hardening notes:
 * - `aud` + `iss` + `alg` are all verified, so a token minted for another purpose
 *   (or with `alg: none`) is rejected.
 * - In production the cookie uses the `__Host-` prefix (requires Secure, path=/,
 *   no Domain), which stops a sibling subdomain from planting a session cookie.
 * - Every call to setSession mints a fresh `jti`/`iat`, so a pre-login cookie can
 *   never be "carried over" into an authenticated session (no fixation).
 * - A missing/weak SESSION_SECRET fails closed in production: no cookie can be
 *   signed with a publicly known fallback secret.
 */

const BASE_COOKIE = "ultfave_session";
const LEGACY_COOKIE = BASE_COOKIE;
const SESSION_ISSUER = "ultfave";
const SESSION_AUDIENCE = "ultfave:web";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days, in seconds

/** Caps so a hostile cookie/token cannot bloat responses or headers. */
const MAX_ID_LENGTH = 128;
const MAX_NAME_LENGTH = 80;
const MAX_HANDLE_LENGTH = 40;
const MAX_AVATAR_LENGTH = 512;

const ID_PATTERN = /^[A-Za-z0-9._:@-]+$/;

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function sessionCookieName(): string {
  return isProduction() ? `__Host-${BASE_COOKIE}` : BASE_COOKIE;
}

function readString(value: unknown, maxLength: number, pattern?: RegExp): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) return null;
  if (pattern && !pattern.test(trimmed)) return null;
  return trimmed;
}

function readAvatar(value: unknown): string | null {
  const raw = readString(value, MAX_AVATAR_LENGTH);
  if (!raw) return null;
  // Only absolute https URLs survive; anything else (javascript:, data:, junk)
  // is dropped rather than handed to <img>/next-image.
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Returns the signing key, or null when production config is unusable. */
function secretKey(): Uint8Array | null {
  const secret = getSessionSecret();
  if (!secret) return null;
  return new TextEncoder().encode(secret);
}

async function readSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const candidates = isProduction()
    ? [store.get(sessionCookieName())?.value]
    : [store.get(sessionCookieName())?.value, store.get(LEGACY_COOKIE)?.value];

  const token = candidates.find((value): value is string => Boolean(value && value.length > 0));
  if (!token) return null;

  const key = secretKey();
  if (!key) {
    // Misconfigured production deployment: fail closed, never verify against a
    // fallback secret. /api/health reports the missing variable.
    return null;
  }

  try {
    const { payload, protectedHeader } = await jwtVerify(token, key, {
      algorithms: ["HS256"],
      issuer: SESSION_ISSUER,
      audience: SESSION_AUDIENCE,
      requiredClaims: ["sub", "iss", "aud", "exp", "iat"],
      clockTolerance: 5,
      maxTokenAge: SESSION_MAX_AGE,
    });

    if (protectedHeader.typ !== undefined && protectedHeader.typ !== "JWT") return null;

    const id = readString(payload.sub, MAX_ID_LENGTH, ID_PATTERN);
    if (!id) return null;

    return {
      id,
      name: readString(payload.name, MAX_NAME_LENGTH) ?? "Fan",
      handle: readString(payload.handle, MAX_HANDLE_LENGTH) ?? "fan",
      avatarUrl: readAvatar(payload.avatarUrl),
      isDemo: payload.isDemo === true,
    };
  } catch {
    return null;
  }
}

/**
 * Reads and verifies the session cookie. Memoised per request so a page that
 * renders many server components only verifies the JWT once.
 */
export const getSession = cache(readSession);

export async function requireUser(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect("/login");
  return user;
}

/** Same as requireUser but returns null instead of redirecting (route handlers). */
export async function requireApiUser(): Promise<SessionUser | null> {
  return getSession();
}

export async function setSession(user: SessionUser): Promise<void> {
  const key = secretKey();
  if (!key) {
    // No secret -> no session. Callers translate this into a friendly error page.
    throw new Error(
      "SESSION_SECRET is not configured: set a random value of at least 32 characters before signing sessions.",
    );
  }

  const id = readString(user.id, MAX_ID_LENGTH, ID_PATTERN);
  if (!id) throw new Error("Cannot start a session without a valid user id.");

  const token = await new SignJWT({
    name: readString(user.name, MAX_NAME_LENGTH) ?? "Fan",
    handle: readString(user.handle, MAX_HANDLE_LENGTH) ?? "fan",
    avatarUrl: readAvatar(user.avatarUrl),
    isDemo: user.isDemo === true,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(id)
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(key);

  const store = await cookies();
  store.set({
    name: sessionCookieName(),
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction(),
    path: "/",
    maxAge: SESSION_MAX_AGE,
    priority: "high",
  });

  // Drop a legacy (non __Host-) cookie if one is still around so only the
  // hardened cookie can ever authenticate this browser.
  if (isProduction() && store.get(LEGACY_COOKIE)?.value) {
    try {
      store.delete(LEGACY_COOKIE);
    } catch {
      // Cookie deletion is not allowed in every rendering context; ignoring it
      // is safe because readSession no longer accepts the legacy name in prod.
    }
  }
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  const names = new Set([sessionCookieName(), LEGACY_COOKIE]);
  for (const name of names) {
    store.set({
      name,
      value: "",
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction(),
      path: "/",
      maxAge: 0,
    });
  }
}

export function isSpotifyConfigured(): boolean {
  const id = process.env.SPOTIFY_CLIENT_ID?.trim();
  const secret = process.env.SPOTIFY_CLIENT_SECRET?.trim();
  return Boolean(id && secret);
}
