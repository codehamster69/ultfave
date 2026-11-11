# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: api.spec.ts >> API contracts >> GET /api/cron/sync requires the bearer CRON_SECRET
- Location: tests/e2e/api.spec.ts:139:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 401
Received: 500
```

# Test source

```ts
  41  |       expect(rows[0], `row is missing ${key}`).toHaveProperty(key);
  42  |     }
  43  |     expect(typeof rows[0].rank).toBe("number");
  44  |     expect(typeof rows[0].points).toBe("number");
  45  |     expect(Array.isArray(rows[0].badges)).toBe(true);
  46  |     // Ranked: points are descending and ranks start at 1.
  47  |     expect(rows[0].rank).toBe(1);
  48  |     expect(Number(rows[0].points)).toBeGreaterThanOrEqual(Number(rows[1].points));
  49  | 
  50  |     // Missing artistId is a client error.
  51  |     const withoutArtist = await request.get("/api/leaderboard?period=week");
  52  |     expect(withoutArtist.status()).toBe(400);
  53  |     expect((await withoutArtist.json()) as { ok: boolean }).toMatchObject({ ok: false });
  54  | 
  55  |     /* Documented deviation (see DEPLOYMENT.md, "Known deviations"): this route
  56  |        coerces an unknown period to "week" instead of returning 400. The artists
  57  |        route rejects it. Pinned here so a future fix flips this assertion. */
  58  |     const badPeriod = await getJson(request, `/api/leaderboard?artistId=${ARTIST_ID}&period=decade`);
  59  |     expect(badPeriod.response.status()).toBe(200);
  60  |     expect(badPeriod.payload.period).toBe("week");
  61  |   });
  62  | 
  63  |   test("GET /api/leaderboard exposes the viewer row once signed in", async ({ page }) => {
  64  |     await signInAsDemo(page);
  65  |     const { payload } = await getJson(
  66  |       page.request,
  67  |       `/api/leaderboard?artistId=${ARTIST_ID}&period=week`,
  68  |     );
  69  |     const me = payload.me as Record<string, unknown> | null;
  70  |     expect(me).not.toBeNull();
  71  |     expect(me?.userId).toBe(DEMO_USER_ID);
  72  |     expect(me?.isMe).toBe(true);
  73  |   });
  74  | 
  75  |   test("GET /api/leaderboard/artists returns the global board and 400 on a bad period", async ({
  76  |     request,
  77  |   }) => {
  78  |     for (const period of ["week", "month", "year"]) {
  79  |       const { response, payload } = await getJson(
  80  |         request,
  81  |         `/api/leaderboard/artists?period=${period}`,
  82  |       );
  83  |       expect(response.status()).toBe(200);
  84  |       expect(payload.ok).toBe(true);
  85  |       expect(payload.period).toBe(period);
  86  | 
  87  |       const rows = payload.rows as Record<string, unknown>[];
  88  |       expect(rows.length).toBe(ARTIST_COUNT);
  89  |       const first = rows[0] as { artist: Record<string, unknown>; fans: number; points: number };
  90  |       expect(first.artist).toHaveProperty("id");
  91  |       expect(first.artist).toHaveProperty("name");
  92  |       expect(Array.isArray(first.artist.genres)).toBe(true);
  93  |       expect(typeof first.fans).toBe("number");
  94  |       expect(typeof first.points).toBe("number");
  95  |     }
  96  | 
  97  |     const bad = await request.get("/api/leaderboard/artists?period=decade");
  98  |     expect(bad.status()).toBe(400);
  99  |     expect((await bad.json()) as { ok: boolean }).toMatchObject({ ok: false });
  100 |   });
  101 | 
  102 |   test("GET /api/feed returns seeded events", async ({ request }) => {
  103 |     const { response, payload } = await getJson(request, "/api/feed?scope=global&limit=30");
  104 |     expect(response.status()).toBe(200);
  105 |     expect(payload.ok).toBe(true);
  106 |     expect(payload.scope).toBe("global");
  107 | 
  108 |     const events = payload.events as Record<string, unknown>[];
  109 |     expect(events.length).toBeGreaterThan(0);
  110 |     for (const key of ["id", "kind", "message", "createdAt", "meta"]) {
  111 |       expect(events[0], `event is missing ${key}`).toHaveProperty(key);
  112 |     }
  113 |     expect(typeof events[0].message).toBe("string");
  114 |     expect((events[0].message as string).length).toBeGreaterThan(0);
  115 |   });
  116 | 
  117 |   test("GET /api/card/:artistId returns a PNG fan card", async ({ request }) => {
  118 |     for (const period of ["week", "month"]) {
  119 |       const response = await request.get(`/api/card/${ARTIST_ID}?period=${period}`);
  120 |       expect(response.status()).toBe(200);
  121 |       expect(response.headers()["content-type"] ?? "").toContain("image/png");
  122 | 
  123 |       const body = await response.body();
  124 |       expect(body.byteLength).toBeGreaterThan(1000);
  125 |       // PNG magic number.
  126 |       expect(body.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  127 |     }
  128 | 
  129 |     const missing = await request.get("/api/card/not-a-real-artist");
  130 |     expect(missing.status()).toBe(404);
  131 |   });
  132 | 
  133 |   test("POST /api/sync is refused when signed out", async ({ request }) => {
  134 |     const response = await request.post("/api/sync");
  135 |     expect(response.status()).toBe(401);
  136 |     expect((await response.json()) as { ok: boolean }).toMatchObject({ ok: false });
  137 |   });
  138 | 
  139 |   test("GET /api/cron/sync requires the bearer CRON_SECRET", async ({ request }) => {
  140 |     const anonymous = await request.get("/api/cron/sync");
> 141 |     expect(anonymous.status()).toBe(401);
      |                                ^ Error: expect(received).toBe(expected) // Object.is equality
  142 | 
  143 |     const wrong = await request.get("/api/cron/sync", {
  144 |       headers: { authorization: "Bearer not-the-secret" },
  145 |     });
  146 |     expect(wrong.status()).toBe(401);
  147 | 
  148 |     // Same mechanism Vercel Cron uses: `Authorization: Bearer $CRON_SECRET`.
  149 |     const authorized = await request.get("/api/cron/sync", {
  150 |       headers: { authorization: `Bearer ${TEST_CRON_SECRET}` },
  151 |     });
  152 |     expect(authorized.status()).toBe(200);
  153 |     expect((await authorized.json()) as { ok: boolean }).toMatchObject({ ok: true });
  154 |   });
  155 | 
  156 |   /*
  157 |    * BLOCKED: there is no health route in this tree
  158 |    * (`src/app/api/health/route.ts` does not exist), so the endpoint the
  159 |    * deployment runbook needs for uptime checks answers 404. Un-skip once the
  160 |    * route ships — see DEPLOYMENT.md, "Blocking issues".
  161 |    */
  162 |   test.fixme("GET /api/health returns ok", async ({ request }) => {
  163 |     const response = await request.get("/api/health");
  164 |     expect(response.status()).toBe(200);
  165 |     expect((await response.json()) as { ok: boolean }).toMatchObject({ ok: true });
  166 |   });
  167 | });
  168 | 
```