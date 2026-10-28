#!/usr/bin/env node
// Replays the committed website overlay onto the latest upstream main/staging in an isolated worktree.
//   node scripts/demo/refresh.mjs prepare --source main|staging|release [--tag vX.Y.Z] [--dir D] [--base SHA]
//   node scripts/demo/refresh.mjs finish [--dir D] [--meta F] [--out F] [--source current]
// See WEBSITE-REBUILD.md. No build is run here; no source branch, remote or upstream ref is changed.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const UPSTREAM_URL = "https://github.com/Pasta-Devs/Marinara-Engine.git";
const BRANCHES = ["main", "staging"];
// allowlist: nothing else ever reaches git. "release" is the newest vX.Y.Z tag upstream.
const SOURCES = [...BRANCHES, "release"];
const RELEASE_TAG = /^v\d+\.\d+\.\d+$/;
const MAX_OVERLAY_COMMITS = 200; // more than this means the base is wrong, not the overlay big
const WEBSITE_MARKERS = ["scripts/build-demo.mjs", "packages/client/src/demo/DemoHome.tsx"]; // upstream already ships the site
// Paths this fork deleted on purpose (WEBSITE-REBUILD.md). Keep in sync with AGENTS.md.
const DELETED_PATHS = [
  "android/", "win/", "Dockerfile", "docker-compose", ".dockerignore", "start", "MarinaraLauncher.exe", "hacs.json",
  "custom_components/", ".github/workflows/", "e2e/", "playwright.", "scripts/regressions/", "scripts/art/", "tools/",
  ".cursor/", ".coderabbit.yaml", "docs/development/", "docs/contrib/", "docs/evidence/", "docs/pr-evidence/",
  "docs/examples/", "docs/screenshots/", "docs/REMOTE_ACCESS.md", "docs/configuration/", "CONTRIBUTING.md", "SECURITY.md",
  "CODE_OF_CONDUCT.md", "CHANGELOG.md", "PRODUCT.md", "DESIGN.", "skills-lock.json", "packages/server/tests/",
  "packages/server/data/",
];
const FORBIDDEN_DIRS = ["/tmp", "/dev/shm"]; // tmpfs counts against devbox RAM

function git(args, cwd, { allowFail = false } = {}) {
  const r = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  if (r.status !== 0 && !allowFail) {
    throw new Error(`git ${args.join(" ")} failed in ${cwd}:\n${r.stderr || r.stdout}`);
  }
  return { ok: r.status === 0, out: r.stdout.trim(), err: r.stderr.trim() };
}
const gitOut = (args, cwd) => git(args, cwd).out;

function assertSafeDir(dir, mustBeEmpty = true) {
  for (const bad of FORBIDDEN_DIRS) {
    if (dir === bad || dir.startsWith(bad + sep))
      throw new Error(`${dir} is on tmpfs; use a directory under ~/scratch.`);
  }
  if (mustBeEmpty && existsSync(dir) && readdirSync(dir).length > 0) throw new Error(`${dir} exists and is not empty.`);
}

const isAncestor = (a, b, cwd) => git(["merge-base", "--is-ancestor", a, b], cwd, { allowFail: true }).ok;

// A main-only hotfix must not be replayed as overlay, so main's merge-base wins when it descends from staging's.
function defaultBase(root, ref) {
  const [m, s] = BRANCHES.map((n) => git(["merge-base", "HEAD", ref(n)], root, { allowFail: true }).out);
  if (m && s && isAncestor(s, m, root)) return m;
  if (m && s && isAncestor(m, s, root)) return s;
  throw new Error(
    `Cannot pick a base: merge-bases with main (${m}) and staging (${s}) are not comparable. Pass --base <sha>.`,
  );
}

// Newest vX.Y.Z tag upstream, compared by number (v1.10.0 is newer than v1.9.0). Other tag names are ignored.
function latestReleaseTag(upstreamUrl, root) {
  const tags = gitOut(["ls-remote", "--tags", "--refs", upstreamUrl, "v*"], root)
    .split("\n")
    .map((line) => line.split("refs/tags/")[1] ?? "")
    .filter((name) => RELEASE_TAG.test(name));
  if (!tags.length) throw new Error(`No vX.Y.Z release tag at ${upstreamUrl}.`);
  return tags.sort((a, b) => a.localeCompare(b, "en", { numeric: true })).at(-1);
}

