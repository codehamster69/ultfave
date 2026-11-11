import { expect, test } from "@playwright/test";

import { DEMO_USER_NAME } from "./env";
import { accountChip, headerSignInLink, signInAsDemo } from "./support";

test.describe("demo session", () => {
  test("guest sees the sign-in affordance and /me redirects to /login", async ({ page }) => {
    await page.goto("/");
    await expect(headerSignInLink(page)).toBeVisible();
    await expect(accountChip(page)).toHaveCount(0);

    await page.goto("/me");
    await page.waitForURL(/\/login/);
    expect(new URL(page.url()).pathname).toBe("/login");
  });

  test("demo login through the UI lands on /me and the header shows the account", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login$/);

    await page.getByRole("button", { name: "Enter as demo fan" }).click();

    await page.waitForURL(/\/me$/);
    expect(new URL(page.url()).pathname).toBe("/me");

    const chip = accountChip(page);
    await expect(chip).toBeVisible();
    await expect(chip).toHaveAttribute("title", new RegExp(`Signed in as .+`));
    await expect(chip).toContainText(DEMO_USER_NAME);
    await expect(chip).toHaveAttribute("href", "/me");

    await expect(page.locator("header").getByRole("button", { name: "Log out" })).toBeVisible();
    await expect(headerSignInLink(page)).toHaveCount(0);

    // The profile page is rendered for the seeded demo account.
    await expect(page.getByRole("main")).toContainText(DEMO_USER_NAME);
  });

  test("demo login via the route handler also creates a session", async ({ request }) => {
    const response = await request.post("/api/auth/demo", { maxRedirects: 0 });
    expect([200, 302].includes(response.status())).toBe(true);
    expect(response.headers()["location"] ?? "").toContain("/me");

    const cookie = response.headers()["set-cookie"] ?? "";
    expect(cookie).toContain("ultfave_session=");
  });

  test("logout clears the session", async ({ page }) => {
    await signInAsDemo(page);
    await page.goto("/me");
    await expect(accountChip(page)).toBeVisible();

    await page.locator("header").getByRole("button", { name: "Log out" }).click();
    await page.waitForURL(/\/$/);
    await expect(headerSignInLink(page)).toBeVisible();
    await expect(accountChip(page)).toHaveCount(0);

    await page.goto("/me");
    await page.waitForURL(/\/login/);
    expect(new URL(page.url()).pathname).toBe("/login");
  });
});
