import { expect, test, type Page } from "@playwright/test";

import { ARTIST_COUNT, ARTIST_ID } from "./env";
import { expectSeededDatabase, periodTab, switchPeriod } from "./support";

const BOARD = "#artists";

async function domArtistOrder(page: Page): Promise<string[]> {
  const hrefs = await page
    .locator(`${BOARD} a[href^="/artist/"]`)
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href") ?? ""));
  return hrefs.map((href) => href.replace(/^\/artist\//, ""));
}

async function apiArtistOrder(page: Page, period: string): Promise<string[]> {
  const response = await page.request.get(`/api/leaderboard/artists?period=${period}`);
  expect(response.status()).toBe(200);
  const payload = (await response.json()) as { rows: { artist: { id: string } }[] };
  return payload.rows.map((row) => row.artist.id);
}

test.describe("home", () => {
  test("loads the seeded database and renders the global artist board", async ({ page }) => {
    await expectSeededDatabase(page);

    const response = await page.goto("/");
    expect(response?.status()).toBe(200);

    const board = page.locator(BOARD);
    await expect(board).toBeVisible();

    const rows = board.locator('a[href^="/artist/"]');
    await expect(rows).toHaveCount(ARTIST_COUNT);
    await expect(board.locator(`a[href="/artist/${ARTIST_ID}"]`).first()).toBeVisible();

    // Rows must reflect the default (week) ranking from the API, in order.
    expect(await domArtistOrder(page)).toEqual(await apiArtistOrder(page, "week"));
  });

  test("period tabs switch week/month/year in the URL and the content", async ({ page }) => {
    await page.goto("/#artists");

    const tabs = page.getByRole("navigation", { name: "Leaderboard period" });
    await expect(tabs.first()).toBeVisible();
    await expect(periodTab(page, "week")).toHaveAttribute("aria-current", "page");

    for (const period of ["month", "year", "week"] as const) {
      await switchPeriod(page, period);

      expect(new URL(page.url()).searchParams.get("period")).toBe(period);
      await expect(periodTab(page, period)).toHaveAttribute("aria-current", "page");
      for (const other of ["week", "month", "year"].filter((value) => value !== period)) {
        await expect(periodTab(page, other)).not.toHaveAttribute("aria-current", "page");
      }

      const rows = page.locator(`${BOARD} a[href^="/artist/"]`);
      await expect(rows).toHaveCount(ARTIST_COUNT);
      const expected = await apiArtistOrder(page, period);
      expect(await domArtistOrder(page), `board order for period=${period}`).toEqual(expected);
    }
  });

  test("mobile viewport smoke (390x844)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    const response = await page.goto("/");
    expect(response?.status()).toBe(200);

    await expect(page.locator(BOARD)).toBeVisible();
    await expect(page.locator(`${BOARD} a[href^="/artist/"]`).first()).toBeVisible();

    // The compact header exposes navigation through the menu button only.
    const menuButton = page.getByRole("button", { name: "Open menu" });
    await expect(menuButton).toBeVisible();
    await menuButton.click();
    const mobileNav = page.getByRole("navigation", { name: "Mobile" });
    await expect(mobileNav).toBeVisible();
    await expect(mobileNav.getByRole("link", { name: /Me/ })).toBeVisible();

    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(horizontalOverflow, "home should not scroll horizontally on mobile").toBeLessThanOrEqual(1);
  });
});
