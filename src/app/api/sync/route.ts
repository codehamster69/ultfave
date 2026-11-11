import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { syncUserPlays } from "@/lib/ingest";
import { RATE_LIMITS, enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sync calls Spotify + the DB, so they are the tightest user-facing limit. */
const MAX_REPORTED_ERROR_LENGTH = 160;

export async function POST(request: Request): Promise<NextResponse> {
  const limited = enforceRateLimit(request, RATE_LIMITS.sync);
  if (limited) return limited;

  // The session is the only source of identity; no body/param can select a user.
  const user = await requireApiUser();

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Sign in to sync your Spotify plays" },
      { status: 401 },
    );
  }

  try {
    const result = await syncUserPlays(user.id);
    return NextResponse.json(
      {
        ok: true,
        imported: result.imported,
        points: result.points,
        ...(result.error
          ? { error: result.error.slice(0, MAX_REPORTED_ERROR_LENGTH) }
          : {}),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    // Details go to the server log only; clients get a generic message so DB or
    // upstream provider internals are never disclosed.
    const message = error instanceof Error ? error.message : "Unknown sync error";
    console.error(`[api/sync] sync failed for ${user.id}: ${message}`);
    return NextResponse.json(
      { ok: false, error: "Sync failed. Try again in a moment." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