export function prepare({
  root,
  source,
  dir,
  base,
  tag,
  upstreamUrl = UPSTREAM_URL,
  scratch = `${homedir()}/scratch/website-refresh`,
}) {
  if (!SOURCES.includes(source)) throw new Error(`source must be one of: ${SOURCES.join(", ")}`);
  if (git(["status", "--porcelain"], root).out) {
    throw new Error("Working tree is not clean. Commit the website overlay first (git status).");
  }

  // Fixed URL, fixed refspec: the repo and ref can never come from user input.
  if (tag !== undefined && source !== "release") throw new Error("--tag works only with --source release.");
  const ref = (name) => `refs/website/upstream/${name}`;
  const releaseTag = source === "release" ? (tag ?? latestReleaseTag(upstreamUrl, root)) : undefined;
  // Validate before git sees it: the tag name ends up in a refspec.
  if (releaseTag !== undefined && !RELEASE_TAG.test(releaseTag)) {
    throw new Error(`Release tag must look like v1.2.3, got "${releaseTag}".`);
  }
  const refspecs = BRANCHES.map((s) => `+refs/heads/${s}:${ref(s)}`);
  if (releaseTag) refspecs.push(`+refs/tags/${releaseTag}:${ref("release")}`);
  git(["fetch", "--no-tags", upstreamUrl, ...refspecs], root);
  const sourceSha = gitOut(["rev-parse", "--verify", `${ref(source)}^{commit}`], root);

  // Overlay = commits after the base. Default base: where this branch left upstream, taking the later of main/staging.
  if (base?.startsWith("-")) throw new Error("--base must be a commit, not an option.");
  const overlayBase = base ? gitOut(["rev-parse", "--verify", `${base}^{commit}`], root) : defaultBase(root, ref);
  if (!git(["merge-base", "--is-ancestor", overlayBase, "HEAD"], root, { allowFail: true }).ok) {
    throw new Error(`Base ${overlayBase} is not an ancestor of HEAD. Pass --base <sha>.`);
  }
  if (gitOut(["rev-list", "--merges", `${overlayBase}..HEAD`], root)) {
    throw new Error("The overlay contains merge commits. Rebase it to a linear history, or pass a later --base.");
  }
  const overlayCommits = gitOut(["rev-list", "--reverse", `${overlayBase}..HEAD`], root)
    .split("\n")
    .filter(Boolean);
  // Zero overlay is fine only when the source itself already contains the website: build it as is.
  const hasWebsite = WEBSITE_MARKERS.every(
    (f) => git(["cat-file", "-e", `${sourceSha}:${f}`], root, { allowFail: true }).ok,
  );
  if (overlayCommits.length === 0 && !hasWebsite)
    throw new Error(`No overlay commits after ${overlayBase}, and ${source} has no website.`);
  if (overlayCommits.length > MAX_OVERLAY_COMMITS) {
    throw new Error(`${overlayCommits.length} overlay commits after ${overlayBase}: wrong base? Pass --base <sha>.`);
  }

  // Default dir is fresh per run, so the same command repeats; an explicit --dir keeps the non-empty refusal.
  if (dir) {
    dir = resolve(dir);
    assertSafeDir(dir);
  } else {
    assertSafeDir(resolve(scratch), false);
    mkdirSync(scratch, { recursive: true });
    dir = mkdtempSync(`${resolve(scratch)}/${source}-${sourceSha.slice(0, 9)}-`);
  }
  mkdirSync(dirname(dir), { recursive: true });
  git(["worktree", "add", "--detach", dir, sourceSha], root);

  const meta = {
    source,
    sourceRef: ref(source),
    releaseTag,
    sourceSha,
    overlayBase,
    overlayCommits,
    overlayHead: gitOut(["rev-parse", "HEAD"], root),
  };
  writeFileSync(`${dir}.meta.json`, JSON.stringify(meta, null, 2) + "\n");

  const identity = git(["config", "user.email"], dir, { allowFail: true }).out
    ? []
    : ["-c", "user.name=website-refresh", "-c", "user.email=website-refresh@users.noreply.github.com"];
  // One sequencer run, so `git cherry-pick --continue` resumes the remaining commits after a repair.
  let pick = overlayCommits.length
    ? git([...identity, "cherry-pick", ...overlayCommits], dir, { allowFail: true })
    : { ok: true };
  // The overlay deletes this fork's stripped paths; upstream edits to them are modify/delete conflicts, so the deletion wins.
  while (!pick.ok) {
    const unmerged = git(["status", "--porcelain"], dir).out.split("\n").filter((l) => /^(UD|DU|UU|AA|AU|UA|DD) /.test(l));
    const files = unmerged.map((l) => l.slice(3));
    const stripped = (f) => DELETED_PATHS.some((p) => f === p || f.startsWith(p));
    if (!files.length || !unmerged.every((l) => l.startsWith("UD ") && stripped(l.slice(3)))) break;
    git(["rm", "-rq", "--", ...files], dir);
    pick = git([...identity, "-c", "core.editor=true", "cherry-pick", "--continue"], dir, { allowFail: true });
  }
  if (!pick.ok) return { conflict: true, dir, meta, report: repairPrompt(dir, meta, pick.err) };
  return { conflict: false, dir, meta: finish({ dir }) };
}

