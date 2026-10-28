// One website page per agent in docs/agents/built-in-agents.md: every "### Name" under a "## Category".
// The slug is the heading's anchor in that guide, counted the same way as the docs reader and check-site.
import { headingSlug } from "../../packages/client/src/demo/docs.ts";

export const AGENTS_GUIDE = "agents/built-in-agents.md";
const SKIP = new Set(["How to read this reference", "Related guides"]);

const plain = (text) =>
  text
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]+/g, "")
    .trim();

export function agentPages(markdown) {
  const pages = [];
  const counts = new Map();
  let category = "";
  let page = null;
  let fence = false;
  for (const line of markdown.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    const heading = !fence && line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const title = heading[2];
      const base = headingSlug(title.replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/<[^>]+>/g, ""));
      const n = counts.get(base) ?? 0;
      counts.set(base, n + 1);
      if (heading[1] === "##") category = SKIP.has(title) ? "" : title;
      if (heading[1].length <= 3) page = null;
      if (heading[1] === "###" && category) {
        page = { slug: n ? `${base}-${n}` : base, name: title, category, summary: "", body: "" };
        pages.push(page);
        continue;
      }
    }
    if (page) page.body += `${line}\n`;
  }
  for (const item of pages) {
    item.body = item.body.trim();
    item.summary = plain(item.body.split(/\n\s*\n/).find((part) => !part.startsWith("-")) ?? "");
  }
  return pages;
}
