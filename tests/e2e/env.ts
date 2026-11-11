/**
 * Single source of truth for the end-to-end environment.
 *
 * Everything here is mirrored in `.env.test` so the suite can also be driven by
 * hand (`node --env-file=.env.test scripts/seed.mjs`). The values are injected
 * explicitly into the web server command and into the migrate/seed child
 * processes, which is the only way to guarantee the server never falls back to
 * the developer's `.env.local` (which points at `local.db`).
 */

export const TEST_PORT = 3000;
export const TEST_HOST = "127.0.0.1";
export const TEST_BASE_URL = `http://${TEST_HOST}:${TEST_PORT}`;

/** Dedicated throwaway database. Never `local.db`. */
export const TEST_DB_FILE = "test.db";
export const TEST_DB_URL = `file:${TEST_DB_FILE}`;

/** Fixed 64 hex chars, same shape as `openssl rand -hex 32`. */
export const TEST_SESSION_SECRET =
  "e2e1c0de5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d";

export const TEST_CRON_SECRET = "e2e-cron-secret-0123456789abcdef";

/** Env handed to `next build` / `next start` and to the seed scripts. */
export const TEST_ENV: Record<string, string> = {
  TURSO_DATABASE_URL: TEST_DB_URL,
  // Local file databases need no token; empty keeps the client on the file path.
  TURSO_AUTH_TOKEN: "",
  SESSION_SECRET: TEST_SESSION_SECRET,
  CRON_SECRET: TEST_CRON_SECRET,
  NEXT_PUBLIC_APP_URL: TEST_BASE_URL,
  // Spotify stays off so the login page exercises the non-OAuth path.
  SPOTIFY_CLIENT_ID: "",
  SPOTIFY_CLIENT_SECRET: "",
  SPOTIFY_REDIRECT_URI: `${TEST_BASE_URL}/api/auth/spotify/callback`,
};

/**
 * Sentinel row written by the global setup into the test DB. Its presence proves
 * the server under test is actually talking to the seeded `test.db` and not to
 * the developer's `local.db`.
 */
export const SENTINEL_EVENT_ID = "evt-e2e-preflight";
export const SENTINEL_CREATED_AT = "2000-01-01T00:00:00.000Z";

/* -------------------------------------------------------------------------
 * Seed fixtures (scripts/seed.mjs). Data, not brand copy: these ids exist in
 * every seeded database and are what the UI/API are expected to serve.
 * ----------------------------------------------------------------------- */

export const DEMO_USER_ID = "demo-you";
export const DEMO_USER_NAME = "Rohan";
export const SECOND_DEMO_USER_ID = "fan-01";

export const ARTIST_ID = "nova-kestrel";
export const ARTIST_COUNT = 6;

/** Seeded challenge that `demo-you` has NOT joined, so joining is observable. */
export const JOINABLE_CHALLENGE_ID = "challenge-deep-cuts";
export const JOINABLE_CHALLENGE_TITLE = "Deep Cuts";
