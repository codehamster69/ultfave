import { expect, type Locator, type Page } from "@playwright/test";

import { SENTINEL_EVENT_ID } from "./env";

/**
 * Shared helpers. Selectors intentionally rely on roles, accessible names, URL
 * shape, data attributes and API payloads — never on marketing copy — so a
 * rebrand does not break the launch gate.
 */

/** Signs the context in as the seeded demo account via the real route handler. */
export async function signInAsDemo(page: Page): Promise<void> {
  const response = await page.request.post("/api/auth/demo", { maxRedirects: 0 });
  expect(
    response.status(),
    `POST /api/auth/demo should set a session, got ${response.status()}`,
  ).toBeLessThan(400);
}

/** The period segmented control (`nav[aria-label="Leaderboard period"]`). */
export function periodTabs(page: Page): Locator {
  return page.getByRole("navigation", { name: "Leaderboard period" });
}

export function periodTab(page: Page, period: string): Locator {
  return periodTabs(page).first().locator(`a[data-period-tab="${period}"]`);
}

/** The account chip the header renders once a session exists. */
export function accountChip(page: Page): Locator {
  return page.locator('header a[title^="Signed in as "]').first();
}

export function headerSignInLink(page: Page): Locator {
  return page.locator("header").getByRole("link", { name: "Sign in", exact: true });
}

/** Artist leaderboard section (podium + rows), keyed by data attributes. */
export function artistBoard(page: Page, artistId: string): Locator {
  return page.locator(`section[data-artist="${artistId}"]`);
}

/**
 * Clicks a period tab and waits for both the URL and the rendered board to
 * settle on the requested period. Returns the response of the navigation.
 */
export async function switchPeriod(
  page: Page,
  period: "week" | "month" | "year",
  artistId?: string,
): Promise<void> {
  await periodTab(page, period).click();
  await page.waitForURL(new RegExp(`[?&]period=${period}(&|$)`));
  await expect(periodTab(page, period)).toHaveAttribute("aria-current", "page");
  if (artistId) {
    await expect(artistBoard(page, artistId)).toHaveAttribute("data-period", period);
  }
}

/** Fails the test when a spec assumes the seeded DB but the app serves another. */
export async function expectSeededDatabase(page: Page): Promise<void> {
  const response = await page.request.get("/api/feed?scope=global&limit=50");
  expect(response.status(), "GET /api/feed should succeed").toBe(200);
  const payload = (await response.json()) as { ok?: boolean; events?: { id: string }[] };
  expect(payload.ok, "feed payload ok flag").toBe(true);
  const ids = (payload.events ?? []).map((event) => event.id);
  expect(
    ids,
    [
      "The server is not serving the seeded test database.",
      "Global setup seeds file:test.db; if a dev server on port 3000 is reused it may be",
      "serving local.db instead. Run `npm run test:e2e` with port 3000 free, or set CI=1.",
    ].join(" "),
  ).toContain(SENTINEL_EVENT_ID);
}
