import { expect, test, type Page } from "@playwright/test";

import { JOINABLE_CHALLENGE_ID, JOINABLE_CHALLENGE_TITLE } from "./env";
import { expectSeededDatabase, signInAsDemo } from "./support";

async function join(page: Page) {
  const response = await page.request.post(`/api/challenges/${JOINABLE_CHALLENGE_ID}/join`);
  const payload = (await response.json()) as { ok: boolean; error?: string };
  return { status: response.status(), payload };
}

test.describe("challenges", () => {
  // This spec writes rows: make sure the target is the throwaway test DB.
  test.beforeEach(async ({ page }) => {
    await expectSeededDatabase(page);
  });

  test("joining returns ok and is idempotent", async ({ page }) => {
    // Signed out the endpoint refuses to enrol anyone.
    const anonymous = await page.request.post(`/api/challenges/${JOINABLE_CHALLENGE_ID}/join`);
    expect(anonymous.status()).toBe(401);

    await signInAsDemo(page);

    const first = await join(page);
    expect(first.status).toBe(200);
    expect(first.payload).toEqual({ ok: true });

    const second = await join(page);
    expect(second.status).toBe(200);
    expect(second.payload).toEqual({ ok: true });

    const missing = await page.request.post("/api/challenges/does-not-exist/join");
    expect(missing.status()).toBe(404);
  });

  test("the activity page reflects the joined state exactly once", async ({ page }) => {
    await signInAsDemo(page);
    await page.goto("/activity");

    const card = page
      .getByRole("article")
      .filter({ has: page.getByRole("heading", { name: JOINABLE_CHALLENGE_TITLE }) });
    await expect(card).toHaveCount(1);
    await expect(card).toBeVisible();

    const joinButton = card.getByRole("button", { name: "join", exact: true });
    if (await joinButton.isVisible()) {
      await joinButton.click();
      await expect(joinButton).toHaveCount(0);
    }

    // One entry, no matter how often the endpoint was called.
    await expect(card.getByText("joined", { exact: true })).toHaveCount(1);

    const participants = card.getByText(/\d+\s+joined/);
    const before = (await participants.first().textContent()) ?? "";
    const repeated = await join(page);
    expect(repeated.payload).toEqual({ ok: true });

    await page.reload();
    const refreshedCard = page
      .getByRole("article")
      .filter({ has: page.getByRole("heading", { name: JOINABLE_CHALLENGE_TITLE }) });
    const after = (await refreshedCard.getByText(/\d+\s+joined/).first().textContent()) ?? "";
    expect(after).toBe(before);
  });
});
