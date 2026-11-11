import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getGlobalArtistLeaderboard } from "@/lib/queries";
import { isPeriod } from "@/lib/period";
import { RATE_LIMITS, enforceRateLimit } from "@/lib/rate-limit";
import type { Period } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const querySchema = z.object({
  period: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(50).catch(20),
});

export async function GET(request: NextRequest) {
  const limited = enforceRateLimit(request, RATE_LIMITS.leaderboardArtists);
  if (limited) return limited;

  const params = request.nextUrl.searchParams;
  const parsed = querySchema.safeParse({
    period: params.get("period") ?? undefined,
    limit: params.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "period must be one of week, month, year" },
      { status: 400 },
    );
  }

  const rawPeriod = parsed.data.period;
  if (rawPeriod !== undefined && !isPeriod(rawPeriod)) {
    return NextResponse.json(
      { ok: false, error: "period must be one of week, month, year" },
      { status: 400 },
    );
  }

  const period: Period = isPeriod(rawPeriod) ? rawPeriod : "week";

  try {
    const rows = await getGlobalArtistLeaderboard(period, parsed.data.limit);
    return NextResponse.json({ ok: true, period, rows });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Could not load the artist leaderboard" },
      { status: 500 },
    );
  }
}