// Fail-closed gate: the prepared tree must be a clean linear replay on top of the source commit.
export function finish({ dir, metaPath = `${dir}.meta.json`, out, current = false }) {
  if (!current && !existsSync(metaPath))
    throw new Error(`No ${metaPath}: nothing was prepared here. Pass --source current to record this checkout as is.`);
  const meta = current ? { source: "current", overlayBase: null } : JSON.parse(readFileSync(metaPath, "utf8"));
  const head = gitOut(["rev-parse", "HEAD"], dir);
  if (git(["status", "--porcelain"], dir).out)
    throw new Error("Prepared tree is not clean. Finish the cherry-pick and commit.");
  if (existsSync(resolve(dir, gitOut(["rev-parse", "--git-path", "CHERRY_PICK_HEAD"], dir)))) {
    throw new Error("A cherry-pick is still in progress. Run git cherry-pick --continue.");
  }
  if (meta.sourceSha && !git(["merge-base", "--is-ancestor", meta.sourceSha, head], dir, { allowFail: true }).ok) {
    throw new Error("Prepared HEAD does not descend from the source commit.");
  }
  const result = { ...meta, preparedHead: head, builtAt: new Date().toISOString() };
  if (out) writeFileSync(out, JSON.stringify(result, null, 2) + "\n");
  return result;
}

function repairPrompt(dir, meta, err) {
  const files = gitOut(["diff", "--name-only", "--diff-filter=U"], dir).split("\n").filter(Boolean);
  return `Website refresh stopped: overlay does not apply cleanly to ${meta.source} @ ${meta.sourceSha}.

Worktree: ${dir}
Conflicted files:
${files.map((f) => `  - ${f}`).join("\n") || "  (none listed; see git output)"}

Git said:
${err}

Prompt for your AI helper:
  Read WEBSITE-REBUILD.md. In ${dir}, resolve the cherry-pick conflicts. Upstream changed
  the API, selectors or paths the demo overlay depends on. Keep upstream's new code and adapt the
  overlay to it; do not revert upstream. Then run: git add <files> && git cherry-pick --continue
  (repeat until done), then: node scripts/demo/refresh.mjs finish --dir ${dir}
  Then run heavy pnpm install --frozen-lockfile, heavy pnpm build:demo, heavy pnpm smoke:demo
  and node scripts/demo/check-site.mjs in ${dir}, and review the diff before you publish.

To discard: git worktree remove --force ${dir}`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2);
  const { values } = parseArgs({
    args: rest,
    options: {
      source: { type: "string" },
      dir: { type: "string" },
      base: { type: "string" },
      tag: { type: "string" },
      meta: { type: "string" },
      out: { type: "string" },
    },
  });
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  try {
    if (cmd === "prepare") {
      const r = prepare({ root, ...values });
      if (r.conflict) {
        console.error(r.report);
        process.exit(2);
      }
      console.log(
        `Prepared ${r.dir}\n  source ${r.meta.source}${r.meta.releaseTag ? ` ${r.meta.releaseTag}` : ""} @ ${r.meta.sourceSha}\n  overlay ${r.meta.overlayCommits.length} commit(s) from ${r.meta.overlayBase}`,
      );
      console.log(
        `Next, in ${r.dir}: heavy pnpm install --frozen-lockfile && heavy pnpm build:demo && heavy pnpm smoke:demo && node scripts/demo/check-site.mjs`,
      );
    } else if (cmd === "finish") {
      console.log(
        JSON.stringify(
          finish({
            dir: resolve(values.dir ?? "."),
            metaPath: values.meta ? resolve(values.meta) : undefined,
            out: values.out,
            current: values.source === "current",
          }),
          null,
          2,
        ),
      );
    } else {
      throw new Error(
        "usage: refresh.mjs prepare --source main|staging|release [--tag vX.Y.Z] [--dir D] [--base SHA] | finish [--dir D] [--meta F] [--out F]",
      );
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
