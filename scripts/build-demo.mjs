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
docs.sort((a, b) => a.path.localeCompare(b.path));
mkdirSync(resolve(root, "packages/client/dist-demo/demo-docs"), { recursive: true });
// The full corpus is only fetched for search. Readers load the small index and one guide at a time.
writeFileSync(resolve(root, "packages/client/dist-demo/demo-docs/guides.json"), JSON.stringify(docs));
writeFileSync(
  resolve(root, "packages/client/dist-demo/demo-docs/index.json"),
  JSON.stringify(docs.map(({ content: _content, ...doc }) => doc)),
);
for (const doc of docs) {
  const file = resolve(root, "packages/client/dist-demo/demo-docs/guides", doc.path);
  mkdirSync(resolve(file, ".."), { recursive: true });
  writeFileSync(file, doc.content);
}

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
