import { expect, test } from "@playwright/test";

import { ARTIST_ID } from "./env";
import { artistBoard, periodTab, signInAsDemo, switchPeriod } from "./support";

test.describe("artist leaderboard", () => {
  test("renders podium and rows for the seeded artist", async ({ page }) => {
    const response = await page.goto(`/artist/${ARTIST_ID}`);
    expect(response?.status()).toBe(200);

    const board = artistBoard(page, ARTIST_ID);
    await expect(board).toHaveAttribute("data-period", "week");

    // Podium: the top three ranks, rendered as the first list inside the board.
    const podium = board.locator("ul").first();
    const podiumCards = podium.locator("li");
    await expect(podiumCards).toHaveCount(3);
    for (const rank of ["#1", "#2", "#3"]) {
      await expect(podiumCards.filter({ hasText: rank }).first()).toBeVisible();
    }

    // Ranked rows below the podium.
    const rowLists = board.locator("ul");
    expect(await rowLists.count()).toBeGreaterThanOrEqual(2);
    const rows = rowLists.nth(1).locator("li");
    expect(await rows.count()).toBeGreaterThan(0);
    await expect(rows.first()).toContainText("@");
  });

  test("signed-out visitor sees the join CTA and no sync control", async ({ page }) => {
    await page.goto(`/artist/${ARTIST_ID}`);

    await expect(page.getByRole("link", { name: "Join the board" })).toBeVisible();
    await expect(page.getByRole("button", { name: /sync/i })).toHaveCount(0);

    // Signed out, the follow controls on the board are links to /login.
    const board = artistBoard(page, ARTIST_ID);
    const loginLinks = board.locator('a[href="/login"]');
    expect(await loginLinks.count()).toBeGreaterThan(0);

    await page.getByRole("link", { name: "Join the board" }).click();
    await page.waitForURL(/\/login$/);
  });

  test("period switch updates the URL and the rendered board", async ({ page }) => {
    await page.goto(`/artist/${ARTIST_ID}`);

    const responses: { url: string; status: number }[] = [];
    page.on("response", (response) => {
      if (response.url().includes(`/artist/${ARTIST_ID}`) && response.request().isNavigationRequest()) {
        responses.push({ url: response.url(), status: response.status() });
      }
    });

    for (const period of ["month", "year", "week"] as const) {
      await switchPeriod(page, period, ARTIST_ID);
      expect(new URL(page.url()).searchParams.get("period")).toBe(period);
      await expect(periodTab(page, period)).toHaveAttribute("aria-current", "page");
      await expect(artistBoard(page, ARTIST_ID)).toHaveAttribute("data-period", period);
    }

    expect(responses.some((entry) => entry.status === 200)).toBe(true);
  });

  test("signed-in fan gets standing, sync control and follow buttons", async ({ page }) => {
    await signInAsDemo(page);
    await page.goto(`/artist/${ARTIST_ID}`);

    await expect(page.getByRole("link", { name: "Join the board" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /sync/i })).toBeVisible();
    await expect(page.locator("#standing")).toBeVisible();

    const followButtons = artistBoard(page, ARTIST_ID).locator(
      'button[aria-label^="Follow "], button[aria-label^="Unfollow "]',
    );
    expect(await followButtons.count()).toBeGreaterThan(0);
    await expect(followButtons.first()).toHaveAttribute("aria-pressed", /true|false/);
  });

  test("unknown artist id returns the 404 page", async ({ page }) => {
    const response = await page.goto("/artist/not-a-real-artist");
    expect(response?.status()).toBe(404);
  });

  test("mobile viewport smoke (390x844)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    const response = await page.goto(`/artist/${ARTIST_ID}`);
    expect(response?.status()).toBe(200);

    const board = artistBoard(page, ARTIST_ID);
    await expect(board).toBeVisible();
    await expect(board.locator("ul").first().locator("li").first()).toBeVisible();
    await expect(periodTab(page, "week")).toBeVisible();

    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(horizontalOverflow, "artist page should not scroll horizontally on mobile").toBeLessThanOrEqual(
      1,
    );
  });
});
