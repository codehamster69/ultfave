import { chromium } from "@playwright/test";

const BASE = "http://127.0.0.1:3000";
const tag = process.argv[2] ?? "after";
const which = process.argv[3] ?? "shots";
const out = ".agent/shots";
const browser = await chromium.launch();
const errors = [];
const notes = [];

async function newCtx(opts, { login = true, noJs = false } = {}) {
  const ctx = await browser.newContext({ ...opts, javaScriptEnabled: !noJs });
  if (login) {
    const r = await ctx.request.get(`${BASE}/api/auth/demo`, { maxRedirects: 0 });
    if (r.status() >= 400) errors.push(`demo login status ${r.status()}`);
  }
  return ctx;
}

function watch(page, name) {
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") errors.push(`[${name}] ${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`[${name}] pageerror: ${e.message}`));
}

async function shoot(opts, name, path, flags = {}) {
  const ctx = await newCtx(opts, flags);
  const page = await ctx.newPage();
  watch(page, name);
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/ux-social-${name}-${tag}.png`, fullPage: true });
  await ctx.close();
}

const desktop = { viewport: { width: 1440, height: 900 } };
const mobile = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

if (which === "shots" || which === "all") {
  await shoot(desktop, "friends-1440", "/friends");
  await shoot(mobile, "friends-390", "/friends");
  await shoot(desktop, "activity-1440", "/activity");
  await shoot(mobile, "activity-390", "/activity");
}
if (which === "nojs" || which === "all") {
  await shoot(desktop, "friends-nojs-1440", "/friends", { noJs: true });
  await shoot(desktop, "activity-nojs-1440", "/activity", { noJs: true });
  await shoot(mobile, "activity-guest-390", "/activity", { login: false });
}
if (which === "interact" || which === "all") {
  const ctx = await newCtx(desktop);
  const page = await ctx.newPage();
  watch(page, "interact");
  await page.goto(`${BASE}/friends`, { waitUntil: "networkidle" });
  const btn = page.locator('[data-follow-button][aria-pressed="false"]').first();
  if ((await btn.count()) === 0) {
    notes.push("no unfollowed follow button found");
  } else {
    const uid = await btn.getAttribute("data-user-id");
    await btn.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(150);
    notes.push(`after follow click pressed=${await page.locator(`[data-follow-button][data-user-id="${uid}"]`).first().getAttribute("aria-pressed")}`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${out}/ux-social-friends-followed-${tag}.png`, fullPage: true });
    const again = page.locator(`[data-follow-button][data-user-id="${uid}"][aria-pressed="true"]`).first();
    notes.push(`followed buttons for ${uid}: ${await page.locator(`[data-follow-button][data-user-id="${uid}"][aria-pressed="true"]`).count()}`);
    await again.click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1200);
    notes.push(`after unfollow, pressed=true count ${await page.locator(`[data-follow-button][data-user-id="${uid}"][aria-pressed="true"]`).count()}`);
  }
  // Rollback: force the API to fail and confirm the button reverts.
  await page.route("**/api/follow", (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ ok: false, error: "Could not update follow state." }) }));
  const fb = page.locator('[data-follow-button][aria-pressed="false"]').first();
  if (await fb.count()) {
    const uid = await fb.getAttribute("data-user-id");
    await fb.click();
    await page.waitForTimeout(800);
    const pressed = await page.locator(`[data-follow-button][data-user-id="${uid}"]`).first().getAttribute("aria-pressed");
    notes.push(`rollback test: pressed after failure=${pressed}`);
    await page.screenshot({ path: `${out}/ux-social-friends-rollback-${tag}.png`, fullPage: false });
  }
  await page.unroute("**/api/follow");

  await page.goto(`${BASE}/activity`, { waitUntil: "networkidle" });
  const join = page.locator("[data-join-challenge]").first();
  if (await join.count()) {
    await join.click();
    await page.waitForTimeout(1500);
    notes.push(`join status text: ${await page.locator("[data-challenge-status]").first().innerText()}`);
  } else notes.push("no join button (all joined?)");
  const filter = page.locator('[data-feed-filter="overtake"]');
  if (await filter.count()) {
    await filter.click();
    await page.waitForTimeout(400);
    notes.push(`overtake filter rows: ${await page.locator("[data-feed-item]").count()}`);
    await page.screenshot({ path: `${out}/ux-social-activity-filter-${tag}.png`, fullPage: false });
  }
  await ctx.close();
}
await browser.close();
console.log(notes.join("\n"));
console.log(errors.length ? errors.join("\n") : "no console errors");
