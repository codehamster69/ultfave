/**
 * Environment contract for Ultfave.
 *
 * Rules of engagement:
 * - Nothing here throws on import. A misconfigured deployment is reported once
 *   (names + reasons only, never values) and exposed through /api/health.
 * - Development and demo mode keep working with an empty .env.local. Production
 *   refuses to mint sessions with a missing/weak/placeholder SESSION_SECRET and
 *   reports CRON_SECRET, TURSO_DATABASE_URL and the Spotify pair as fatal issues.
 * - Values are never logged, returned, or embedded in error messages.
 */
import { z } from "zod";

export const APP_MODES = ["development", "test", "production"] as const;
export type AppMode = (typeof APP_MODES)[number];

export const MIN_SESSION_SECRET_LENGTH = 32;
export const MIN_CRON_SECRET_LENGTH = 16;
/** Only used outside production so `next dev` and demo mode work out of the box. */
export const DEV_FALLBACK_SESSION_SECRET = "dev-secret-change-me";
const FALLBACK_ORIGIN = "http://127.0.0.1:3000";

/** Placeholder values shipped in .env.example / copy-pasted by mistake. */
const PLACEHOLDER_SECRETS = new Set([
  "change-me",
  "changeme",
  "change-me-cron",
  "replace-me",
  "your-secret",
  "secret",
  "dev-secret-change-me",
]);

const rawEnvSchema = z.object({
  NODE_ENV: z.enum(APP_MODES).catch("development"),
  TURSO_DATABASE_URL: z.string().trim().catch(""),
  TURSO_AUTH_TOKEN: z.string().trim().catch(""),
  SESSION_SECRET: z.string().catch(""),
  CRON_SECRET: z.string().catch(""),
  SPOTIFY_CLIENT_ID: z.string().trim().catch(""),
  SPOTIFY_CLIENT_SECRET: z.string().trim().catch(""),
  SPOTIFY_REDIRECT_URI: z.string().trim().catch(""),
  NEXT_PUBLIC_APP_URL: z.string().trim().catch(""),
});

type RawEnv = z.infer<typeof rawEnvSchema>;

export type EnvIssue = {
  /** Variable name only - never the value. */
  variable: string;
  /** Human readable, safe to expose publicly (contains no secret material). */
  message: string;
};

export type EnvReport = {
  mode: AppMode;
  production: boolean;
  /** False when at least one fatal issue would break a public deployment. */
  ok: boolean;
  fatal: EnvIssue[];
  warnings: EnvIssue[];
  features: {
    sessionSecretConfigured: boolean;
    database: "remote" | "local" | "unset";
    spotify: boolean;
    cron: boolean;
    demo: true;
  };
};

function readEnv(source: NodeJS.ProcessEnv = process.env): RawEnv {
  return rawEnvSchema.parse(source);
}

