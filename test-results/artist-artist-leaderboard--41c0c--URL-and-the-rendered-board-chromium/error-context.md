# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: artist.spec.ts >> artist leaderboard >> period switch updates the URL and the rendered board
- Location: tests/e2e/artist.spec.ts:45:3

# Error details

```
Error: locator.click: Target page, context or browser has been closed
Call log:
  - waiting for getByRole('navigation', { name: 'Leaderboard period' }).first().locator('a[data-period-tab="month"]')

```

# Test source

```ts
  1  | import { expect, type Locator, type Page } from "@playwright/test";
  2  | 
  3  | import { SENTINEL_EVENT_ID } from "./env";
  4  | 
  5  | /**
  6  |  * Shared helpers. Selectors intentionally rely on roles, accessible names, URL
  7  |  * shape, data attributes and API payloads — never on marketing copy — so a
  8  |  * rebrand does not break the launch gate.
  9  |  */
  10 | 
  11 | /** Signs the context in as the seeded demo account via the real route handler. */
  12 | export async function signInAsDemo(page: Page): Promise<void> {
  13 |   const response = await page.request.post("/api/auth/demo", { maxRedirects: 0 });
  14 |   expect(
  15 |     response.status(),
  16 |     `POST /api/auth/demo should set a session, got ${response.status()}`,
  17 |   ).toBeLessThan(400);
  18 | }
  19 | 
  20 | /** The period segmented control (`nav[aria-label="Leaderboard period"]`). */
  21 | export function periodTabs(page: Page): Locator {
  22 |   return page.getByRole("navigation", { name: "Leaderboard period" });
  23 | }
  24 | 
  25 | export function periodTab(page: Page, period: string): Locator {
  26 |   return periodTabs(page).first().locator(`a[data-period-tab="${period}"]`);
  27 | }
  28 | 
  29 | /** The account chip the header renders once a session exists. */
  30 | export function accountChip(page: Page): Locator {
  31 |   return page.locator('header a[title^="Signed in as "]').first();
  32 | }
  33 | 
  34 | export function headerSignInLink(page: Page): Locator {
  35 |   return page.locator("header").getByRole("link", { name: "Sign in", exact: true });
  36 | }
  37 | 
  38 | /** Artist leaderboard section (podium + rows), keyed by data attributes. */
  39 | export function artistBoard(page: Page, artistId: string): Locator {
  40 |   return page.locator(`section[data-artist="${artistId}"]`);
  41 | }
  42 | 
  43 | /**
  44 |  * Clicks a period tab and waits for both the URL and the rendered board to
  45 |  * settle on the requested period. Returns the response of the navigation.
  46 |  */
  47 | export async function switchPeriod(
  48 |   page: Page,
  49 |   period: "week" | "month" | "year",
  50 |   artistId?: string,
  51 | ): Promise<void> {
> 52 |   await periodTab(page, period).click();
     |                                 ^ Error: locator.click: Target page, context or browser has been closed
  53 |   await page.waitForURL(new RegExp(`[?&]period=${period}(&|$)`));
  54 |   await expect(periodTab(page, period)).toHaveAttribute("aria-current", "page");
  55 |   if (artistId) {
  56 |     await expect(artistBoard(page, artistId)).toHaveAttribute("data-period", period);
  57 |   }
  58 | }
  59 | 
  60 | /** Fails the test when a spec assumes the seeded DB but the app serves another. */
  61 | export async function expectSeededDatabase(page: Page): Promise<void> {
  62 |   const response = await page.request.get("/api/feed?scope=global&limit=50");
  63 |   expect(response.status(), "GET /api/feed should succeed").toBe(200);
  64 |   const payload = (await response.json()) as { ok?: boolean; events?: { id: string }[] };
  65 |   expect(payload.ok, "feed payload ok flag").toBe(true);
  66 |   const ids = (payload.events ?? []).map((event) => event.id);
  67 |   expect(
  68 |     ids,
  69 |     [
  70 |       "The server is not serving the seeded test database.",
  71 |       "Global setup seeds file:test.db; if a dev server on port 3000 is reused it may be",
  72 |       "serving local.db instead. Run `npm run test:e2e` with port 3000 free, or set CI=1.",
  73 |     ].join(" "),
  74 |   ).toContain(SENTINEL_EVENT_ID);
  75 | }
  76 | 
```