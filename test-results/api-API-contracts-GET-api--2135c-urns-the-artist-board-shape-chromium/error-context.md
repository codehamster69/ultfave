# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: api.spec.ts >> API contracts >> GET /api/leaderboard returns the artist board shape
- Location: tests/e2e/api.spec.ts:12:3

# Error details

```
SyntaxError: Unexpected token 'I', "Internal S"... is not valid JSON
```

# Test source

```ts
  1   | import { expect, test, type APIRequestContext } from "@playwright/test";
  2   | 
  3   | import { ARTIST_COUNT, ARTIST_ID, DEMO_USER_ID, TEST_CRON_SECRET } from "./env";
  4   | import { signInAsDemo } from "./support";
  5   | 
  6   | async function getJson(request: APIRequestContext, path: string) {
  7   |   const response = await request.get(path);
> 8   |   return { response, payload: (await response.json()) as Record<string, unknown> };
      |                                ^ SyntaxError: Unexpected token 'I', "Internal S"... is not valid JSON
  9   | }
  10  | 
  11  | test.describe("API contracts", () => {
  12  |   test("GET /api/leaderboard returns the artist board shape", async ({ request }) => {
  13  |     const { response, payload } = await getJson(
  14  |       request,
  15  |       `/api/leaderboard?artistId=${ARTIST_ID}&period=week`,
  16  |     );
  17  |     expect(response.status()).toBe(200);
  18  |     expect(payload.ok).toBe(true);
  19  |     expect(payload.period).toBe("week");
  20  |     expect(payload.me).toBeNull();
  21  | 
  22  |     const rows = payload.rows as Record<string, unknown>[];
  23  |     expect(Array.isArray(rows)).toBe(true);
  24  |     expect(rows.length).toBeGreaterThan(0);
  25  | 
  26  |     for (const key of [
  27  |       "rank",
  28  |       "prevRank",
  29  |       "delta",
  30  |       "userId",
  31  |       "name",
  32  |       "handle",
  33  |       "avatarUrl",
  34  |       "points",
  35  |       "minutes",
  36  |       "plays",
  37  |       "isMe",
  38  |       "isFriend",
  39  |       "badges",
  40  |     ]) {
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
```