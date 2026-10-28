import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { copyFileSync, readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolvePnpmRunner } from "./pnpm-runner.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const base = process.env.MARINARA_DEMO_BASE ?? "/Marinara-Engine/";
if (!/^\/(?:[A-Za-z0-9._-]+\/)*$/.test(base)) {
  throw new Error("MARINARA_DEMO_BASE must be an absolute directory path with a trailing slash.");
}

const env = { ...process.env, VITE_MARINARA_DEMO: "1", MARINARA_DEMO_BASE: base, SKIP_PWA: "1" };
const runner = resolvePnpmRunner();
for (const args of [["build:shared"], ["--filter", "@marinara-engine/client", "build"]]) {
  const result = spawnSync(runner.command, [...runner.args, ...args], { cwd: root, env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const version = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")).version;
writeFileSync(resolve(root, "packages/client/dist-demo/demo-build.json"), JSON.stringify({ version, base }, null, 2));
writeFileSync(resolve(root, "packages/client/dist-demo/.nojekyll"), "");
copyFileSync(resolve(root, "LICENSE"), resolve(root, "packages/client/dist-demo/LICENSE"));

// Ship the same English guides as the Engine, without needing the docs server or a remote fetch.
const docs = [];
// Public user guides only. Development plans and contribution audits stay on GitHub.
const categories = new Set(
  "home installation connections conversation roleplay game characters chats lorebooks agents media prompts noodle appearance settings data extending integrations".split(
    " ",
  ),
);
const rootGuides = new Set(["FAQ.md", "INSTALLATION.md", "UPGRADING.md", "CONFIGURATION.md", "TROUBLESHOOTING.md"]);
// Last commit date per guide. The Pages workflow checks out full history; mtime is the fallback.
const gitDates = new Map();
const gitLog = spawnSync("git", ["log", "--format=%x00%cI", "--name-only", "--", "docs"], {
  cwd: root,
  encoding: "utf8",
});
let commitDate = "";
for (const line of gitLog.status === 0 ? gitLog.stdout.split("\n") : []) {
  if (line.startsWith("\0")) commitDate = line.slice(1);
  else if (line && !gitDates.has(line)) gitDates.set(line, commitDate);
}
function collectDocs(dir, prefix = "") {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = prefix + entry.name;
    const file = resolve(dir, entry.name);
    if (entry.isDirectory() && (prefix !== "" || categories.has(entry.name))) collectDocs(file, path + "/");
    else if (entry.isFile() && entry.name.endsWith(".md") && (prefix !== "" || rootGuides.has(entry.name))) {
      const content = readFileSync(file, "utf8");
      docs.push({
        path,
        title: content.match(/^#\s+(.+)$/m)?.[1] ?? entry.name,
        dir: prefix.slice(0, -1),
        language: "en",
        updatedAt: gitDates.get(`docs/${path}`) ?? statSync(file).mtime.toISOString(),
        minutes: Math.max(1, Math.round(content.split(/\s+/).length / 220)),
        content,
      });
    }
  }
}
collectDocs(resolve(root, "docs"));
// Home opens with the welcome guide and ends with achievements; the rest stay alphabetical.
const sortKey = (path) => ({ "home/welcome.md": "home/0", "home/achievements.md": "home/zzz" })[path] ?? path;
docs.sort((a, b) => sortKey(a.path).localeCompare(sortKey(b.path)));
// The full corpus is only fetched for search. Readers load the small index and one guide at a time.
function writeDocs(dir, list) {
  const out = resolve(root, "packages/client/dist-demo/demo-docs", dir);
  mkdirSync(out, { recursive: true });
  writeFileSync(resolve(out, "guides.json"), JSON.stringify(list));
  writeFileSync(resolve(out, "index.json"), JSON.stringify(list.map(({ content: _content, ...doc }) => doc)));
  for (const doc of list) {
    const file = resolve(out, "guides", doc.path);
    mkdirSync(resolve(file, ".."), { recursive: true });
    writeFileSync(file, doc.content);
  }
}
writeDocs("", docs);

// Translated guides (docs-i18n) and release notes (main) come from the Engine repository.
// A failed fetch or a missing branch only drops that part; the English site still builds.
// No --depth: a shallow fetch would mark the whole local repository shallow.
const git = (...args) => spawnSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 1 << 26 });
const upstreamRemote = process.env.MARINARA_UPSTREAM_REMOTE ?? "https://github.com/Pasta-Devs/Marinara-Engine.git";
function fetchUpstream(branch) {
  const ref = `refs/website/upstream/${branch}`;
  const fetched = git("fetch", "--quiet", "--no-tags", upstreamRemote, `+refs/heads/${branch}:${ref}`);
  if (fetched.status !== 0) console.warn(`[build-demo] Could not fetch ${branch} from ${upstreamRemote}: ${fetched.stderr?.trim()}`);
  if (git("rev-parse", "--verify", "--quiet", `${ref}^{commit}`).status === 0) return ref;
  console.warn(`[build-demo] ${ref} is not available; skipping it.`);
  return null;
}
const I18N_REF = fetchUpstream("docs-i18n");
const languages = [];
if (I18N_REF) {
  const tree = new Set(git("ls-tree", "-r", "--name-only", I18N_REF).stdout.split("\n"));
  const updatedAt = git("log", "-1", "--format=%cI", I18N_REF).stdout.trim();
  const codes = [...tree].filter((file) => /^[a-z-]+\/manifest\.json$/.test(file)).map((file) => file.split("/")[0]);
  for (const code of codes.sort()) {
    const translated = docs
      .filter((doc) => tree.has(`${code}/${doc.path}`))
      .map((doc) => {
        const content = git("show", `${I18N_REF}:${code}/${doc.path}`).stdout;
        return { ...doc, title: content.match(/^#\s+(.+)$/m)?.[1] ?? doc.title, language: code, updatedAt, content };
      });
    if (!translated.length) continue;
    writeDocs(code, translated);
    languages.push(code);
  }
  console.log(`[build-demo] Translated docs: ${languages.join(", ") || "none"}`);
}
writeFileSync(resolve(root, "packages/client/dist-demo/demo-docs/languages.json"), JSON.stringify(languages));

// Release notes: one entry per "## [x.y.z] - date" heading of the released CHANGELOG.md. Without it the page links to GitHub.
const MAIN_REF = fetchUpstream("main");
const changelog = MAIN_REF ? git("show", `${MAIN_REF}:CHANGELOG.md`).stdout : "";
const releases = changelog
  .split(/^## /m)
  .slice(1)
  .map((part) => {
    const [, version, date = ""] = part.match(/^\[([^\]]+)\](?:[ \t]+-[ \t]+(\S+))?/) ?? [];
    return { version, date, body: part.slice(part.indexOf("\n") + 1).trim() };
  })
  .filter((release) => /^\d+\.\d+\.\d+/.test(release.version ?? "") && release.body);
writeFileSync(resolve(root, "packages/client/dist-demo/changelog.json"), JSON.stringify(releases));
console.log(`[build-demo] Changelog: ${releases.length} releases`);

mkdirSync(resolve(root, "packages/client/dist-demo/website"), { recursive: true });
const sharp = createRequire(resolve(root, "packages/server/package.json"))("sharp");
for (const image of [
  "Desktop_Roleplay_View.png",
  "Desktop_DM_Conversation.png",
  "Browser_Game_Screen.png",
  "Desktop_Tracker_Panel.png",
  "Mobile_Group_Conversation.png",
  "Desktop_Custom_Theme.png",
  "Browser_Game_Dialogue.png",
]) {
  await sharp(resolve(root, "packages/client/public/website-src", image))
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82, effort: 4 })
    .toFile(resolve(root, "packages/client/dist-demo/website", image.replace(/\.png$/, ".webp")));
}

// Pages serves HTML with max-age=600; ask browsers to revalidate so a redeploy never pairs old HTML with deleted chunks.
const indexHtml = resolve(root, "packages/client/dist-demo/index.html");
writeFileSync(
  indexHtml,
  readFileSync(indexHtml, "utf8").replace(
    "<head>",
    '<head>\n    <meta http-equiv="Cache-Control" content="no-cache" />',
  ),
);