function isPlaceholder(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized.length === 0 || PLACEHOLDER_SECRETS.has(normalized);
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isUsableSecret(value: string, minLength: number): boolean {
  return value.trim().length >= minLength && !isPlaceholder(value);
}

function databaseKind(url: string): EnvReport["features"]["database"] {
  if (url.length === 0) return "unset";
  return url.startsWith("file:") ? "local" : "remote";
}

function buildReport(env: RawEnv): EnvReport {
  const production = env.NODE_ENV === "production";
  const fatal: EnvIssue[] = [];
  const warnings: EnvIssue[] = [];

  // --- session signing ------------------------------------------------------
  if (!isUsableSecret(env.SESSION_SECRET, MIN_SESSION_SECRET_LENGTH)) {
    const issue = {
      variable: "SESSION_SECRET",
      message: `must be a random value of at least ${MIN_SESSION_SECRET_LENGTH} characters (generate with: openssl rand -hex 32)`,
    };
    if (production) fatal.push(issue);
    else {
      warnings.push({
        variable: issue.variable,
        message: `${issue.message}; falling back to the development secret. Never deploy this.`,
      });
    }
  }

  // --- database -------------------------------------------------------------
  if (env.TURSO_DATABASE_URL.length === 0) {
    const issue = {
      variable: "TURSO_DATABASE_URL",
      message: "must point at a libSQL database (libsql://..., https://... or file:...)",
    };
    if (production) fatal.push(issue);
    else warnings.push({ variable: issue.variable, message: `${issue.message}; using file:local.db.` });
  } else if (!/^(file:|libsql:|https?:|wss?:)/.test(env.TURSO_DATABASE_URL)) {
    fatal.push({
      variable: "TURSO_DATABASE_URL",
      message: "must start with file:, libsql:, https: or wss:",
    });
  } else if (!env.TURSO_DATABASE_URL.startsWith("file:") && env.TURSO_AUTH_TOKEN.length === 0) {
    const issue = {
      variable: "TURSO_AUTH_TOKEN",
      message: "is required for remote libSQL databases",
    };
    if (production) fatal.push(issue);
    else warnings.push(issue);
  }

  // --- Spotify OAuth pair ---------------------------------------------------
  const hasSpotifyId = env.SPOTIFY_CLIENT_ID.length > 0;
  const hasSpotifySecret = env.SPOTIFY_CLIENT_SECRET.length > 0;
  if (hasSpotifyId !== hasSpotifySecret) {
    const issue = {
      variable: hasSpotifyId ? "SPOTIFY_CLIENT_SECRET" : "SPOTIFY_CLIENT_ID",
      message: "SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set together",
    };
    if (production) fatal.push(issue);
    else warnings.push(issue);
  } else if (!hasSpotifyId) {
    warnings.push({
      variable: "SPOTIFY_CLIENT_ID",
      message: "Spotify sign-in is disabled; demo mode only",
    });
  }
  if (env.SPOTIFY_REDIRECT_URI.length > 0 && !isHttpUrl(env.SPOTIFY_REDIRECT_URI)) {
    const issue = {
      variable: "SPOTIFY_REDIRECT_URI",
      message: "must be an absolute http(s) URL that matches the Spotify dashboard",
    };
    if (production) fatal.push(issue);
    else warnings.push(issue);
  }

  // --- cron -----------------------------------------------------------------
  if (!isUsableSecret(env.CRON_SECRET, MIN_CRON_SECRET_LENGTH)) {
    const issue = {
      variable: "CRON_SECRET",
      message: `must be a random value of at least ${MIN_CRON_SECRET_LENGTH} characters; /api/cron/sync stays locked until it is set`,
    };
    if (production) fatal.push(issue);
    else warnings.push(issue);
  }

  // --- public origin --------------------------------------------------------
  if (env.NEXT_PUBLIC_APP_URL.length === 0) {
    warnings.push({
      variable: "NEXT_PUBLIC_APP_URL",
      message: "not set; OAuth redirects fall back to the request Host header",
    });
  } else if (!isHttpUrl(env.NEXT_PUBLIC_APP_URL)) {
    const issue = {
      variable: "NEXT_PUBLIC_APP_URL",
      message: "must be an absolute http(s) URL",
    };
    if (production) fatal.push(issue);
    else warnings.push(issue);
  } else if (production && env.NEXT_PUBLIC_APP_URL.startsWith("http:")) {
    warnings.push({
      variable: "NEXT_PUBLIC_APP_URL",
      message: "uses http: in production; canonical URLs and cookies expect https",
    });
  }

  return {
    mode: env.NODE_ENV,
    production,
    ok: fatal.length === 0,
    fatal,
    warnings,
    features: {
      sessionSecretConfigured: isUsableSecret(env.SESSION_SECRET, MIN_SESSION_SECRET_LENGTH),
      database: databaseKind(env.TURSO_DATABASE_URL),
      spotify: hasSpotifyId && hasSpotifySecret,
      cron: isUsableSecret(env.CRON_SECRET, MIN_CRON_SECRET_LENGTH),
      demo: true,
    },
  };
}

let cachedReport: EnvReport | null = null;

/**
 * Sanitized view of the deployment configuration, safe to serve from /api/health.
 * Cached because the process environment does not change at runtime.
 */
export function getEnvReport(): EnvReport {
  if (cachedReport) return cachedReport;
  let env: RawEnv;
  try {
    env = readEnv();
  } catch {
    // Defensive: the schema uses `.catch()` on every field, so this is unreachable
    // in practice. Never surface parser details.
    env = readEnv({} as NodeJS.ProcessEnv);
  }
  cachedReport = buildReport(env);
  return cachedReport;
}

/**
 * Secret used to sign session cookies. Returns null in production when the
 * configured secret is missing/weak so we fail closed instead of signing with a
 * public fallback. Development/demo keeps the historical fallback value.
 */
export function getSessionSecret(): string | null {
  const env = readEnv();
  if (isUsableSecret(env.SESSION_SECRET, MIN_SESSION_SECRET_LENGTH)) {
    return env.SESSION_SECRET.trim();
  }
  return env.NODE_ENV === "production" ? null : DEV_FALLBACK_SESSION_SECRET;
}

/** Cron secret, or null when unset/placeholder. Callers must fail closed. */
export function getCronSecret(): string | null {
  const env = readEnv();
  return isUsableSecret(env.CRON_SECRET, MIN_CRON_SECRET_LENGTH) ? env.CRON_SECRET.trim() : null;
}

/**
 * Canonical origin for redirects. Prefers NEXT_PUBLIC_APP_URL so a spoofed Host
 * header can never turn an auth callback into an open redirect; falls back to
 * the request origin and finally to the loopback dev origin.
 */
export function resolveAppOrigin(requestOrigin?: string | null): string {
  const configured = readEnv().NEXT_PUBLIC_APP_URL;
  if (configured.length > 0 && isHttpUrl(configured)) return configured.replace(/\/+$/, "");
  if (requestOrigin && isHttpUrl(requestOrigin)) return requestOrigin.replace(/\/+$/, "");
  return FALLBACK_ORIGIN;
}

function isLoopbackHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return host === "localhost" || host === "::1" || /^127(?:\.\d{1,3}){3}$/.test(host);
}

/**
 * Whether auth cookies must carry the `Secure` attribute.
 *
 * Always true in production, except when the configured public origin is plain
 * http on a loopback host (the `next start` launch-gate on http://127.0.0.1),
 * where a Secure cookie would never be sent back and every login would fail.
 * A public http origin in production is still reported by getEnvReport().
 */
export function shouldUseSecureCookies(): boolean {
  const env = readEnv();
  if (env.NODE_ENV !== "production") return false;
  const configured = env.NEXT_PUBLIC_APP_URL;
  if (configured.length === 0 || !isHttpUrl(configured)) return true;
  const url = new URL(configured);
  return !(url.protocol === "http:" && isLoopbackHost(url.hostname));
}

let logged = false;

/**
 * Logs configuration problems once per process. Variable names and reasons only;
 * values (and therefore secrets) are never printed.
 */
export function logEnvIssuesOnce(): void {
  if (logged) return;
  logged = true;

  const report = getEnvReport();
  if (report.fatal.length > 0) {
    console.error(
      `[env] ${report.fatal.length} fatal configuration problem(s): ` +
        report.fatal.map((issue) => `${issue.variable} ${issue.message}`).join(" | "),
    );
  }
  if (report.warnings.length > 0) {
    console.warn(
      `[env] ${report.warnings.length} configuration warning(s): ` +
        report.warnings.map((issue) => `${issue.variable} ${issue.message}`).join(" | "),
    );
  }
}
