// Measures layout shift (CLS) on every website route of the static demo, on cold load and after hash navigation.
// Usage: node scripts/demo/layout-shift.mjs [dist-dir] [screenshot-dir]
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = fileURLToPath(new URL("../../", import.meta.url));
const dist = resolve(process.argv[2] ?? resolve(root, "packages/client/dist-demo"));
const shots = process.argv[3] ? resolve(process.argv[3]) : null;
const { base } = JSON.parse(await readFile(resolve(dist, "demo-build.json"), "utf8"));
const routes = ["#/", "#/features", "#/download", "#/about", "#/docs", "#/docs/installation/windows.md", "#/demo"];
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, "http://localhost").pathname.slice(base.length));
    const target = resolve(dist, path || "index.html");
    assert.ok(target.startsWith(dist + sep));
    const data = await readFile(target);
    res.writeHead(200, { "Content-Type": types[extname(target)] ?? "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const url = `http://127.0.0.1:${server.address().port}${base}`;
if (shots) await mkdir(shots, { recursive: true });

const observe = () => {
  window.__shifts = [];
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.hadRecentInput) continue;
      window.__shifts.push({
        value: entry.value,
        nodes: entry.sources.map((source) => {
          const node = source.node;
          if (!node || node.nodeType !== 1) return node?.nodeName ?? "?";
          return `${node.tagName.toLowerCase()}${node.dataset.testid ? `[${node.dataset.testid}]` : ""}.${String(node.className).slice(0, 60)}`;
        }),
      });
    }
  }).observe({ type: "layout-shift", buffered: true });
};
const settle = (page) => page.waitForLoadState("networkidle").then(() => page.waitForTimeout(1_500));
const take = (page) => page.evaluate(() => window.__shifts.splice(0));
const sum = (shifts) => Number(shifts.reduce((total, shift) => total + shift.value, 0).toFixed(4));
const scrolled = (page) =>
  page.evaluate(() => Math.max(0, ...[...document.querySelectorAll("*")].map((node) => node.scrollTop)));

const browser = await chromium.launch({ args: ["--mute-audio"] });
const results = [];
const restored = [];
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: "dark" });
    await context.addInitScript(observe);
    for (const route of routes) {
      const page = await context.newPage();
      await page.goto(url + route);
      await settle(page);
      const cold = await take(page);
      if (shots) await page.screenshot({ path: resolve(shots, `${width}-${route.replace(/\W+/g, "_")}.png`) });
      // Navigate from a scrolled landing page, the way a visitor follows a link deep in the story.
      await page.evaluate((from) => (location.hash = from), route === "#/" ? "#/features" : "#/");
      await settle(page);
      await page.mouse.move(width / 2, 450);
      await page.mouse.wheel(0, 3_000);
      await page.waitForTimeout(600);
      await take(page);
      await page.evaluate((next) => (location.hash = next), route);
      await settle(page);
      const nav = await take(page);
      const scrollAfter = await scrolled(page);
      results.push({ width, route, cold: sum(cold), nav: sum(nav), scrollAfter, sources: [...cold, ...nav] });
      await page.close();
    }
    // Back returns to the offset the visitor left.
    const page = await context.newPage();
    await page.goto(url + "#/");
    await settle(page);
    await page.mouse.move(width / 2, 450);
    await page.mouse.wheel(0, 3_000);
    await page.waitForTimeout(600);
    const left = await scrolled(page);
    await page.evaluate(() => (location.hash = "#/download"));
    await settle(page);
    await page.goBack();
    await settle(page);
    restored.push({ width, left, back: await scrolled(page) });
    await page.close();
    await context.close();
  }
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
}
for (const { width, route, cold, nav, scrollAfter, sources } of results) {
  console.log(`${width}px ${route.padEnd(32)} cold ${cold}  nav ${nav}  scrollTop after nav ${scrollAfter}`);
  for (const shift of sources.filter((item) => item.value >= 0.005))
    console.log(`    ${shift.value.toFixed(4)} ${shift.nodes.join(" | ")}`);
}
// Entering the workspace swaps the whole shell (site bar overlay to in-flow Engine bar) behind a fade, so its nav score is logged only.
const worst = Math.max(...results.flatMap((item) => [item.cold, item.route === "#/demo" ? 0 : item.nav]));
console.log(`Worst website CLS ${worst}`);
for (const { width, left, back } of restored) console.log(`${width}px back to #/ left at ${left}, restored to ${back}`);
assert.ok(worst < 0.1, `Layout shift ${worst} is above 0.1`);
const kept = results.filter((item) => !item.route.startsWith("#/docs") && item.scrollAfter > 0);
assert.deepEqual(kept, [], "A new page kept the scroll offset of the previous page");
for (const item of restored)
  assert.ok(item.left > 0 && item.back === item.left, "Back did not restore the scroll offset");
