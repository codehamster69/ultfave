import { expect, test, type APIRequestContext } from "@playwright/test";

import { ARTIST_COUNT, ARTIST_ID, DEMO_USER_ID, TEST_CRON_SECRET } from "./env";
import { signInAsDemo } from "./support";

async function getJson(request: APIRequestContext, path: string) {
  const response = await request.get(path);
  return { response, payload: (await response.json()) as Record<string, unknown> };
}

test.describe("API contracts", () => {
  test("GET /api/leaderboard returns the artist board shape", async ({ request }) => {
    const { response, payload } = await getJson(
      request,
      `/api/leaderboard?artistId=${ARTIST_ID}&period=week`,
    );
    expect(response.status()).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.period).toBe("week");
    expect(payload.me).toBeNull();

    const rows = payload.rows as Record<string, unknown>[];
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThan(0);

    for (const key of [
      "rank",
      "prevRank",
      "delta",
      "userId",
      "name",
      "handle",
      "avatarUrl",
      "points",
      "minutes",
      "plays",
      "isMe",
      "isFriend",
      "badges",
    ]) {
      expect(rows[0], `row is missing ${key}`).toHaveProperty(key);
    }
    expect(typeof rows[0].rank).toBe("number");
    expect(typeof rows[0].points).toBe("number");
    expect(Array.isArray(rows[0].badges)).toBe(true);
    // Ranked: points are descending and ranks start at 1.
    expect(rows[0].rank).toBe(1);
    expect(Number(rows[0].points)).toBeGreaterThanOrEqual(Number(rows[1].points));

    // Missing artistId is a client error.
    const withoutArtist = await request.get("/api/leaderboard?period=week");
    expect(withoutArtist.status()).toBe(400);
    expect((await withoutArtist.json()) as { ok: boolean }).toMatchObject({ ok: false });

    /* Documented deviation (see DEPLOYMENT.md, "Known deviations"): this route
       coerces an unknown period to "week" instead of returning 400. The artists
       route rejects it. Pinned here so a future fix flips this assertion. */
    const badPeriod = await getJson(request, `/api/leaderboard?artistId=${ARTIST_ID}&period=decade`);
    expect(badPeriod.response.status()).toBe(200);
    expect(badPeriod.payload.period).toBe("week");
  });

  test("GET /api/leaderboard exposes the viewer row once signed in", async ({ page }) => {
    await signInAsDemo(page);
    const { payload } = await getJson(
      page.request,
      `/api/leaderboard?artistId=${ARTIST_ID}&period=week`,
    );
    const me = payload.me as Record<string, unknown> | null;
    expect(me).not.toBeNull();
    expect(me?.userId).toBe(DEMO_USER_ID);
    expect(me?.isMe).toBe(true);
  });

  test("GET /api/leaderboard/artists returns the global board and 400 on a bad period", async ({
    request,
  }) => {
    for (const period of ["week", "month", "year"]) {
      const { response, payload } = await getJson(
        request,
        `/api/leaderboard/artists?period=${period}`,
      );
      expect(response.status()).toBe(200);
      expect(payload.ok).toBe(true);
      expect(payload.period).toBe(period);

      const rows = payload.rows as Record<string, unknown>[];
      expect(rows.length).toBe(ARTIST_COUNT);
      const first = rows[0] as { artist: Record<string, unknown>; fans: number; points: number };
      expect(first.artist).toHaveProperty("id");
      expect(first.artist).toHaveProperty("name");
      expect(Array.isArray(first.artist.genres)).toBe(true);
      expect(typeof first.fans).toBe("number");
      expect(typeof first.points).toBe("number");
    }

    const bad = await request.get("/api/leaderboard/artists?period=decade");
    expect(bad.status()).toBe(400);
    expect((await bad.json()) as { ok: boolean }).toMatchObject({ ok: false });
  });

  test("GET /api/feed returns seeded events", async ({ request }) => {
    const { response, payload } = await getJson(request, "/api/feed?scope=global&limit=30");
    expect(response.status()).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.scope).toBe("global");

    const events = payload.events as Record<string, unknown>[];
    expect(events.length).toBeGreaterThan(0);
    for (const key of ["id", "kind", "message", "createdAt", "meta"]) {
      expect(events[0], `event is missing ${key}`).toHaveProperty(key);
    }
    expect(typeof events[0].message).toBe("string");
    expect((events[0].message as string).length).toBeGreaterThan(0);
  });

  test("GET /api/card/:artistId returns a PNG fan card", async ({ request }) => {
    for (const period of ["week", "month"]) {
      const response = await request.get(`/api/card/${ARTIST_ID}?period=${period}`);
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"] ?? "").toContain("image/png");

      const body = await response.body();
      expect(body.byteLength).toBeGreaterThan(1000);
      // PNG magic number.
      expect(body.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    }

    const missing = await request.get("/api/card/not-a-real-artist");
    expect(missing.status()).toBe(404);
  });

  test("POST /api/sync is refused when signed out", async ({ request }) => {
    const response = await request.post("/api/sync");
    expect(response.status()).toBe(401);
    expect((await response.json()) as { ok: boolean }).toMatchObject({ ok: false });
  });

  test("GET /api/cron/sync requires the bearer CRON_SECRET", async ({ request }) => {
    const anonymous = await request.get("/api/cron/sync");
    expect(anonymous.status()).toBe(401);

    const wrong = await request.get("/api/cron/sync", {
      headers: { authorization: "Bearer not-the-secret" },
    });
    expect(wrong.status()).toBe(401);

    // Same mechanism Vercel Cron uses: `Authorization: Bearer $CRON_SECRET`.
    const authorized = await request.get("/api/cron/sync", {
      headers: { authorization: `Bearer ${TEST_CRON_SECRET}` },
    });
    expect(authorized.status()).toBe(200);
    expect((await authorized.json()) as { ok: boolean }).toMatchObject({ ok: true });
  });

  /*
   * BLOCKED: there is no health route in this tree
   * (`src/app/api/health/route.ts` does not exist), so the endpoint the
   * deployment runbook needs for uptime checks answers 404. Un-skip once the
   * route ships — see DEPLOYMENT.md, "Blocking issues".
   */
  test.fixme("GET /api/health returns ok", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    expect((await response.json()) as { ok: boolean }).toMatchObject({ ok: true });
  });
});
