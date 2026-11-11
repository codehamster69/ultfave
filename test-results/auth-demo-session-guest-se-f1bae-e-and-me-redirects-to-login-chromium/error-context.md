# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> demo session >> guest sees the sign-in affordance and /me redirects to /login
- Location: tests/e2e/auth.spec.ts:7:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('header').getByRole('link', { name: 'Sign in', exact: true })
Expected: visible
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('header').getByRole('link', { name: 'Sign in', exact: true }) with timeout 10000ms
  - waiting for locator('header').getByRole('link', { name: 'Sign in', exact: true })
  - Target page, context or browser has been closed

```

```yaml
- text: Internal Server Error
```

```
Error: write EPIPE
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | 
  3  | import { DEMO_USER_NAME } from "./env";
  4  | import { accountChip, headerSignInLink, signInAsDemo } from "./support";
  5  | 
  6  | test.describe("demo session", () => {
  7  |   test("guest sees the sign-in affordance and /me redirects to /login", async ({ page }) => {
  8  |     await page.goto("/");
> 9  |     await expect(headerSignInLink(page)).toBeVisible();
     |     ^ Error: write EPIPE
  10 |     await expect(accountChip(page)).toHaveCount(0);
  11 | 
  12 |     await page.goto("/me");
  13 |     await page.waitForURL(/\/login/);
  14 |     expect(new URL(page.url()).pathname).toBe("/login");
  15 |   });
  16 | 
  17 |   test("demo login through the UI lands on /me and the header shows the account", async ({
  18 |     page,
  19 |   }) => {
  20 |     await page.goto("/login");
  21 |     await expect(page).toHaveURL(/\/login$/);
  22 | 
  23 |     await page.getByRole("button", { name: "Enter as demo fan" }).click();
  24 | 
  25 |     await page.waitForURL(/\/me$/);
  26 |     expect(new URL(page.url()).pathname).toBe("/me");
  27 | 
  28 |     const chip = accountChip(page);
  29 |     await expect(chip).toBeVisible();
  30 |     await expect(chip).toHaveAttribute("title", new RegExp(`Signed in as .+`));
  31 |     await expect(chip).toContainText(DEMO_USER_NAME);
  32 |     await expect(chip).toHaveAttribute("href", "/me");
  33 | 
  34 |     await expect(page.locator("header").getByRole("button", { name: "Log out" })).toBeVisible();
  35 |     await expect(headerSignInLink(page)).toHaveCount(0);
  36 | 
  37 |     // The profile page is rendered for the seeded demo account.
  38 |     await expect(page.getByRole("main")).toContainText(DEMO_USER_NAME);
  39 |   });
  40 | 
  41 |   test("demo login via the route handler also creates a session", async ({ request }) => {
  42 |     const response = await request.post("/api/auth/demo", { maxRedirects: 0 });
  43 |     expect([200, 302].includes(response.status())).toBe(true);
  44 |     expect(response.headers()["location"] ?? "").toContain("/me");
  45 | 
  46 |     const cookie = response.headers()["set-cookie"] ?? "";
  47 |     expect(cookie).toContain("fanrank_session=");
  48 |   });
  49 | 
  50 |   test("logout clears the session", async ({ page }) => {
  51 |     await signInAsDemo(page);
  52 |     await page.goto("/me");
  53 |     await expect(accountChip(page)).toBeVisible();
  54 | 
  55 |     await page.locator("header").getByRole("button", { name: "Log out" }).click();
  56 |     await page.waitForURL(/\/$/);
  57 |     await expect(headerSignInLink(page)).toBeVisible();
  58 |     await expect(accountChip(page)).toHaveCount(0);
  59 | 
  60 |     await page.goto("/me");
  61 |     await page.waitForURL(/\/login/);
  62 |     expect(new URL(page.url()).pathname).toBe("/login");
  63 |   });
  64 | });
  65 | 
```