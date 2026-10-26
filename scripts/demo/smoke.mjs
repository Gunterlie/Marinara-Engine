import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";
import { prepareDemoDoc, searchDemoDocs } from "../../packages/client/src/demo/docs.ts";

const searchFixture = [
  ["a/one.md", "Lorebooks", "# Lorebooks\n\n## Keys\nA key wakes the entry."],
  ["a/two.md", "Other", "# Other\nNothing here about lorebooks keys."],
  ["a/three.md", "None", "Unrelated"],
].map(([path, title, content]) => ({ path, title, content, dir: "a", language: "en", updatedAt: "" }));
const hits = searchDemoDocs(searchFixture, "Lorebooks KEY");
assert.deepEqual(
  hits.map((hit) => hit.path),
  ["a/one.md", "a/two.md"],
  "Docs search must require every term and rank title hits first",
);
assert.equal(hits[0].section, "keys", "Docs search should deep link the matching section");
assert.equal(hits[0].snippet, "A key wakes the entry.");

assert.equal(
  prepareDemoDoc("[Next](../characters/overview.md#details)", "home/welcome.md"),
  "[Next](#/docs/characters/overview.md?section=details)",
);
assert.equal(prepareDemoDoc("[Here](#details)", "home/welcome.md"), "[Here](#/docs/home/welcome.md?section=details)");
assert.match(
  prepareDemoDoc("[Source](../../packages/client/package.json)", "development/guide.md"),
  /https:\/\/github.com\/Gunterlie\/Marinara-Engine\/blob\/feat\/static-demo-tutorial\/packages\/client\/package.json/,
);
const example = "```md\n[x](guide.md)\n```\n`[x](guide.md)`";
assert.equal(prepareDemoDoc(example, "home/welcome.md"), example, "Documentation examples were rewritten");

