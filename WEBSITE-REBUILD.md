# Rebuilding the demo website on a new upstream release

## Home repo

The website lives in `Pasta-Devs/Marinara-Website`, default branch `main`, and GitHub Pages serves it at https://pasta-devs.github.io/Marinara-Website/. It moved there from the trial fork `Gunterlie/Marinara-Engine` (branch `feat/static-demo-tutorial`). The workflow and scripts read the repo name from the run, so both repos build and deploy under their own Pages URL.

Set up a new website repo once:

1. Push the website history to `main`.
2. In Settings -> Pages, set Source to "GitHub Actions".
3. Add `Pasta-Devs/Marinara-Website` (or the new repo) to the two repo lists in `.github/workflows/demo-pages.yml` if the name differs.

To rebuild by hand, members open the Actions tab, pick "Static demo Pages", click "Run workflow" on `main` and choose `source_ref`. `current` rebuilds `main` as it is, `main` or `staging` replays the overlay onto that upstream branch, and `release` replays it onto the newest upstream release. The daily release check runs by itself (see Release builds).

## Stripped fork

This fork is intentionally stripped to what the demo website needs. When you merge or cherry-pick newer upstream `staging` and a conflict touches a path deleted here, keep it deleted (`git rm`). Never restore server `src` installers, android, win, docker, other workflows, tests, dev docs, or any path in `DELETED_PATHS` in `scripts/demo/refresh.mjs`. Plain `git merge -X ours` is not needed: `refresh.mjs` resolves modify/delete conflicts for those paths on its own.

Deleted set: android/, win/, Dockerfile*, docker-compose*, .dockerignore, start*.sh/.bat, MarinaraLauncher.exe, hacs.json, custom_components/, all .github/workflows except demo-pages.yml, e2e/, playwright*.config.ts, scripts/ except build-demo, pnpm-runner, ensure-native-deps, clean-stale-client-artifacts and demo/, docs/development, docs/contrib, docs/evidence, docs/pr-evidence, docs/examples, docs/screenshots, docs/REMOTE_ACCESS.md, docs/configuration, tools/, .cursor/, .coderabbit.yaml, CONTRIBUTING/SECURITY/CODE_OF_CONDUCT/CHANGELOG/PRODUCT/DESIGN files, skills-lock.json, packages/server tests and data.


The website is an overlay: a few commits on top of upstream `staging`. A refresh replays those commits onto the
latest upstream release, `main` or `staging` in a separate worktree. Your branch, upstream and the website repo stay unchanged.

## Start here (human or AI)

1. Commit the overlay on `main` of the website repo. The tree must be clean.
2. Run `pnpm website:refresh --source staging` (or `main`).
   - It fetches `Pasta-Devs/Marinara-Engine` with a fixed URL. Only `main`, `staging` and `release` (the newest `vX.Y.Z` tag, see "Release builds") are accepted.
   - Overlay = commits in `<base>..HEAD`. Base defaults to the later of the merge-bases with upstream `main` and
     `staging`, so a repeat refresh keeps main-only hotfixes out of the overlay. If the two are not comparable,
     it stops: pass `--base <sha>`.
   - If upstream already contains the website (it has `scripts/build-demo.mjs` and `DemoHome.tsx`) and the overlay is
     empty, the source is built as is with `overlayCommits: []`. If the source has no website, an empty overlay fails.
   - Worktree default: a fresh `~/scratch/website-refresh/<source>-<sha>-<random>`, so you can repeat the command
     without cleanup. Remove old ones with `git worktree remove --force <dir>`. `--dir` overrides it and must be
     empty (protects repair work). `/tmp` is refused.
3. Exit 0: continue at step 5. Exit 2: the overlay conflicts with upstream. The output is a repair prompt.
4. Repair (give the AI helper the printed prompt):
   - Upstream changed an API, selector or path the demo depends on. A conflict-free replay is **not** guaranteed.
   - Adapt the overlay to the new upstream code. Do not revert upstream.
   - `git add <files> && git cherry-pick --continue`, repeat until done, then
     `node scripts/demo/refresh.mjs finish --dir <worktree>`.
   - To give up: `git worktree remove --force <worktree>`.
5. In the worktree run `heavy pnpm install --frozen-lockfile`, `heavy pnpm build:demo`, `pnpm check:site`, `heavy pnpm smoke:demo`.
6. Review `git diff <sourceSha>..HEAD` in the worktree before you publish.
7. Publish the reviewed worktree as a candidate branch on the website repo, with a normal push (no force):
   `git switch -c website-refresh/<name>` then `git push <website-remote> HEAD:refs/heads/website-refresh/<name>`.
   Deploy it from the trusted workflow on `main`:
   `gh workflow run demo-pages.yml --repo Pasta-Devs/Marinara-Website --ref main -f source_ref=current -f prepared_branch=website-refresh/<name>`
   The website needs no provider secret.

## CI

`Static demo Pages` has a manual input `source_ref`: `current` (default, same as a push), `release`, `main` or `staging`.
Optional `prepared_branch` (only `website-refresh/*`, needs `source_ref=current`) builds and deploys that exact reviewed candidate; its provenance records the built HEAD. The workflow itself must be dispatched from `main` (or `feat/static-demo-tutorial` on the old fork). It runs the same prepare, install, build, drift check and smoke steps. If any step fails, the `deploy` job does not run and the
old site stays. The build adds `website-source.json` next to `demo-build.json` with the source line, the exact
upstream commit, the overlay base and commits, and the prepared head.

## Check

