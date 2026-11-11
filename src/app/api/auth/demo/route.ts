import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { get, run } from "@/lib/db";
import { setSession } from "@/lib/auth";
import { RATE_LIMITS, enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEMO_USER_ID = "demo-you";

type DemoRow = {
  id: string;
  displayName: string;
  handle: string;
  avatarUrl: string | null;
  isDemo: number;
};

const SELECT_DEMO = `SELECT id, display_name AS "displayName", handle, avatar_url AS "avatarUrl", is_demo AS "isDemo"
  FROM users WHERE id = ? LIMIT 1`;

function redirectTo(request: NextRequest, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, request.nextUrl.origin));
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Demo sessions are free to mint, so this is the main anti-abuse choke point.
  const limited = enforceRateLimit(request, RATE_LIMITS.authDemo);
  if (limited) return limited;

  try {
    let row = await get<DemoRow>(SELECT_DEMO, [DEMO_USER_ID]);

    if (!row) {
      const handleCandidates = ["rohan", `rohan-${randomUUID().replace(/-/g, "").slice(0, 4)}`];
      for (const handle of handleCandidates) {
        await run(
          `INSERT OR IGNORE INTO users
             (id, spotify_id, display_name, handle, avatar_url, country, is_demo, created_at)
           VALUES (?, NULL, ?, ?, NULL, NULL, 1, ?)`,
          [DEMO_USER_ID, "Rohan", handle, new Date().toISOString()],
        );
        row = await get<DemoRow>(SELECT_DEMO, [DEMO_USER_ID]);
        if (row) break;
      }
    }

    if (!row) return redirectTo(request, "/login?error=demo_failed");

    await setSession({
      id: row.id,
      name: row.displayName,
      handle: row.handle,
      avatarUrl: row.avatarUrl,
      isDemo: row.isDemo === 1,
    });
  } catch {
    return redirectTo(request, "/login?error=demo_failed");
  }

  return redirectTo(request, "/me");
}
