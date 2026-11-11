import { NextResponse } from "next/server";
import { z } from "zod";
import { get } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { followUser, unfollowUser } from "@/lib/friends";
import { RATE_LIMITS, enforceRateLimit, readJsonBody } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Bounded ids only: they are used as SQL parameters, never interpolated. */
const bodySchema = z.object({
  userId: z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9._:@-]+$/),
  action: z.enum(["follow", "unfollow"]),
});

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, RATE_LIMITS.follow);
  if (limited) return limited;

  // The session id is authoritative: a caller can only ever act as themselves.
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Sign in to follow fans." }, { status: 401 });
  }

  const body = await readJsonBody(request, 4_096);
  if (!body.ok) return body.response;

  const parsed = bodySchema.safeParse(body.data);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "userId and action are required." }, { status: 400 });
  }

  if (parsed.data.userId === session.id) {
    return NextResponse.json({ ok: false, error: "You cannot follow yourself." }, { status: 400 });
  }

  try {
    const target = await get<{ id: string }>(`SELECT id FROM users WHERE id = ? LIMIT 1`, [
      parsed.data.userId,
    ]);
    if (!target) {
      return NextResponse.json({ ok: false, error: "Fan not found." }, { status: 404 });
    }

    if (parsed.data.action === "follow") {
      await followUser(session.id, parsed.data.userId);
    } else {
      await unfollowUser(session.id, parsed.data.userId);
    }
    return NextResponse.json({ ok: true, following: parsed.data.action === "follow" });
  } catch {
    return NextResponse.json({ ok: false, error: "Could not update follow state." }, { status: 500 });
  }
}
