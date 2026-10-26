import type { DocContent, DocSummary } from "../hooks/use-docs";

let pending: Promise<(DocContent & DocSummary)[]> | undefined;

export function loadDemoDocs() {
  return (pending ??= fetch(`${import.meta.env.BASE_URL}demo-docs/guides.json`)
    .then((response) => {
      if (!response.ok) throw new Error("Documentation unavailable");
      return response.json() as Promise<(DocContent & DocSummary)[]>;
    })
    .catch((error) => {
      pending = undefined;
      throw error;
    }));
}

export type DemoDocSummary = DocSummary & { minutes?: number };

async function fetchDemoDocsFile(file: string) {
  const response = await fetch(`${import.meta.env.BASE_URL}demo-docs/${file}`);
  if (!response.ok) throw new Error("Documentation unavailable");
  return response;
}

/** Titles and dates only. The reader fetches one guide at a time and the full corpus only for search. */
export const loadDemoIndex = () =>
  fetchDemoDocsFile("index.json").then((response) => response.json() as Promise<DemoDocSummary[]>);

export const loadDemoGuide = (path: string) =>
  fetchDemoDocsFile(`guides/${path.split("/").map(encodeURIComponent).join("/")}`).then((response) => response.text());

export interface DemoSearchHit {
  path: string;
  title: string;
  dir: string;
  section: string;
  snippet: string;
}

const plain = (line: string) =>
  line
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[`*_>#|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Every term must appear in the guide. Title hits rank first, then the number of matching lines. */
export function searchDemoDocs(docs: Array<DocSummary & { content: string }>, query: string): DemoSearchHit[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const hits: Array<DemoSearchHit & { score: number }> = [];
  for (const doc of docs) {
    const title = doc.title.toLowerCase();
    const body = doc.content.toLowerCase();
    if (!terms.every((term) => title.includes(term) || body.includes(term))) continue;
    const lines = doc.content.split("\n");
    let heading = "";
    let section = "";
    let snippet = "";
    let lineHits = 0;
    for (const line of lines) {
      const headingMatch = line.match(/^#{2,4}\s+(.+)$/);
      if (headingMatch) heading = plain(headingMatch[1]!);
      const lower = line.toLowerCase();
      if (!terms.some((term) => lower.includes(term))) continue;
      lineHits++;
      if (snippet || line.startsWith("#") || !plain(line)) continue;
      const text = plain(line);
      const found = terms.map((term) => text.toLowerCase().indexOf(term)).filter((i) => i >= 0);
      const at = Math.max(0, (found.length ? Math.min(...found) : 0) - 50);
      snippet = `${at ? "..." : ""}${text.slice(at, at + 160)}${text.length > at + 160 ? "..." : ""}`;
      section = heading ? headingSlug(heading) : "";
    }
    const titleScore = title.includes(query.trim().toLowerCase())
      ? 1000
      : terms.filter((term) => title.includes(term)).length * 200;
    hits.push({
      path: doc.path,
      title: doc.title,
      dir: doc.dir,
      section,
      snippet,
      score: titleScore + Math.min(lineHits, 50),
    });
  }
  return hits
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, 30)
    .map(({ score: _score, ...hit }) => hit);
}

export function docHref(path = "", section = "") {
  return `#/docs${path ? "/" + path.split("/").map(encodeURIComponent).join("/") : ""}${section ? "?section=" + encodeURIComponent(section) : ""}`;
}

export function headingSlug(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_\s-]/gu, "")
    .trim()
    .replace(/\s/g, "-");
}

// Keep these categories aligned with build-demo.mjs, which only publishes user guides.
export const DOC_CATEGORIES =
  "home installation connections conversation roleplay game characters chats lorebooks agents media prompts noodle appearance settings data extending integrations".split(
    " ",
  );
const categories = new Set(DOC_CATEGORIES);
const rootGuides = new Set(["FAQ.md", "INSTALLATION.md", "UPGRADING.md", "CONFIGURATION.md", "TROUBLESHOOTING.md"]);
function isUserGuide(path: string) {
  return path.includes("/") ? categories.has(path.split("/")[0]!) : rootGuides.has(path);
}

// ponytail: trial source branch; use the release commit when stable snapshots publish.
const SOURCE_ROOT = "https://github.com/Gunterlie/Marinara-Engine/blob/feat/static-demo-tutorial/";

export function prepareDemoDoc(raw: string, path: string) {
  // Keep examples literal: rewrite only prose outside fenced and inline code.
  return raw
    .split(/(`{3,}[^\n]*\n[\s\S]*?\n`{3,}|~{3,}[^\n]*\n[\s\S]*?\n~{3,}|`+[^`\n]*`+)/g)
    .map((part, i) => {
      if (i % 2) return part;
      return part
        .replace(/^<\/?(?:details|p)(?:\s[^>]*)?>\s*$/gim, "")
        .replace(/^<summary>(?:<strong>)?(.+?)(?:<\/strong>)?<\/summary>\s*$/gim, "## $1")
        .replace(/<a id="[^"]*"><\/a>/g, "")
        .replace(/(!?)\[([^\]]+)\]\(([^\s)]+)\)/g, (original, image: string, label: string, target: string) => {
          if (image || /^(?:[a-z]+:|\/)/i.test(target)) return original;
          const resolved = new URL(target, SOURCE_ROOT + "docs/" + path);
          const prefix = new URL(SOURCE_ROOT + "docs/").pathname;
          const section = decodeURIComponent(resolved.hash.slice(1));
          if (
            resolved.pathname.startsWith(prefix) &&
            resolved.pathname.endsWith(".md") &&
            isUserGuide(decodeURIComponent(resolved.pathname.slice(prefix.length)))
          ) {
            return `[${label}](${docHref(decodeURIComponent(resolved.pathname.slice(prefix.length)), section)})`;
          }
          return `[${label}](${resolved.href})`;
        });
    })
    .join("");
}