const root = fileURLToPath(new URL("../../", import.meta.url));
const dist = resolve(root, "packages/client/dist-demo");
const metadata = JSON.parse(await readFile(resolve(dist, "demo-build.json"), "utf8"));
const guides = JSON.parse(await readFile(resolve(dist, "demo-docs/guides.json"), "utf8"));
assert.ok(
  guides.length && guides.every((doc) => !/^(development|contrib|evidence)\//.test(doc.path)),
  "Internal docs were published",
);
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".gif": "image/gif",
};
const requests = [];
const server = createServer(async (req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  requests.push(path);
  try {
    assert.ok(path.startsWith(metadata.base), `Request outside demo base: ${path}`);
    const suffix = decodeURIComponent(path.slice(metadata.base.length));
    const target = resolve(dist, suffix || "index.html");
    assert.ok(target.startsWith(dist + sep));
    const data = await readFile(target);
    res.writeHead(200, { "Content-Type": types[extname(target)] ?? "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;
const url = origin + metadata.base;
const evidence = resolve(root, "pr-evidence/static-demo");
await mkdir(evidence, { recursive: true });
async function openDemoMenu(page) {
  const trigger = page.getByTestId("demo-tutorial");
  if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click();
}
async function closeSidebar(page) {
  const toggle = page.locator('[data-tour="sidebar-toggle"]');
  if ((await toggle.getAttribute("aria-pressed")) === "true") {
    const close = page.getByRole("button", { name: "Close chats", exact: true });
    if (await close.isVisible()) await close.click();
    else await toggle.click();
  }
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator('[data-component="ChatSidebar"]')).not.toBeInViewport();
}
async function openSeedChat(page) {
  // The website and the demo share one TopBar; its Engine controls show once the demo workspace opens.
  const tryDemo = page.getByTestId("demo-site-try");
  if (await tryDemo.isVisible()) await tryDemo.click();
  // Until a lesson ends, the workspace opens with Mari's welcome lesson; Skip closes it.
  const card = page.locator('[data-component="OnboardingTutorial.Card"]');
  const welcomed = await card.waitFor({ timeout: 5_000 }).then(
    () => true,
    () => false,
  );
  if (welcomed) {
    await card.getByRole("button", { name: "Skip Tutorial", exact: true }).click();
    await expect(card).toBeHidden();
  }
  const toggle = page.locator('[data-tour="sidebar-toggle"]');
  await toggle.waitFor();
  if ((await toggle.getAttribute("aria-pressed")) !== "true") await toggle.click();
  const sidebar = page.locator('[data-component="ChatSidebar"]');
  const panel = sidebar.locator("..");
  if (await panel.evaluate((element) => getComputedStyle(element).position === "fixed")) {
    const panelBounds = await panel.boundingBox();
    const barBounds = await page.locator('[data-component="TopBar"]').boundingBox();
    assert.ok(
      panelBounds && barBounds && panelBounds.y >= barBounds.y + barBounds.height - 1,
      "Mobile drawer covers the top bar",
    );
  }
  await sidebar.locator('[data-chat-mode-tab="roleplay"]').click();
  await sidebar.getByText("Evening at the lighthouse", { exact: true }).click();
  await page.locator("textarea[data-chat-composer]").waitFor();
  return welcomed;
}
let browser;
let pages = [];
const diagnostics = [];
try {
  browser = await chromium.launch({ args: ["--mute-audio", "--disable-audio-output"] });
  const contexts = await Promise.all([
    browser.newContext({
      viewport: { width: 390, height: 900 },
      storageState: {
        cookies: [],
        origins: [{ origin, localStorage: [{ name: "unrelated-project-setting", value: "keep me" }] }],
      },
    }),
    browser.newContext(),
  ]);
  for (const context of contexts) context.setDefaultTimeout(15_000);
  // UI persistence flushes on beforeunload. Apply each requested appearance in the next document,
  // before the demo wraps storage and the real store hydrates, rather than racing that flush.
  await contexts[0].addInitScript(({ version, base }) => {
    const next = sessionStorage.getItem("demo-smoke-appearance");
    if (!next) return;
    const key = `marinara-demo:${version}:${base}:marinara-engine-ui`;
    const saved = JSON.parse(localStorage.getItem(key));
    if (!saved?.state) return;
    Object.assign(saved.state, JSON.parse(next), { sidebarOpen: true });
    localStorage.setItem(key, JSON.stringify(saved));
  }, metadata);
  await contexts[0].addInitScript(() => {
    new PerformanceObserver((list) => {
      window.__demoLcp = list.getEntries().at(-1)?.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
  });
  pages = await Promise.all(contexts.map((context) => context.newPage()));
  const errors = [];
  const failures = [];
  const externalRequests = [];
  const cspFailures = [];
  for (const page of pages) {
    page.on("console", (message) => {
      if (message.type() === "error" || message.text().includes("[demo]")) diagnostics.push(message.text());
      if (/content security policy|violates.*directive/i.test(message.text())) cspFailures.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
    });
    page.on("request", (request) => {
      if (new URL(request.url()).origin !== origin) externalRequests.push(request.url());
    });
  }
  await Promise.all(pages.map((page) => page.goto(url)));
  for (const page of pages) await page.getByTestId("demo-banner").waitFor({ timeout: 60_000 });
  // The public front door and guide links use only hash navigation, including direct refresh.
  await expect(pages[0].getByTestId("demo-product-home")).toBeVisible();
  assert.ok(!requests.some((path) => path.includes("demo-docs/")), "Home fetched documentation eagerly");
  await pages[0].waitForLoadState("networkidle");
  const firstLoad = await pages[0].evaluate(() => ({
    url: location.href,
    viewport: innerWidth,
    largestContentfulPaintMs: window.__demoLcp ?? null,
    requests: performance.getEntriesByType("resource").length,
    transferredBytes: performance.getEntriesByType("resource").reduce((sum, entry) => sum + entry.transferSize, 0),
    note: "Local static server, unthrottled; not a production performance benchmark",
  }));
  await writeFile(resolve(evidence, "home-first-load.json"), JSON.stringify(firstLoad, null, 2));
  for (const width of [1440, 390, 768]) {
    await pages[0].setViewportSize({ width, height: 1000 });
    await pages[0].screenshot({ path: resolve(evidence, `landing-${width}-dark.png`), fullPage: true });
    assert.ok(await pages[0].evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Landing overflows");
  }
  await pages[0].goto(url + "#/docs/installation/windows.md");
  const article = pages[0].getByTestId("demo-doc-article");
  await expect(article).toBeVisible();
  await expect(article.locator("h1")).toBeVisible();
  const toc = pages[0].getByTestId("demo-docs-toc");
  await toc.locator("summary").click();
  const sectionLink = toc.locator("a").nth(1);
  const sectionUrl = await sectionLink.getAttribute("href");
  await sectionLink.click();
  await pages[0].reload();
  await expect(article).toBeVisible();
  assert.ok(pages[0].url().includes("?section="), "Section deep link was lost");
  const sectionId = new URLSearchParams(sectionUrl.split("?")[1]).get("section");
  await expect(article.locator(`[id="${sectionId}"]`)).toBeFocused();
  await pages[0].screenshot({ path: resolve(evidence, "documentation-768-dark.png"), fullPage: true });
  await pages[0].goto(url + "#/docs");
  await expect(pages[0].getByRole("heading", { name: "Documentation", exact: true })).toBeVisible();
  assert.ok(
    !requests.some((path) => path.endsWith("demo-docs/guides.json")),
    "Reading guides fetched the full search corpus",
  );
  await pages[0].keyboard.press("Control+k");
  await pages[0].getByRole("combobox", { name: "Search documentation", exact: true }).fill("lorebook keys");
  await expect(pages[0].getByRole("option", { name: /Lorebook/i }).first()).toBeVisible();
  await expect(pages[0].locator(".demo-docs-palette mark").first()).toBeVisible();
  await pages[0].screenshot({ path: resolve(evidence, "documentation-search-768-dark.png") });
  await pages[0].keyboard.press("ArrowDown");
  await pages[0].keyboard.press("Enter");
  await expect(pages[0].locator(".demo-docs-palette")).toBeHidden();
  await expect(article).toBeVisible();
  assert.match(pages[0].url(), /#\/docs\/.+\.md/, "Search Enter did not open a guide");
  await pages[0].setViewportSize({ width: 390, height: 900 });
  await pages[0].getByRole("button", { name: "Open guides" }).click();
  await expect(pages[0].locator(".demo-docs-drawer [aria-current='page']")).toBeVisible();
  await pages[0].screenshot({ path: resolve(evidence, "documentation-nav-390-dark.png"), animations: "disabled" });
  await pages[0].keyboard.press("Escape");
  await pages[0].screenshot({ path: resolve(evidence, "documentation-390-dark.png"), fullPage: true });
  await pages[0].setViewportSize({ width: 1440, height: 900 });
  await pages[0].screenshot({ path: resolve(evidence, "documentation-1440-dark.png") });
  await pages[0].goto(url + "#/docs/missing-guide.md");
  await expect(pages[0].getByRole("heading", { name: "This guide could not be found" })).toBeVisible();

  // Features showcase: every area, a filter, and a checklist whose lines all open real guides.
  await pages[0].goto(url + "#/features");
  const features = pages[0].getByTestId("demo-features");
  await expect(features.getByRole("heading", { level: 1 })).toBeVisible();
  const guideLinks = await features
    .locator('a[href^="#/docs/"]')
    .evaluateAll((links) =>
      links.map((link) => decodeURIComponent(link.getAttribute("href").slice("#/docs/".length).split("?")[0])),
    );
  const missingGuides = guideLinks.filter((path) => !guides.some((doc) => doc.path === path));
  assert.deepEqual(missingGuides, [], "Feature links point at guides that do not exist");
  for (const width of [390, 768, 1440]) {
    await pages[0].setViewportSize({ width, height: 900 });
    assert.ok(
      await pages[0].evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `Features overflow at ${width}`,
    );
    await pages[0].screenshot({ path: resolve(evidence, `features-${width}-dark.png`), fullPage: true });
  }
  await features.getByRole("button", { name: "Game mode", exact: true }).click();
  await expect(features.locator("#features-game")).toBeVisible();
  await expect(features.locator("#features-modes")).toHaveCount(0);
  assert.ok(pages[0].url().endsWith("#/features?c=game"), "Feature filter is not in the address");
  await pages[0].setViewportSize({ width: 390, height: 900 });
  await pages[0].goto(url + "#/download");
  await expect(pages[0].getByText("docker compose up -d")).toBeVisible();
  await pages[0].screenshot({ path: resolve(evidence, "download-390-dark.png"), fullPage: true });
  await pages[0].setViewportSize({ width: 1440, height: 900 });
  await pages[0].goto(url + "#/");
  await pages[0].getByRole("link", { name: "Try the scripted chat", exact: true }).first().click();
  await expect(pages[0].locator("textarea[data-chat-composer]")).toBeVisible();
  await pages[0].goBack();
  await expect(pages[0].getByTestId("demo-product-home")).toBeVisible();
  await pages[0].setViewportSize({ width: 1440, height: 900 });
  const probe = async (page) =>
    page.evaluate(async () => {
      const chars = await (await fetch("/api/characters")).json();
      const chats = await (await fetch("/api/chats")).json();
      return { chars, chats };
    });
  // Website navigation opened a real chat, which legitimately stores per-tab layout metadata.
  // Reset that tab's in-memory seed before comparing independent fresh sessions.
  await pages[0].reload();
  await expect(pages[0].getByTestId("demo-product-home")).toBeVisible();
  // Scroll story: the step in the middle of the viewport picks the pinned screen.
  await pages[0].locator('[data-mode="conversation"]').evaluate((node) => node.scrollIntoView({ block: "center" }));
  await expect(pages[0].locator("[data-mode][data-active]")).toHaveAttribute("data-mode", "conversation");
  await expect(pages[0].locator(".demo-mode-shot[data-active]")).toHaveCount(1);
  const [first, second] = await Promise.all(pages.map(probe));
  assert.ok(Array.isArray(first.chars) && first.chars.length, "Example characters missing");
  assert.ok(Array.isArray(first.chats) && first.chats.length, "Example chat missing");
  assert.deepEqual(first.chars, second.chars);
  assert.deepEqual(first.chats, second.chats);
  for (const page of pages) {
    assert.ok(await openSeedChat(page), "Mari's welcome did not open on the first demo visit");
  }
  await expect(pages[0].getByTestId("demo-back-to-site")).toBeVisible();
  await Promise.all(
    pages.map(async (page, i) => {
      const composer = page.locator("textarea[data-chat-composer]");
      await composer.fill(i === 0 ? "Tell me about the lighthouse" : "Tell me about the fog");
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await expect(page.getByText(i === 0 ? /spiral stairs/ : /brass barometer/).first()).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.getByRole("button", { name: "Send", exact: true })).toBeVisible({ timeout: 30_000 });
    }),
  );
  const messages = await Promise.all(
    pages.map((page) => page.evaluate(async () => (await fetch("/api/chats/demo-chat-iris/messages")).json())),
  );
  assert.ok(messages[0].some((message) => message.content.includes("spiral stairs")));
  assert.ok(!messages[0].some((message) => message.content.includes("brass barometer")));
  assert.ok(messages[1].some((message) => message.content.includes("brass barometer")));
  assert.ok(!messages[1].some((message) => message.content.includes("spiral stairs")));
  const pagination = await pages[0].evaluate(async () => {
    const last = await (await fetch("/api/chats/demo-chat-iris/messages?limit=2")).json();
    const cursor = encodeURIComponent(`${last[0].createdAt}|${last[0].id}`);
    const older = await (await fetch(`/api/chats/demo-chat-iris/messages?limit=2&before=${cursor}`)).json();
    return { last, older };
  });
  assert.equal(pagination.last.length, 2);
  assert.equal(pagination.older.length, 1);
  assert.ok(
    !pagination.last.some((item) => item.id === pagination.older[0].id),
    "Message cursor repeated a loaded page",
  );
  const canceled = await pages[0].evaluate(async () => {
    const path = "/api/chats/demo-chat-iris/messages";
    const before = await (await fetch(path)).json();
    const controller = new AbortController();
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId: "demo-chat-iris", userMessage: "lighthouse" }),
      signal: controller.signal,
    });
    const reader = response.body.getReader();
    const first = new TextDecoder().decode((await reader.read()).value);
    controller.abort();
    await reader.cancel();
    await new Promise((done) => setTimeout(done, 500));
    const after = await (await fetch(path)).json();
    return {
      first,
      before: before.filter((item) => item.role === "assistant").length,
      after: after.filter((item) => item.role === "assistant").length,
    };
  });
  assert.ok(canceled.first.includes('"characters":["Iris"]'), "Typing event lost its character name");
  assert.equal(canceled.after, canceled.before, "Canceled generation saved a completed reply");
  const changed = await pages[0].evaluate(async () => {
    const response = await fetch("/api/characters/demo-character-iris", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: { name: "Visitor one's Iris" } }),
    });
    return response.json();
  });
  assert.equal(changed.name, "Visitor one's Iris");
  assert.equal((await probe(pages[1])).chars[0].name, "Iris");
  const otherTab = await contexts[0].newPage();
  await otherTab.goto(url);
  await otherTab.getByTestId("demo-banner").waitFor();
  assert.equal((await probe(otherTab)).chars[0].name, "Iris", "Chat data leaked into another tab");
  await otherTab.close();
  const unsupported = await pages[0].evaluate(
    async () => (await fetch("/api/demo-unsupported-operation", { method: "POST" })).status,
  );
  assert.equal(unsupported, 501);
  await pages[0].screenshot({ path: resolve(evidence, "demo-sidebar-open.png"), fullPage: true });
  for (const width of [390, 768, 1440]) {
    await pages[0].setViewportSize({ width, height: 900 });
    await closeSidebar(pages[0]);
    await pages[0].screenshot({ path: resolve(evidence, `demo-${width}.png`), fullPage: true });
    assert.ok(
      await pages[0].evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `Horizontal overflow at ${width}`,
    );
    const banner = await pages[0].getByTestId("demo-banner").boundingBox();
    const composer = await pages[0].locator("textarea[data-chat-composer]").boundingBox();
    assert.ok(
      banner &&
        composer &&
        (banner.y + banner.height <= composer.y ||
          banner.y >= composer.y + composer.height ||
          banner.x + banner.width <= composer.x ||
          banner.x >= composer.x + composer.width),
      `Demo banner covers the composer at ${width}`,
    );
  }
  await openDemoMenu(pages[0]);
  await pages[0].getByTestId("demo-reset").click();
  await Promise.all([
    pages[0].waitForEvent("load"),
    pages[0].getByRole("button", { name: "Reset demo", exact: true }).last().click(),
  ]);
  await pages[0].getByTestId("demo-banner").waitFor();
  assert.equal((await probe(pages[0])).chars[0].name, "Iris");
  const stored = await contexts[0].storageState();
  assert.ok(
    stored.origins.some((entry) =>
      entry.localStorage.some((item) => item.name === "unrelated-project-setting" && item.value === "keep me"),
    ),
    "Reset cleared unrelated project data",
  );
  const secondAfterReset = await pages[1].evaluate(async () =>
    (await fetch("/api/chats/demo-chat-iris/messages")).json(),
  );
  assert.deepEqual(secondAfterReset, messages[1], "Reset leaked to another visitor");
  // A suggested-message chip sends its text and gets its own scripted reply.
  await pages[1].getByTestId("demo-prompts").getByRole("button", { name: "What is the harbor like?" }).click();
  await expect(pages[1].getByText(/harbor never sleeps/).first()).toBeVisible({ timeout: 30_000 });
  for (const width of [390, 768, 1440]) {
    await pages[0].setViewportSize({ width, height: 900 });
    for (const visualTheme of ["default", "sillytavern"]) {
      for (const theme of ["dark", "light"]) {
        await pages[0].evaluate(
          (appearance) => sessionStorage.setItem("demo-smoke-appearance", JSON.stringify(appearance)),
          { theme, visualTheme },
        );
        await pages[0].reload();
        await pages[0].getByTestId("demo-banner").waitFor();
        await openSeedChat(pages[0]);
        await closeSidebar(pages[0]);
        await expect(pages[0].locator("textarea[data-chat-composer]")).toBeVisible();
        await expect(pages[0].locator("html")).toHaveAttribute("data-theme", theme);
        if (visualTheme !== "default")
          await expect(pages[0].locator("html")).toHaveAttribute("data-visual-theme", visualTheme);
        await pages[0].screenshot({
          path: resolve(evidence, `demo-${width}-${visualTheme}-${theme}.png`),
          fullPage: true,
        });
        await pages[0].getByRole("button", { name: "Home", exact: true }).click();
        await expect(pages[0].getByTestId("demo-product-home")).toBeVisible();
        await pages[0].screenshot({
          path: resolve(evidence, `landing-${width}-${visualTheme}-${theme}.png`),
          fullPage: true,
        });
        await pages[0].getByRole("link", { name: "Try the scripted chat", exact: true }).first().click();
      }
    }
  }
  await pages[0].getByTestId("demo-tutorial").click();
  await expect(pages[0].getByTestId("demo-lesson-chat")).toBeFocused();
  await pages[0].keyboard.press("Escape");
  await expect(pages[0].getByTestId("demo-tutorial")).toBeFocused();
  await pages[0].getByTestId("demo-tutorial").click();
  await pages[0].getByTestId("demo-lesson-chat").click();
  await expect(pages[0].locator('[data-component="OnboardingTutorial.Card"]')).toBeVisible();
  await pages[0].screenshot({ path: resolve(evidence, "lesson-chat.png"), fullPage: true });
  const card = pages[0].locator('[data-component="OnboardingTutorial.Card"]');
  for (let step = 1; step < 4; step++) await card.getByRole("button", { name: "Next", exact: true }).click();
  await card.getByRole("button", { name: "Get Started", exact: true }).click();
  assert.ok(
    await pages[0].evaluate(
      (version) => JSON.parse(localStorage.getItem(`marinara-demo:lessons-done:${version}`) ?? "[]").includes("chat"),
      metadata.version,
    ),
  );
  await pages[0].evaluate(() => sessionStorage.removeItem("demo-smoke-appearance"));
  await openDemoMenu(pages[0]);
  await pages[0].getByTestId("demo-reset").click();
  await Promise.all([
    pages[0].waitForEvent("load"),
    pages[0].getByRole("button", { name: "Reset demo", exact: true }).last().click(),
  ]);
  await pages[0].getByTestId("demo-banner").waitFor();
  await expect(pages[0].locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(pages[0].locator("html")).not.toHaveAttribute("data-visual-theme", "sillytavern");
  assert.equal(
    await pages[0].evaluate(
      (version) => localStorage.getItem(`marinara-demo:lessons-done:${version}`),
      metadata.version,
    ),
    null,
    "Reset kept lesson progress",
  );
  assert.ok(!pages[0].url().includes("marinara-demo-reset"), "Reset marker remained in the address");
  const privateContext = await browser.newContext();
  privateContext.setDefaultTimeout(15_000);
  await privateContext.addInitScript(() =>
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("Storage disabled", "SecurityError");
      },
    }),
  );
  const privatePage = await privateContext.newPage();
  await privatePage.goto(url);
  await privatePage.getByTestId("demo-banner").waitFor();
  assert.equal((await probe(privatePage)).chars[0].name, "Iris", "Storage denial broke the demo");
  await privateContext.close();
  assert.deepEqual(errors, [], "Browser errors");
  assert.deepEqual(failures, [], "Failed static requests");
  assert.deepEqual(externalRequests, [], "External network requests");
  assert.deepEqual(cspFailures, [], "Content Security Policy violations");
  assert.ok(!requests.some((path) => path.startsWith("/api/")), "API traffic escaped the browser adapter");
  console.log(
    `Static demo smoke passed: ${metadata.version}, ${metadata.base}, two browser contexts and three viewports.`,
  );
} catch (error) {
  for (const [i, page] of pages.entries()) {
    await page.screenshot({ path: resolve(evidence, `failure-${i}.png`), fullPage: true }).catch(() => {});
    await writeFile(
      resolve(evidence, `failure-${i}.txt`),
      await page
        .locator("body")
        .innerText()
        .catch(() => ""),
    );
  }
  await writeFile(
    resolve(evidence, "diagnostics.json"),
    JSON.stringify({ diagnostics: [...new Set(diagnostics)], requests }, null, 2),
  );
  console.error([...new Set(diagnostics)].join("\n"));
  throw error;
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
}
