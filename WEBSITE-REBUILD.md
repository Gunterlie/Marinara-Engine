# Rebuilding the demo website on a new upstream release

The website is an overlay: a few commits on top of upstream `staging`. A refresh replays those commits onto the
latest upstream `main` or `staging` in a separate worktree. Your branch, upstream and the fork stay unchanged.

## Start here (human or AI)

1. Commit the overlay on `feat/static-demo-tutorial`. The tree must be clean.
2. Run `pnpm website:refresh --source staging` (or `main`).
   - It fetches `Pasta-Devs/Marinara-Engine` with a fixed URL. Only `main` and `staging` are accepted.
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
5. In the worktree run `heavy pnpm install --frozen-lockfile`, `heavy pnpm build:demo`, `heavy pnpm smoke:demo`.
6. Review `git diff <sourceSha>..HEAD` in the worktree before you publish.
7. Publish the reviewed worktree as a candidate branch on the fork, with a normal push (no force):
   `git switch -c website-refresh/<name>` then `git push <fork-remote> HEAD:refs/heads/website-refresh/<name>`.
   Deploy it from the trusted workflow on the feature branch:
   `gh workflow run demo-pages.yml --repo Gunterlie/Marinara-Engine --ref feat/static-demo-tutorial -f source_ref=current -f prepared_branch=website-refresh/<name>`
   The website needs no provider secret.

## CI

`Static demo Pages trial` has a manual input `source_ref`: `current` (default, same as a push), `main` or `staging`.
Optional `prepared_branch` (only `website-refresh/*`, needs `source_ref=current`) builds and deploys that exact reviewed candidate; its provenance records the built HEAD. The workflow itself must be dispatched from `feat/static-demo-tutorial`. It runs the same prepare, install, build and smoke steps. If any step fails, the `deploy` job does not run and the
old site stays. The build adds `website-source.json` next to `demo-build.json` with the source line, the exact
upstream commit, the overlay base and commits, and the prepared head.

## Check

`node scripts/demo/refresh-check.mjs` tests the helper against a throw-away git fixture under `~/scratch`.
