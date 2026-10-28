#!/usr/bin/env node
// Fails when the built demo website drifts from docs, assets, locale keys or versions.
//   node scripts/demo/check-site.mjs [--tag vX.Y.Z]     (after pnpm build:demo; --tag when the source is a release)
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { DOC_CATEGORIES, headingSlug, prepareDemoDoc } from "../../packages/client/src/demo/docs.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const { values } = parseArgs({ options: { tag: { type: "string" } } });
const client = join(root, "packages/client");
const dist = join(client, "dist-demo");
const guidesDir = join(dist, "demo-docs/guides");
const docsDir = join(root, "docs");
const errors = [];
const warnings = [];
const read = (file) => readFileSync(file, "utf8");
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));

if (!existsSync(join(dist, "demo-docs/index.json"))) {
  console.error("check-site: no built site in packages/client/dist-demo. Run `pnpm build:demo` first.");
  process.exit(1);
}

// Docs categories: every docs/ folder is published or deliberately deleted.
const folders = readdirSync(docsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
const buildCategories = read(join(root, "scripts/build-demo.mjs")).match(/const categories = new Set\(\s*"([^"]+)"/)?.[1];
for (const folder of folders) {
  if (!DOC_CATEGORIES.includes(folder)) {
    errors.push(
      `docs/${folder}/ is new and not on the website. Add "${folder}" to DOC_CATEGORIES in packages/client/src/demo/docs.ts and to categories in scripts/build-demo.mjs, or add "docs/${folder}/" to DELETED_PATHS in scripts/demo/refresh.mjs and AGENTS.md if it is not a user guide.`,
    );
  }
}
for (const category of DOC_CATEGORIES) {
  if (!folders.includes(category)) errors.push(`DOC_CATEGORIES lists "${category}", but docs/${category}/ does not exist. Remove it from packages/client/src/demo/docs.ts and scripts/build-demo.mjs.`);
}
if (buildCategories !== DOC_CATEGORIES.join(" ")) {
  errors.push("categories in scripts/build-demo.mjs differ from DOC_CATEGORIES in packages/client/src/demo/docs.ts. Make the two lists the same.");
}

// Docs index against the built guide files and the source docs.
const index = JSON.parse(read(join(dist, "demo-docs/index.json"))).map((doc) => doc.path);
const built = walk(guidesDir).map((file) => relative(guidesDir, file));
const source = walk(docsDir)
  .map((file) => relative(docsDir, file))
  .filter((path) => path.endsWith(".md") && (!path.includes("/") || DOC_CATEGORIES.includes(path.split("/")[0])));
for (const path of index) {
  if (!built.includes(path)) errors.push(`The docs index lists ${path}, but dist-demo/demo-docs/guides/${path} is missing. Rebuild with pnpm build:demo.`);
}
for (const path of built) {
  if (!index.includes(path)) errors.push(`dist-demo/demo-docs/guides/${path} is not in the docs index. Rebuild with pnpm build:demo.`);
}
for (const path of source) {
  if (!index.includes(path)) errors.push(`docs/${path} is not on the website. Add it to rootGuides in scripts/build-demo.mjs and packages/client/src/demo/docs.ts, or delete it in this fork.`);
}

// Doc deep links in the site code: features.ts, landing, FAQ, docs aliases, tours, Prof. Mari replies.
const demoSrc = walk(join(client, "src/demo")).filter((file) => /\.tsx?$/.test(file));
const links = new Map();
const addLink = (path, section, file) => links.set(`${decodeURIComponent(path)}#${decodeURIComponent(section ?? "")}`, relative(root, file));
for (const file of demoSrc) {
  const text = read(file);
  for (const m of text.matchAll(/["'`(]((?:[\w-]+\/)*[\w-]+\.md)["'`)]/g)) addLink(m[1], "", file);
  for (const m of text.matchAll(/#\/docs\/([^\s"'`)?#]+\.md)(?:\?section=([^\s"'`)&]+))?/g)) addLink(m[1], m[2], file);
  for (const m of text.matchAll(/(?:docHref\(|doc:)\s*"([^"]+)"\s*,\s*(?:section:\s*)?"([^"]+)"/g)) addLink(m[1], m[2], file);
}
const anchorCache = new Map();
// Same ids as DemoDocs: headingSlug of the rendered heading text, "-1", "-2" for repeats.
const anchorsOf = (path) => {
  if (anchorCache.has(path)) return anchorCache.get(path);
  const ids = new Set();
  const counts = new Map();
  let fenced = false;
  for (const line of prepareDemoDoc(read(join(guidesDir, path)), path).split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    const heading = !fenced && line.match(/^#{1,6}\s+(.+?)\s*#*$/)?.[1];
    if (!heading) continue;
    const slug = headingSlug(heading.replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/<[^>]+>/g, ""));
    const n = counts.get(slug) ?? 0;
    counts.set(slug, n + 1);
    ids.add(n ? `${slug}-${n}` : slug);
  }
  anchorCache.set(path, ids);
  return ids;
};
for (const [key, file] of links) {
  const [path, section] = key.split("#");
  if (!index.includes(path)) errors.push(`${file} links the guide ${path}, which the website does not have. Fix the link, or find where upstream moved the guide (git log --stat -- docs/).`);
  else if (section && !anchorsOf(path).has(section)) errors.push(`${file} links ${path}#${section}, but that guide has no such heading. Use the slug of an existing heading.`);
}

// Screenshots and images named in the site code.
for (const file of demoSrc) {
  const text = read(file);
  const where = relative(root, file);
  for (const m of text.matchAll(/["'`](website\/[\w.-]+\.webp)["'`]/g)) {
    if (!existsSync(join(dist, m[1]))) errors.push(`${where} shows ${m[1]}, but the build did not make it. Add packages/client/public/website-src/${m[1].slice(8, -5)}.png and list it in scripts/build-demo.mjs.`);
  }
  for (const m of text.matchAll(/asset\(\s*["'`]([^"'`$]+)["'`]\s*\)/g)) {
    if (!existsSync(join(dist, m[1]))) errors.push(`${where} shows ${m[1]}, but the built site has no such file. Add it under packages/client/public/.`);
  }
  for (const m of text.matchAll(/demo-assets\/([^"'`$\s)]+\.\w+)["'`]/g)) {
    if (!existsSync(join(dist, "demo-assets", m[1]))) errors.push(`${where} shows demo-assets/${m[1]}, but packages/client/public/demo-assets/${m[1]} is missing.`);
  }
}

// demo.* locale keys: used keys must exist in English, unused keys are only reported.
const en = JSON.parse(read(join(client, "src/localization/locales/en.json")));
const demoKeys = Object.keys(en).filter((key) => key.startsWith("demo."));
const code = walk(join(client, "src"))
  .filter((file) => /\.tsx?$/.test(file))
  .map(read)
  .join("\n");
const used = new Set();
const prefixes = [];
for (const m of code.matchAll(/["'`](demo\.[\w.]*)(["'`]|\$\{)/g)) {
  if (m[2] === "${" || m[1].endsWith(".")) prefixes.push(m[1]);
  else used.add(m[1]);
}
for (const key of used) {
  if (!(key in en) && !(`${key}_one` in en)) errors.push(`${key} is used in code but missing in packages/client/src/localization/locales/en.json.`);
}
const unused = demoKeys.filter((key) => {
  const base = key.replace(/_(zero|one|two|few|many|other)$/, "");
  return !used.has(base) && !prefixes.some((prefix) => base.startsWith(prefix));
});
if (unused.length) warnings.push(`${unused.length} demo.* keys in en.json are not used in code: ${unused.join(", ")}.`);

// Agent pages generated from docs.
const checkAgents = join(root, "scripts/demo/check-agents.mjs");
if (existsSync(checkAgents)) {
  const result = spawnSync(process.execPath, [checkAgents], { cwd: root, encoding: "utf8" });
  if (result.status !== 0) errors.push(`Agent pages drift (scripts/demo/check-agents.mjs):\n   ${(result.stderr || result.stdout).trim().replaceAll("\n", "\n   ")}`);
} else {
  warnings.push("scripts/demo/check-agents.mjs is not here, so the agent pages were not checked.");
}

// Versions: the badge shows APP_VERSION, so it must match the tree and the release.
const version = JSON.parse(read(join(root, "package.json"))).version;
const appVersion = read(join(root, "packages/shared/src/constants/defaults.ts")).match(/APP_VERSION = "([^"]+)"/)?.[1];
const builtVersion = JSON.parse(read(join(dist, "demo-build.json"))).version;
if (appVersion !== version) errors.push(`APP_VERSION is ${appVersion} in packages/shared/src/constants/defaults.ts, but package.json says ${version}. Make them the same.`);
if (builtVersion !== version) errors.push(`dist-demo/demo-build.json says ${builtVersion}, but package.json says ${version}. Rebuild with pnpm build:demo.`);
if (values.tag && values.tag !== `v${version}`) errors.push(`The release is ${values.tag}, but package.json says ${version}. Check that the overlay does not change the version.`);

const report = [...errors, ...warnings.map((warning) => `warning: ${warning}`)];
report.forEach((line, i) => console.log(`${i + 1}. ${line}`));
console.log(
  errors.length
    ? `check-site: ${errors.length} problem(s). Fix them, rebuild with pnpm build:demo, run this again.`
    : `check-site: ok (${links.size} doc links, ${index.length} guides, ${demoKeys.length} demo keys, version ${version})`,
);
process.exit(errors.length ? 1 : 0);
