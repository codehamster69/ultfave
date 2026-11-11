import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getArtistLeaderboard } from "@/lib/queries";
import { getSession } from "@/lib/auth";
import { isPeriod } from "@/lib/period";
import { RATE_LIMITS, enforceRateLimit } from "@/lib/rate-limit";
import type { LeaderboardRow } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_LIMIT = 50;

const querySchema = z.object({
  artistId: z.string().trim().min(1).max(128),
  period: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(100).catch(DEFAULT_LIMIT),
});

export async function GET(request: NextRequest) {
  const limited = enforceRateLimit(request, RATE_LIMITS.leaderboard);
  if (limited) return limited;

  const params = request.nextUrl.searchParams;
  const parsed = querySchema.safeParse({
    artistId: params.get("artistId") ?? "",
    period: params.get("period") ?? undefined,
    limit: params.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "artistId is required" }, { status: 400 });
  }

  const { artistId } = parsed.data;
  const period = isPeriod(parsed.data.period) ? parsed.data.period : "week";
  const limit = parsed.data.limit;

  const session = await getSession();
  const viewerId = session?.id ?? null;

  let rows: LeaderboardRow[];
  try {
    rows = await getArtistLeaderboard(artistId, period, viewerId, limit);
  } catch {
    return NextResponse.json({ ok: false, error: "Could not load leaderboard" }, { status: 500 });
  }

  const me = viewerId === null ? null : rows.find((row) => row.userId === viewerId) ?? null;

  return NextResponse.json({ ok: true, period, rows, me });
}
