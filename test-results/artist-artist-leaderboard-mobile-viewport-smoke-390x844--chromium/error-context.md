# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: artist.spec.ts >> artist leaderboard >> mobile viewport smoke (390x844)
- Location: tests/e2e/artist.spec.ts:85:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 200
Received: 500
```

# Page snapshot

```yaml
- generic [active] [ref=e1]: Internal Server Error
```

# Test source

```ts
  1   | import { expect, test } from "@playwright/test";
  2   | 
  3   | import { ARTIST_ID } from "./env";
  4   | import { artistBoard, periodTab, signInAsDemo, switchPeriod } from "./support";
  5   | 
  6   | test.describe("artist leaderboard", () => {
  7   |   test("renders podium and rows for the seeded artist", async ({ page }) => {
  8   |     const response = await page.goto(`/artist/${ARTIST_ID}`);
  9   |     expect(response?.status()).toBe(200);
  10  | 
  11  |     const board = artistBoard(page, ARTIST_ID);
  12  |     await expect(board).toHaveAttribute("data-period", "week");
  13  | 
  14  |     // Podium: the top three ranks, rendered as the first list inside the board.
  15  |     const podium = board.locator("ul").first();
  16  |     const podiumCards = podium.locator("li");
  17  |     await expect(podiumCards).toHaveCount(3);
  18  |     for (const rank of ["#1", "#2", "#3"]) {
  19  |       await expect(podiumCards.filter({ hasText: rank }).first()).toBeVisible();
  20  |     }
  21  | 
  22  |     // Ranked rows below the podium.
  23  |     const rowLists = board.locator("ul");
  24  |     expect(await rowLists.count()).toBeGreaterThanOrEqual(2);
  25  |     const rows = rowLists.nth(1).locator("li");
  26  |     expect(await rows.count()).toBeGreaterThan(0);
  27  |     await expect(rows.first()).toContainText("@");
  28  |   });
  29  | 
  30  |   test("signed-out visitor sees the join CTA and no sync control", async ({ page }) => {
  31  |     await page.goto(`/artist/${ARTIST_ID}`);
  32  | 
  33  |     await expect(page.getByRole("link", { name: "Join the board" })).toBeVisible();
  34  |     await expect(page.getByRole("button", { name: /sync/i })).toHaveCount(0);
  35  | 
  36  |     // Signed out, the follow controls on the board are links to /login.
  37  |     const board = artistBoard(page, ARTIST_ID);
  38  |     const loginLinks = board.locator('a[href="/login"]');
  39  |     expect(await loginLinks.count()).toBeGreaterThan(0);
  40  | 
  41  |     await page.getByRole("link", { name: "Join the board" }).click();
  42  |     await page.waitForURL(/\/login$/);
  43  |   });
  44  | 
  45  |   test("period switch updates the URL and the rendered board", async ({ page }) => {
  46  |     await page.goto(`/artist/${ARTIST_ID}`);
  47  | 
  48  |     const responses: { url: string; status: number }[] = [];
  49  |     page.on("response", (response) => {
  50  |       if (response.url().includes(`/artist/${ARTIST_ID}`) && response.request().isNavigationRequest()) {
  51  |         responses.push({ url: response.url(), status: response.status() });
  52  |       }
  53  |     });
  54  | 
  55  |     for (const period of ["month", "year", "week"] as const) {
  56  |       await switchPeriod(page, period, ARTIST_ID);
  57  |       expect(new URL(page.url()).searchParams.get("period")).toBe(period);
  58  |       await expect(periodTab(page, period)).toHaveAttribute("aria-current", "page");
  59  |       await expect(artistBoard(page, ARTIST_ID)).toHaveAttribute("data-period", period);
  60  |     }
  61  | 
  62  |     expect(responses.some((entry) => entry.status === 200)).toBe(true);
  63  |   });
  64  | 
  65  |   test("signed-in fan gets standing, sync control and follow buttons", async ({ page }) => {
  66  |     await signInAsDemo(page);
  67  |     await page.goto(`/artist/${ARTIST_ID}`);
  68  | 
  69  |     await expect(page.getByRole("link", { name: "Join the board" })).toHaveCount(0);
  70  |     await expect(page.getByRole("button", { name: /sync/i })).toBeVisible();
  71  |     await expect(page.locator("#standing")).toBeVisible();
  72  | 
  73  |     const followButtons = artistBoard(page, ARTIST_ID).locator(
  74  |       'button[aria-label^="Follow "], button[aria-label^="Unfollow "]',
  75  |     );
  76  |     expect(await followButtons.count()).toBeGreaterThan(0);
  77  |     await expect(followButtons.first()).toHaveAttribute("aria-pressed", /true|false/);
  78  |   });
  79  | 
  80  |   test("unknown artist id returns the 404 page", async ({ page }) => {
  81  |     const response = await page.goto("/artist/not-a-real-artist");
  82  |     expect(response?.status()).toBe(404);
  83  |   });
  84  | 
  85  |   test("mobile viewport smoke (390x844)", async ({ page }) => {
  86  |     await page.setViewportSize({ width: 390, height: 844 });
  87  | 
  88  |     const response = await page.goto(`/artist/${ARTIST_ID}`);
> 89  |     expect(response?.status()).toBe(200);
      |                                ^ Error: expect(received).toBe(expected) // Object.is equality
  90  | 
  91  |     const board = artistBoard(page, ARTIST_ID);
  92  |     await expect(board).toBeVisible();
  93  |     await expect(board.locator("ul").first().locator("li").first()).toBeVisible();
  94  |     await expect(periodTab(page, "week")).toBeVisible();
  95  | 
  96  |     const horizontalOverflow = await page.evaluate(
  97  |       () => document.documentElement.scrollWidth - window.innerWidth,
  98  |     );
  99  |     expect(horizontalOverflow, "artist page should not scroll horizontally on mobile").toBeLessThanOrEqual(
  100 |       1,
  101 |     );
  102 |   });
  103 | });
  104 | 
```