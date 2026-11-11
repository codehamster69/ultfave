import type { NextRequest } from "next/server";
import { z } from "zod";
import { getFeed, type FeedScope } from "@/lib/activity";
import { getSession } from "@/lib/auth";
import { RATE_LIMITS, enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_LIMIT = 30;

/** Invalid values fall back to safe defaults instead of failing the request. */
const querySchema = z.object({
  scope: z.enum(["global", "friends"]).catch("global"),
  limit: z.coerce.number().int().min(1).max(50).catch(DEFAULT_LIMIT),
});

async function readViewerId(): Promise<string | null> {
  try {
    const user = await getSession();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const limited = enforceRateLimit(request, RATE_LIMITS.feed);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    scope: searchParams.get("scope") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });
  const scope: FeedScope = parsed.success ? parsed.data.scope : "global";
  const limit = parsed.success ? parsed.data.limit : DEFAULT_LIMIT;

  try {
    const events = await getFeed(await readViewerId(), scope, limit);
    return Response.json({ ok: true, scope, events });
  } catch {
    return Response.json({ ok: false, error: "Unable to load the activity feed." }, { status: 500 });
  }
}
