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
