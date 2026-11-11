import { NextResponse, type NextRequest } from "next/server";
import { clearSession } from "@/lib/auth";
import { RATE_LIMITS, enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const limited = enforceRateLimit(request, RATE_LIMITS.authLogout);
  if (limited) return limited;

  await clearSession();

  // Relative redirect keeps the user on the origin they came from.
  const response = NextResponse.redirect(new URL("/", request.nextUrl.origin));
  response.headers.set("Cache-Control", "no-store");
  return response;
}
