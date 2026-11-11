import { expect, test, type Page } from "@playwright/test";

import { ARTIST_ID, SECOND_DEMO_USER_ID } from "./env";
import { artistBoard, expectSeededDatabase, signInAsDemo } from "./support";

type FollowResponse = { ok: boolean; following?: boolean; error?: string };

async function setFollow(page: Page, userId: string, action: "follow" | "unfollow") {
  const response = await page.request.post("/api/follow", {
    data: { userId, action },
  });
  const payload = (await response.json()) as FollowResponse;
  return { status: response.status(), payload };
}

test.describe("follow / unfollow", () => {
  // This spec writes rows: make sure the target is the throwaway test DB.
  test.beforeEach(async ({ page }) => {
    await expectSeededDatabase(page);
  });

  test("POST /api/follow returns ok and toggles the state for a seeded fan", async ({ page }) => {
    await signInAsDemo(page);

    // Normalise: the seed may already follow this fan.
    const cleared = await setFollow(page, SECOND_DEMO_USER_ID, "unfollow");
    expect(cleared.status).toBe(200);
    expect(cleared.payload).toEqual({ ok: true, following: false });

    const followed = await setFollow(page, SECOND_DEMO_USER_ID, "follow");
    expect(followed.status).toBe(200);
    expect(followed.payload).toEqual({ ok: true, following: true });

    // Idempotent: following twice stays following.
    const repeated = await setFollow(page, SECOND_DEMO_USER_ID, "follow");
    expect(repeated.payload).toEqual({ ok: true, following: true });

    const unfollowed = await setFollow(page, SECOND_DEMO_USER_ID, "unfollow");
    expect(unfollowed.payload).toEqual({ ok: true, following: false });

    // Restore nothing: the seed owns the initial state and each run reseeds.
  });

  test("rejects unauthenticated, self-follow and malformed requests", async ({ page, request }) => {
    const anonymous = await request.post("/api/follow", {
      data: { userId: SECOND_DEMO_USER_ID, action: "follow" },
    });
    expect(anonymous.status()).toBe(401);
    expect((await anonymous.json()) as FollowResponse).toMatchObject({ ok: false });

    await signInAsDemo(page);

    const self = await page.request.post("/api/follow", {
      data: { userId: "demo-you", action: "follow" },
    });
    expect(self.status()).toBe(400);
    expect((await self.json()) as FollowResponse).toMatchObject({ ok: false });

    const malformed = await page.request.post("/api/follow", {
      data: { userId: SECOND_DEMO_USER_ID, action: "befriend" },
    });
    expect(malformed.status()).toBe(400);
    expect((await malformed.json()) as FollowResponse).toMatchObject({ ok: false });
  });

  test("the board follow button toggles aria-pressed and survives a reload", async ({ page }) => {
    await signInAsDemo(page);
    await page.goto(`/artist/${ARTIST_ID}`);

    const buttons = artistBoard(page, ARTIST_ID).locator(
      'button[aria-label^="Follow "], button[aria-label^="Unfollow "]',
    );
    const button = buttons.first();
    await expect(button).toBeVisible();

    const label = (await button.getAttribute("aria-label")) ?? "";
    const name = label.replace(/^(Follow|Unfollow)\s+/, "");
    expect(name.length).toBeGreaterThan(0);

    const wasFollowing = (await button.getAttribute("aria-pressed")) === "true";
    const nextLabel = `${wasFollowing ? "Follow" : "Unfollow"} ${name}`;
    const nextPressed = wasFollowing ? "false" : "true";

    await button.click();

    const toggled = artistBoard(page, ARTIST_ID).locator(
      `button[aria-label="${nextLabel}"]`,
    );
    await expect(toggled).toHaveAttribute("aria-pressed", nextPressed);
    await expect(page.getByRole("alert")).toHaveCount(0);

    // The state is persisted server-side, not just optimistic in the client.
    await page.reload();
    await expect(
      artistBoard(page, ARTIST_ID).locator(`button[aria-label="${nextLabel}"]`),
    ).toHaveAttribute("aria-pressed", nextPressed);

    // Put the board back the way the seed left it.
    await artistBoard(page, ARTIST_ID)
      .locator(`button[aria-label="${nextLabel}"]`)
      .click();
    await expect(
      artistBoard(page, ARTIST_ID).locator(`button[aria-label="${label}"]`),
    ).toHaveAttribute("aria-pressed", wasFollowing ? "true" : "false");
  });
});
