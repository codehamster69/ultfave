import { chromium } from "@playwright/test";

const BASE = "http://127.0.0.1:3000";
const tag = process.argv[2] ?? "after";
const out = ".agent/shots";
const browser = await chromium.launch();
const errors = [];

async function shoot(ctxOpts, name, path, { login = false, noJs = false } = {}) {
  const ctx = await browser.newContext({ ...ctxOpts, javaScriptEnabled: !noJs });
  const page = await ctx.newPage();
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") errors.push(`[${name}] ${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`[${name}] pageerror: ${e.message}`));
  if (login) {
    const r = await ctx.request.post(`${BASE}/api/auth/demo`, { maxRedirects: 0 });
    if (r.status() >= 400) errors.push(`[${name}] demo login status ${r.status()}`);
  }
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${out}/ux-account-${name}-${tag}.png`, fullPage: true });
  await ctx.close();
}

const desktop = { viewport: { width: 1440, height: 900 } };
const mobile = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const which = process.argv[3] ?? "all";
if (which === "all" || which === "login") {
  await shoot(desktop, "login-1440", "/login");
  await shoot(mobile, "login-390", "/login");
  await shoot(desktop, "login-error-1440", "/login?error=access_denied");
}
if (which === "all" || which === "me") {
  await shoot(desktop, "me-1440", "/me", { login: true });
  await shoot(mobile, "me-390", "/me", { login: true });
}
if (which === "nojs") {
  await shoot(desktop, "me-nojs-1440", "/me", { login: true, noJs: true });
}
await browser.close();
console.log(errors.length ? errors.join("\n") : "no console errors");
