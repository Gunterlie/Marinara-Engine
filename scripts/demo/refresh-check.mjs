#!/usr/bin/env node
// Git-only regression proof for refresh.mjs. Builds a fixture repo under ~/scratch, then deletes it.
//   node scripts/demo/refresh-check.mjs
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { finish, prepare } from "./refresh.mjs";

const base = resolve(homedir(), "scratch", `refresh-check-${process.pid}`);
const up = resolve(base, "upstream");
const fork = resolve(base, "fork");
const sh = (cwd, ...args) => {
  const r = spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
};
const commit = (cwd, file, text, msg) => {
  writeFileSync(resolve(cwd, file), text);
  sh(cwd, "add", file);
  sh(cwd, "commit", "-m", msg);
};

try {
  mkdirSync(up, { recursive: true });
  sh(up, "init", "-b", "staging");
  commit(up, "shared.txt", "one\n", "init");
  sh(up, "branch", "main");
  sh(base, "clone", up, "fork");
  commit(fork, "demo.txt", "overlay\n", "overlay");

  // 1. Clean replay onto an advanced upstream main, which staging does not have (a main-only hotfix).
  sh(up, "checkout", "main");
  commit(up, "hotfix.txt", "hotfix\n", "main hotfix");
  sh(up, "checkout", "staging");
  const initSha = sh(fork, "rev-parse", "HEAD~1");
  const ok = prepare({ root: fork, source: "main", dir: resolve(base, "out-main"), upstreamUrl: up });
  assert.equal(ok.conflict, false);
  assert.equal(ok.meta.overlayCommits.length, 1);
  assert.equal(readFileSync(resolve(ok.dir, "hotfix.txt"), "utf8"), "hotfix\n");
  assert.equal(readFileSync(resolve(ok.dir, "demo.txt"), "utf8"), "overlay\n");
  assert.equal(ok.meta.preparedHead, sh(ok.dir, "rev-parse", "HEAD"));

  // 2. Repeat refresh from the prepared tree: the main hotfix must not become overlay when switching to staging.
  const again = prepare({ root: ok.dir, source: "staging", dir: resolve(base, "out-again"), upstreamUrl: up });
  assert.equal(again.meta.overlayCommits.length, 1);
  assert.equal(again.meta.overlayBase, ok.meta.sourceSha);

  // 2b. Same command twice without --dir gives two fresh worktrees; an explicit used --dir is refused.
  const scratch = resolve(base, "scratch");
  const [t1, t2] = [1, 2].map(() => prepare({ root: fork, source: "main", scratch, upstreamUrl: up }));
  assert.notEqual(t1.dir, t2.dir);
  assert.throws(() => prepare({ root: fork, source: "main", dir: t1.dir, upstreamUrl: up }), /not empty/);

  // 3. Bad source, tmpfs dir, option-like and non-ancestor bases fail closed.
  const bad = (opts, re) =>
    assert.throws(() => prepare({ root: fork, dir: resolve(base, "out-bad"), upstreamUrl: up, ...opts }), re);
  bad({ source: "../evil" }, /source must be/);
  bad({ source: "main", dir: "/tmp/website-refresh-x" }, /tmpfs/);
  bad({ source: "main", base: "--help" }, /not an option/);
  bad({ source: "main", base: ok.meta.sourceSha }, /not an ancestor/);
  const viaBase = prepare({
    root: fork,
    source: "main",
    base: initSha,
    dir: resolve(base, "out-base"),
    upstreamUrl: up,
  });
  assert.equal(viaBase.meta.overlayBase, initSha);

  // 4. Dirty tree is refused.
  writeFileSync(resolve(fork, "dirty.txt"), "x");
  bad({ source: "main" }, /not clean/);
  rmSync(resolve(fork, "dirty.txt"));

  // 5. Overlay with a merge commit is refused.
  const merged = resolve(base, "merged");
  sh(base, "clone", up, "merged");
  sh(merged, "checkout", "-b", "side");
  commit(merged, "side.txt", "s\n", "side");
  sh(merged, "checkout", "staging");
  commit(merged, "main-line.txt", "m\n", "line");
  sh(merged, "merge", "--no-ff", "-m", "merge", "side");
  assert.throws(
    () => prepare({ root: merged, source: "main", dir: resolve(base, "out-merge"), upstreamUrl: up }),
    /merge commits/,
  );

  // 6. finish: missing metadata, dirty tree and wrong ancestry fail; explicit current works.
  assert.throws(() => finish({ dir: fork }), /nothing was prepared/);
  assert.equal(finish({ dir: fork, current: true }).source, "current");
  writeFileSync(resolve(ok.dir, "junk.txt"), "x");
  assert.throws(() => finish({ dir: ok.dir }), /not clean/);
  rmSync(resolve(ok.dir, "junk.txt"));
  assert.throws(() => finish({ dir: fork, metaPath: `${ok.dir}.meta.json` }), /descend/);

  // 7. Conflict: finish refuses mid cherry-pick, then succeeds after the repair.
  commit(fork, "shared.txt", "overlay edit\n", "overlay edits shared");
  commit(up, "shared.txt", "upstream edit\n", "upstream edits shared");
  const conflict = prepare({ root: fork, source: "staging", dir: resolve(base, "out-conflict"), upstreamUrl: up });
  assert.equal(conflict.conflict, true);
  assert.match(conflict.report, /shared\.txt/);
  assert.throws(() => finish({ dir: conflict.dir }), /not clean|in progress/);
  writeFileSync(resolve(conflict.dir, "shared.txt"), "resolved\n");
  sh(conflict.dir, "add", "shared.txt");
  sh(conflict.dir, "-c", "core.editor=true", "cherry-pick", "--continue");
  const fixed = finish({ dir: conflict.dir });
  assert.equal(fixed.preparedHead, sh(conflict.dir, "rev-parse", "HEAD"));
  assert.equal(readFileSync(resolve(conflict.dir, "demo.txt"), "utf8"), "overlay\n");

  // 8. Upstream already contains the website: zero overlay builds the source as is; a plain source still fails.
  sh(up, "checkout", "main");
  mkdirSync(resolve(up, "scripts"), { recursive: true });
  mkdirSync(resolve(up, "packages/client/src/demo"), { recursive: true });
  commit(up, "scripts/build-demo.mjs", "x\n", "site build");
  commit(up, "packages/client/src/demo/DemoHome.tsx", "x\n", "site home");
  sh(up, "checkout", "staging");
  const integrated = resolve(base, "integrated");
  sh(base, "clone", up, "integrated");
  sh(integrated, "checkout", "-b", "feat", "origin/main");
  const zero = prepare({ root: integrated, source: "main", dir: resolve(base, "out-zero"), upstreamUrl: up });
  assert.equal(zero.conflict, false);
  assert.deepEqual(zero.meta.overlayCommits, []);
  assert.equal(zero.meta.preparedHead, zero.meta.sourceSha);
  assert.throws(
    () => prepare({ root: integrated, source: "staging", dir: resolve(base, "out-none"), upstreamUrl: up }),
    /has no website/,
  );
  // 9. Upstream edits a path this fork deleted: the deletion wins without a conflict.
  sh(up, "checkout", "main");
  mkdirSync(resolve(up, "docs/development"), { recursive: true });
  commit(up, "docs/development/x.md", "a\n", "add dev doc");
  const stripped = resolve(base, "stripped");
  sh(base, "clone", up, "stripped");
  sh(stripped, "checkout", "main");
  sh(stripped, "rm", "-q", "docs/development/x.md");
  sh(stripped, "commit", "-qm", "strip");
  commit(up, "docs/development/x.md", "b\n", "edit dev doc");
  const gone = prepare({ root: stripped, source: "main", dir: resolve(base, "out-stripped"), upstreamUrl: up });
  assert.equal(gone.conflict, false);
  assert.ok(!existsSync(resolve(gone.dir, "docs/development/x.md")));

  // 10. Release: the newest vX.Y.Z tag wins by number, other tag names are ignored, bad --tag values fail closed.
  commit(up, "release.txt", "r1\n", "release 1.9.0");
  sh(up, "tag", "v1.9.0");
  commit(up, "release.txt", "r2\n", "release 1.10.0");
  sh(up, "tag", "-a", "v1.10.0", "-m", "1.10.0");
  sh(up, "tag", "v9.9.9-rc1");
  sh(up, "tag", "latest");
  const release = prepare({ root: fork, source: "release", dir: resolve(base, "out-release"), upstreamUrl: up });
  assert.equal(release.conflict, false);
  assert.equal(release.meta.releaseTag, "v1.10.0");
  assert.equal(release.meta.sourceSha, sh(up, "rev-parse", "v1.10.0^{commit}"));
  assert.equal(readFileSync(resolve(release.dir, "release.txt"), "utf8"), "r2\n");
  assert.equal(readFileSync(resolve(release.dir, "demo.txt"), "utf8"), "overlay\n");
  const pinned = prepare({ root: fork, source: "release", tag: "v1.9.0", dir: resolve(base, "out-pinned"), upstreamUrl: up });
  assert.equal(pinned.meta.sourceSha, sh(up, "rev-parse", "v1.9.0"));
  bad({ source: "release", tag: "v9.9.9-rc1" }, /look like v1\.2\.3/);
  bad({ source: "release", tag: "--upload-pack=x" }, /look like v1\.2\.3/);
  bad({ source: "main", tag: "v1.9.0" }, /only with --source release/);

  console.log("refresh-check: ok");
} finally {
  rmSync(base, { recursive: true, force: true });
}
