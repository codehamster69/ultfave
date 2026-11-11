import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { all } from "@/lib/db";
import { syncUserPlays } from "@/lib/ingest";
import { getCronSecret } from "@/lib/env";
import { RATE_LIMITS, enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CronUserRow = { id: string };

/**
 * Constant-time comparison. Both sides are hashed first so the digest lengths
 * always match (no length leak) and timingSafeEqual never throws.
 */
function safeEqual(candidate: string, secret: string): boolean {
  const a = createHash("sha256").update(candidate, "utf8").digest();
  const b = createHash("sha256").update(secret, "utf8").digest();
  return timingSafeEqual(a, b);
}

function isAuthorized(request: Request): boolean {
  // Empty or placeholder CRON_SECRET locks the endpoint instead of opening it.
  const secret = getCronSecret();
  if (!secret) return false;

  const header = request.headers.get("authorization") ?? "";
  const bearer = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (bearer.length > 0 && safeEqual(bearer, secret)) return true;

  // Legacy query-param form, kept for existing schedulers. Prefer the
  // Authorization header: query strings leak into access logs and referrers.
  const url = new URL(request.url);
  const querySecret = (url.searchParams.get("secret") ?? "").trim();
  return querySecret.length > 0 && safeEqual(querySecret, secret);
}

export async function GET(request: Request): Promise<NextResponse> {
  const limited = enforceRateLimit(request, RATE_LIMITS.cron);
  if (limited) return limited;

  if (!isAuthorized(request)) {
    // Identical response for "missing" and "wrong" so nothing about the secret
    // (existence, length, prefix) can be probed.
    return NextResponse.json(
      { ok: false, error: "Missing or invalid cron secret" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  let users: CronUserRow[];
  try {
    users = await all<CronUserRow>(
      `SELECT id
         FROM users
        WHERE is_demo = 0
          AND spotify_refresh_token IS NOT NULL
          AND spotify_refresh_token <> ''
        ORDER BY created_at ASC`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown database error";
    console.error(`[api/cron/sync] could not load fans: ${message}`);
    return NextResponse.json(
      { ok: false, error: "Could not load fans" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  let synced = 0;
  let failed = 0;

  for (const user of users) {
    try {
      const result = await syncUserPlays(user.id);
      if (result.error) {
        failed += 1;
        console.error(`[api/cron/sync] ${user.id}: ${result.error}`);
      } else {
        synced += 1;
      }
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : "Unknown sync error";
      console.error(`[api/cron/sync] ${user.id}: ${message}`);
    }
  }

  return NextResponse.json(
    { ok: true, synced, failed },
    { headers: { "Cache-Control": "no-store" } },
  );
}
