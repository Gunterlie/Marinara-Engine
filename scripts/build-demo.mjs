import { spawnSync } from "node:child_process";
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
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
