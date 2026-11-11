import type { NextRequest } from "next/server";
import { z } from "zod";
import { joinChallenge } from "@/lib/challenges";
import { getSession } from "@/lib/auth";
import { RATE_LIMITS, enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Challenge ids are slugs; reject anything else before it reaches the DB. */
const idSchema = z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/);

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const limited = enforceRateLimit(request, RATE_LIMITS.challengeJoin);
  if (limited) return limited;

  let userId: string | null = null;
  try {
    const user = await getSession();
    userId = user?.id ?? null;
  } catch {
    userId = null;
  }

  // Membership always comes from the verified session, never the request body.
  if (!userId) {
    return Response.json({ ok: false, error: "Sign in to join challenges." }, { status: 401 });
  }

  const { id } = await context.params;
  const parsedId = idSchema.safeParse(id ?? "");
  if (!parsedId.success) {
    return Response.json({ ok: false, error: "Challenge not found." }, { status: 404 });
  }

  try {
    const result = await joinChallenge(userId, parsedId.data);
    if (!result.ok) {
      const status = result.error === "Challenge not found." ? 404 : 400;
      return Response.json(
        { ok: false, error: result.error ?? "Unable to join this challenge." },
        { status },
      );
    }
    return Response.json({ ok: true });
  } catch {
    return Response.json(
      { ok: false, error: "Unable to join this challenge right now." },
      { status: 500 },
    );
  }
}
