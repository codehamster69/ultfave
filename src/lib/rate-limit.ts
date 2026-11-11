/**
 * In-memory sliding-window rate limiting.
 *
 * IMPORTANT: this is per-instance best effort. Each Node/Edge process keeps its
 * own bucket map, so a deployment with N instances effectively allows up to N
 * times the configured limit and a cold start resets the window. That is an
 * accepted trade-off (no external store / Redis dependency). If abuse becomes a
 * real problem, put a shared limiter (Upstash, Cloudflare, or a libSQL table) in
 * front of the same policy definitions so the limits below stay the source of
 * truth.
 *
 * Design notes:
 * - Keyed by client IP + route policy name; a missing/unparseable IP collapses
 *   into a shared "unknown" bucket instead of throwing.
 * - Sliding window (timestamp list) rather than fixed buckets, so a burst across
 *   a window boundary cannot double the allowance.
 * - 429 responses always carry Retry-After (seconds) and a JSON body so clients
 *   can back off gracefully.
 */
import { NextResponse } from "next/server";

export type RateLimitPolicy = {
  /** Stable key for the route; used in bucket keys and logs. */
  name: string;
  /** Maximum requests allowed inside the window. */
  limit: number;
  /** Window size in milliseconds. */
  windowMs: number;
};

const MINUTE = 60_000;

/** Documented limits, tuned for a public launch with demo mode enabled. */
export const RATE_LIMITS = {
  authDemo: { name: "auth:demo", limit: 10, windowMs: MINUTE },
  authCallback: { name: "auth:callback", limit: 10, windowMs: MINUTE },
  authStart: { name: "auth:start", limit: 20, windowMs: MINUTE },
  authLogout: { name: "auth:logout", limit: 30, windowMs: MINUTE },
  sync: { name: "sync", limit: 6, windowMs: MINUTE },
  follow: { name: "follow", limit: 30, windowMs: MINUTE },
  challengeJoin: { name: "challenge:join", limit: 30, windowMs: MINUTE },
  feed: { name: "feed", limit: 120, windowMs: MINUTE },
  leaderboard: { name: "leaderboard", limit: 120, windowMs: MINUTE },
  leaderboardArtists: { name: "leaderboard:artists", limit: 120, windowMs: MINUTE },
  card: { name: "card", limit: 30, windowMs: MINUTE },
  cron: { name: "cron:sync", limit: 10, windowMs: MINUTE },
  health: { name: "health", limit: 60, windowMs: MINUTE },
} as const satisfies Record<string, RateLimitPolicy>;

/** Hard cap so a spoofed-IP flood cannot grow the map without bound. */
const MAX_BUCKETS = 5_000;

type Bucket = number[];

type RateLimitStore = Map<string, Bucket>;

const globalStore = globalThis as typeof globalThis & {
  __ultfaveRateLimitStore?: RateLimitStore;
};

function store(): RateLimitStore {
  if (!globalStore.__ultfaveRateLimitStore) {
    globalStore.__ultfaveRateLimitStore = new Map();
  }
  return globalStore.__ultfaveRateLimitStore;
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  /** Seconds until the caller may retry (0 when allowed). */
  retryAfterSeconds: number;
};

/**
 * Best-effort client IP. Never throws: a missing header yields "unknown", which
 * still gets rate limited (shared bucket) rather than bypassing the limiter.
 */
export function getClientIp(request: Request): string {
  const header = (name: string): string => {
    try {
      return request.headers.get(name) ?? "";
    } catch {
      return "";
    }
  };

  const forwarded = header("x-forwarded-for");
  const candidate =
    forwarded.split(",")[0]?.trim() ||
    header("x-real-ip").trim() ||
    header("cf-connecting-ip").trim() ||
    "";

  if (candidate.length === 0) return "unknown";

  // Strip an IPv4 port ("1.2.3.4:5678") and keep the value short/printable so a
  // hostile header cannot blow up the bucket map.
  const withoutPort = /^\d{1,3}(?:\.\d{1,3}){3}:\d{1,5}$/.test(candidate)
    ? candidate.slice(0, candidate.lastIndexOf(":"))
    : candidate;
  const safe = withoutPort.replace(/[^0-9a-fA-F:._-]/g, "").slice(0, 64);
  return safe.length > 0 ? safe : "unknown";
}