`node scripts/demo/refresh-check.mjs` tests the helper against a throw-away git fixture under `~/scratch`, release tags included. It needs no network.

## Release builds

The production website follows the latest upstream release. The website repo cannot receive upstream release events, so the workflow checks every day at 05:23 UTC (`schedule`):

1. The `release` job asks the GitHub API for the latest release of `Pasta-Devs/Marinara-Engine` and accepts only a `vX.Y.Z` tag.
2. It reads `releaseTag` from the deployed `website-source.json` of the running repo's Pages site (`https://<owner>.github.io/<repo>/website-source.json`). A missing file or a site built from a branch counts as "no release".
3. If the tag is the deployed one, the run ends there, with no build and no deploy.
4. If the tag is newer, the build job runs `refresh.mjs prepare --source release --tag <tag>`. It fetches only that tag from the fixed upstream URL into `refs/website/upstream/release` and replays the overlay onto the tag commit, with the same `DELETED_PATHS` conflict handling as for `main` and `staging`.
5. `website-source.json` records the tag as `releaseTag`. The badge shows `APP_VERSION` from the tree, and the drift check makes sure that it equals the tag.

To force a release build, run the workflow by hand with `source_ref=release`:

```bash
gh workflow run demo-pages.yml --repo Pasta-Devs/Marinara-Website --ref main -f source_ref=release
```

Locally, `pnpm website:refresh --source release` takes the newest `vX.Y.Z` tag upstream. Add `--tag v2.5.1` to pin one.

GitHub runs schedules only from the default branch, and that branch must contain this workflow file. The website repo's default branch is `main`, which holds the workflow, so the daily check runs there and builds from `main`. On the old fork the default branch has no `demo-pages.yml`, so the fork has no daily check.

A push to `main` (or `feat/static-demo-tutorial` on the old fork) still deploys that branch as pushed (`source_ref=current`). Such a site has no `releaseTag`, so the next daily check puts the release back.

## Pull from GitHub

After every successful deploy, the `site-release` job also publishes the built site as a GitHub Release `site-<version>-<sha>` in the running repo. It holds `website-<version>-<sha>.tar.gz` (all of `dist-demo`), its `.sha256` file and `website-source.json`. Only the 5 newest `site-*` releases stay. If this job fails, the Pages deploy is not affected.

To serve the site from your own web server, run `scripts/demo/pull-site.sh <target>` there, for example from a timer every hour. It downloads the newest `site-*` release of `Pasta-Devs/Marinara-Website` (pass `owner/repo` as a second argument for another repo), checks the SHA-256, and unpacks it next to `<target>`. Then it swaps the `<target>` symlink in one rename, so visitors never see a half-written site. The previous release stays next to it. To roll back, run `ln -sfn <target>.<previous tag> <target>`. The script needs curl, jq, tar and sha256sum, and `<target>` must be a symlink or absent. The site is built for the base path `/Marinara-Website/`, so serve `<target>` under that path.

## Drift checks

`pnpm check:site` (`node scripts/demo/check-site.mjs`) runs after `pnpm build:demo` and before the smoke test, in CI and in step 5 above. It reads the built site in `packages/client/dist-demo` and fails with a numbered list of problems and their fixes:

- Doc links in `packages/client/src/demo` (features, landing page, FAQ, docs aliases, tours, Professor Mari replies) point to a guide that the site serves. Links with a section point to a heading that exists in the built guide.
- The docs index and the built guide files match. Every source guide in a website category is in the index.
- Every `docs/` folder is in `DOC_CATEGORIES` (`packages/client/src/demo/docs.ts`) and in `categories` (`scripts/build-demo.mjs`), and the two lists are the same. A new upstream folder fails with the lines to add, or with a hint to delete it in this fork.
- Screenshots and images named in the site code exist in the build.
- `demo.*` keys used in code exist in `en.json`. Unused `demo.*` keys are only warnings.
- `scripts/demo/check-agents.mjs` passes. Every agent in `docs/agents/built-in-agents.md` has a built page, every `docs/agents/` guide is in the docs index, and every slug in `AGENT_TAGLINES` (`packages/client/src/demo/features.ts`) still exists and has a `demo.agents.tagline.<slug>` key in `en.json`.

### When upstream adds an agent

`pnpm build:demo` makes the agent pages from `docs/agents/built-in-agents.md`: one page per `### Name` under a `## Category`, at `#/features/agents/<slug>`, where the slug is the heading anchor in that guide. A new agent gets its page on the next build, with the first sentence of its entry as the tagline, so nothing must change. To give it a hand-written tagline, add its slug to `AGENT_TAGLINES` and add `demo.agents.tagline.<slug>` to `en.json`. When upstream renames or removes an agent, `check-agents` names the stale tagline to rename or remove.
- `APP_VERSION` equals the root `package.json` version and the built `demo-build.json`. With `--tag vX.Y.Z` (CI passes it for release builds), the version must also equal the tag.

## When a run fails

The job summary of each run lists the source, release tag, upstream commit, overlay commits, check results and the deploy URL. A failed run deploys nothing, so the old site stays online. To repair it, give your AI helper this prompt:

> Read WEBSITE-REBUILD.md. The "Static demo Pages" run <URL> failed. Read its log and job summary. If the overlay did not apply, run `pnpm website:refresh --source <source>` (with `--tag <tag>` for a release) and follow the printed repair prompt. If `check-site` failed, fix each numbered problem in the overlay, not in upstream code. Then run `heavy pnpm build:demo`, `pnpm check:site` and `heavy pnpm smoke:demo`, commit the overlay fix to `main`, and run the workflow again with the same `source_ref`.
