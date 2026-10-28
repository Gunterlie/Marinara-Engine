#!/usr/bin/env node
// Fails when the agent pages drift from docs/agents. check-site.mjs runs it after `pnpm build:demo`.
// Doc links, anchors and features.ts guide paths are checked by check-site.mjs itself.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AGENTS_GUIDE, agentPages } from "./agents-pages.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const dist = join(root, "packages/client/dist-demo");
const read = (file) => readFileSync(join(root, file), "utf8");
const errors = [];

if (!existsSync(join(dist, "agents.json"))) {
  console.error("check-agents: dist-demo/agents.json is missing. Run `pnpm build:demo` first.");
  process.exit(1);
}
const pages = agentPages(read(`docs/${AGENTS_GUIDE}`));
const built = new Set(JSON.parse(readFileSync(join(dist, "agents.json"), "utf8")).map((page) => page.slug));
const slugs = new Set(pages.map((page) => page.slug));

// Every agent in the reference guide has a page.
if (!pages.length)
  errors.push(`docs/${AGENTS_GUIDE} has no "### Agent" headings under a "## Category". Check its format.`);
for (const page of pages) {
  if (!built.has(page.slug))
    errors.push(`Agent "${page.name}" (${page.slug}) has no built page. Rebuild with pnpm build:demo.`);
}
for (const slug of built) {
  if (!slugs.has(slug))
    errors.push(`dist-demo/agents.json has "${slug}", which is gone from docs/${AGENTS_GUIDE}. Rebuild.`);
}

// Every agent guide is listed on the overview, which reads the built docs index.
const index = new Set(JSON.parse(readFileSync(join(dist, "demo-docs/index.json"), "utf8")).map((doc) => doc.path));
for (const file of readdirSync(join(root, "docs/agents")).filter((name) => name.endsWith(".md"))) {
  if (!index.has(`agents/${file}`)) errors.push(`docs/agents/${file} is not in the built docs index. Rebuild.`);
}

// Hand-written taglines point at agents that still exist and have English copy.
const taglines = [
  ...(read("packages/client/src/demo/features.ts").match(/AGENT_TAGLINES = \[([\s\S]*?)\]/)?.[1] ?? "").matchAll(
    /"([^"]+)"/g,
  ),
].map((match) => match[1]);
const en = JSON.parse(read("packages/client/src/localization/locales/en.json"));
for (const slug of taglines) {
  if (!slugs.has(slug))
    errors.push(`AGENT_TAGLINES in features.ts lists "${slug}", but no agent has that slug. Rename or remove it.`);
  if (!en[`demo.agents.tagline.${slug}`]) errors.push(`en.json has no "demo.agents.tagline.${slug}".`);
}

errors.forEach((error, i) => console.log(`${i + 1}. ${error}`));
console.log(
  errors.length ? `check-agents: ${errors.length} problem(s).` : `check-agents: ok (${pages.length} agent pages)`,
);
process.exit(errors.length ? 1 : 0);