export function checkRateLimit(key: string, policy: RateLimitPolicy, now = Date.now()): RateLimitResult {
  const buckets = store();
  const windowStart = now - policy.windowMs;

  let bucket = buckets.get(key);
  if (bucket) {
    // Drop timestamps outside the window (sliding window).
    let firstFresh = 0;
    while (firstFresh < bucket.length && (bucket[firstFresh] ?? 0) <= windowStart) firstFresh += 1;
    if (firstFresh > 0) bucket.splice(0, firstFresh);
  } else {
    bucket = [];
    buckets.set(key, bucket);
  }

  if (bucket.length >= policy.limit) {
    const oldest = bucket[0] ?? now;
    const retryAfterMs = Math.max(1, oldest + policy.windowMs - now);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  bucket.push(now);

  if (buckets.size > MAX_BUCKETS) {
    // Evict the oldest key (Map preserves insertion order) plus anything stale.
    for (const [bucketKey, timestamps] of buckets) {
      const newest = timestamps[timestamps.length - 1] ?? 0;
      if (newest <= windowStart) buckets.delete(bucketKey);
      if (buckets.size <= MAX_BUCKETS) break;
    }
    while (buckets.size > MAX_BUCKETS) {
      const oldestKey = buckets.keys().next().value;
      if (oldestKey === undefined) break;
      buckets.delete(oldestKey);
    }
  }

  return {
    allowed: true,
    remaining: Math.max(0, policy.limit - bucket.length),
    retryAfterSeconds: 0,
  };
}

export function tooManyRequests(retryAfterSeconds: number, policy: RateLimitPolicy): NextResponse {
  const retryAfter = Math.max(1, retryAfterSeconds);
  return NextResponse.json(
    {
      ok: false,
      error: "Too many requests. Slow down and try again shortly.",
      retryAfter,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "Cache-Control": "no-store",
        "X-RateLimit-Limit": String(policy.limit),
        "X-RateLimit-Remaining": "0",
      },
    },
  );
}

/**
 * Convenience wrapper for route handlers. Returns a 429 response when the caller
 * is over budget, otherwise null (and the handler continues).
 */
export function enforceRateLimit(
  request: Request,
  policy: RateLimitPolicy,
  extraKey?: string,
): NextResponse | null {
  const ip = getClientIp(request);
  const key = `${policy.name}:${extraKey ? `${extraKey}:` : ""}${ip}`;
  const result = checkRateLimit(key, policy);
  return result.allowed ? null : tooManyRequests(result.retryAfterSeconds, policy);
}

export type JsonBodyResult =
  | { ok: true; data: unknown }
  | { ok: false; response: NextResponse };

function payloadTooLarge(): NextResponse {
  return NextResponse.json(
    { ok: false, error: "Request body is too large." },
    { status: 413, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * Reads a JSON body with a hard size cap, returning a ready-to-return error
 * response instead of throwing. Keeps handlers free of try/catch noise.
 */
export async function readJsonBody(request: Request, maxBytes = 8_192): Promise<JsonBodyResult> {
  const declared = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { ok: false, response: payloadTooLarge() };
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Could not read the request body." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      ),
    };
  }

  if (text.length > maxBytes) return { ok: false, response: payloadTooLarge() };
  if (text.trim().length === 0) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Request body is required." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      ),
    };
  }

  try {
    return { ok: true, data: JSON.parse(text) as unknown };
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Invalid JSON body." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      ),
    };
  }
}
