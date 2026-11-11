import { chromium } from "@playwright/test";
const base = "http://127.0.0.1:3000";
const tag = process.argv[2] ?? "v1";
const path = process.argv[3] ?? "/artist/nova-kestrel?period=week";
const anon = process.argv.includes("--anon");
const browser = await chromium.launch();
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push(`[${m.type()}] ${m.text().slice(0, 400)}`); });
  page.on("pageerror", (e) => errors.push(`[pageerror] ${e.message}`));
  if (!anon) { const r = await ctx.request.post(`${base}/api/auth/demo`, { maxRedirects: 0, headers: { origin: base } }); console.log("demo", r.status()); }
  await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const sw = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  await page.screenshot({ path: `.agent/shots/ux-artist-${tag}-${w}.png`, fullPage: true });
  // scroll to middle and screenshot viewport for sticky checks
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.55));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `.agent/shots/ux-artist-${tag}-${w}-scrolled.png` });
  console.log(w, "scrollWidth", sw, "errors:", errors.length ? "\n  " + errors.join("\n  ") : "none");
  await ctx.close();
}
await browser.close();
