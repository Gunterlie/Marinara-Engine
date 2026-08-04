# Scoped Library View

Branch: `feat/scoped-library-view` (fork remote `gunterlie`)
Stacked on: PR #4558 (`all-my-little-piggies`) — needs the shared `LibraryCard` model and
`card-library-filter` pipeline from `1eb3fc1`. Do not rebase onto `staging` until #4558 lands.

## Context

One enhanced library window, scoped by which entrypoint opened it. Open it from characters and
it is the character library; from personas, the persona library; from lorebooks, the lorebook
library. Same window, same manager features, every time.

**Two-thirds of this already exists.** `AppShell.tsx:784` renders a single
`<CharacterLibraryView key={cardLibraryKind} />`, and `openCharacterLibrary()` /
`openPersonaLibrary()` (`ui.store.ts:1941`, `:1963`) set `cardLibraryKind` before opening it. The
`key=` forces a remount on scope change, so per-scope state cannot leak — adding a third scope is
safe by construction.

What is missing is that the scope is a **string checked 58 times** rather than a descriptor, and
that boolean does two unrelated jobs:

- *which data do I load* — paging hook, row→card conversion, export path, delete mutation
- *which features are allowed* — ~15 `!isPersonaLibrary &&` gates

Conflating them is why personas share the window but get a degraded library. Each gate looked
locally reasonable; the degradation is only visible in aggregate.

### What each scope actually supports today

| | Characters | Personas | Lorebooks |
|---|---|---|---|
| Search, sort, grid/table, density, keyboard | yes | yes | free — same `useInfiniteQuery` + `LIBRARY_PAGE_SIZE` |
| Tags | yes | **yes — `tags` column, `getPersonaTags` already runs** | tags *and* categories |
| Groups | yes | **backend complete, UI gated off** (`CharacterLibraryView.tsx:1238`) | folders in localStorage |
| Export | yes | `POST /personas/export-bulk` exists | to confirm |
| Favorites | yes | no — personas have `isActive`, no `fav` column | n/a |
| Bulk edit | yes | no `PATCH /personas/bulk` | none |

Two rows matter most: `GET/POST/PATCH/DELETE /persona-groups` are **fully implemented**
(`characters.routes.ts:2639-2664`) and hidden behind one gate, and persona tags already work. Most
of "enhanced library everywhere" is unblocking, not building.

## Non-goals

- The six sidebar panels. Different layout, drag-into-chat semantics. Their fix is a shared
  `FolderRow` component (~1,500 lines of literal copy-paste, with live drift bugs: the inline-rename
  focus ring and skeleton height disagree between `LorebooksPanel` and `PresetsPanel`). Independent
  of this work.
- The game asset browser. It is a filesystem browser — `TreeNode` has no `id`, every mutation takes
  a path, the server side is `readdirSync`/`mkdir`/`rm`. Resources are DB rows with no path. Not
  reconcilable without inventing a third representation both sides adapt into.
- Per-type editors. Every type has a bespoke one and should.

## Phase 1 — Scope descriptor (pure refactor)

**New: `packages/client/src/components/library/library-scope.ts`**

```ts
export type LibraryScope = {
  kind: CardLibraryKind;
  copy: LibraryCopy;                                  // LIBRARY_COPY already exists
  usePages(args: { search: string; sort: string; enabled: boolean }): UseInfiniteQueryResult;
  flattenPages(data: unknown): unknown[];
  toCard(row: any): LibraryCard;
  openEditor(id: string): void;
  deleteItem(id: string): Promise<unknown>;
  export: { path: string; filename: string };
  /** ui.store accessors, so scroll/sort/selection persist per scope. */
  persistence: {
    useSelectedId(): [string | null, (id: string | null) => void];
    useSort(): [string, (sort: string) => void];
    useScrollTop(): [number, (top: number) => void];
  };
  capabilities: {
    favorites: boolean;
    tags: boolean;
    groups: boolean;
    chat: boolean;
    bulkEdit: boolean;
    tagManager: boolean;
  };
};

export const LIBRARY_SCOPES: Record<CardLibraryKind, LibraryScope>;
```

Then replace all 58 `isPersonaLibrary ? A : B` sites with `scope.*` lookups. Behaviour-preserving:
the character and persona descriptors must reproduce exactly what the booleans do today, including
the persona quirks (client-side favourite filtering because there is no server query,
`favorite: false` hardcoded on persona cards).

**Commit split — this is the risky phase, keep it surgical:**
1. Add `library-scope.ts` with both descriptors; wire only the data-loading sites (paging, flatten,
   toCard, export, delete). No capability gates touched.
2. Wire the capability gates. Behaviour identical — personas still get `groups: false` here.
3. Rename/move `components/characters/CharacterLibraryView.tsx` →
   `components/library/LibraryView.tsx`, update `AppShell.tsx:68-69` lazy import. **Rename alone,
   no logic**, so the diff is reviewable as a move.

Do not combine 3 with 1 or 2 — a combined diff reads as a rewrite and hides the logic change.

## Phase 2 — Turn on what personas already support

Flip `groups: true` for personas and back it with the existing `/persona-groups` endpoints.

- `use-characters.ts` already has `usePersonaGroups` / persona group mutations (`:1303-1334`)
- `parseCharacterGroups` / `collectGroupedCharacterIds` / `computeGroupMembershipUpdates` are
  type-agnostic — they read `characterIds`. Personas store membership in `personaIds`, so either
  generalise the field name in the parser or normalise at the adapter boundary. Prefer the adapter.
- Remove the `!isPersonaLibrary` guard on the group chip row and the group context-menu entries

This is deleting gates, not writing features. Highest value-to-effort in the plan.

## Phase 3 — Lorebook folders onto the server

Prerequisite for Phase 4, and a real bug fix regardless.

Lorebook, preset and agent folders live in `localStorage` under `marinara-library-folders-v1`
(`hooks/use-library-folders.ts:17`). They do not sync across devices, are not in backups, and are
lost on a cache clear.

`routes/folder-routes.shared.ts` already exports a generic `registerFolderCrudRoutes<TCreate,
TFolder>` — used by only two of five folder systems today. Add a `lorebook_library_folders` table
and register it there.

**Migration risk is the whole phase.** Existing folders are client-side only, so the server cannot
see them to migrate. Options, pick one deliberately:
- one-shot client-side upload on first load after upgrade, then clear the localStorage key
- accept the loss and tell users in `CHANGELOG.md`

The first is the honest choice; it is ~40 lines and runs once.

Do **not** migrate preset and agent folders in this phase — same backend, but they belong to the
sidebar panels, which are out of scope here. Land lorebooks, prove the pattern, do the other two
separately.

## Phase 4 — Lorebook scope

Fill in one descriptor. Lorebooks gain a full-page library they have never had.

- `useLorebookPages` already matches the shape (`use-lorebooks.ts:49`, same `LIBRARY_PAGE_SIZE`)
- `toLorebookLibraryCard`: name, description, entry count in place of token estimate, no avatar
- `LibraryCard.avatarPath` is already nullable; confirm the grid renders acceptably without one and
  add a neutral placeholder if not
- taxonomy: lorebooks have both tags and categories. Map tags to the existing tag chips; leave
  categories to the sidebar panel for now rather than inventing a second filter row
- `capabilities: { favorites: false, tags: true, groups: true, chat: false, bulkEdit: false,
  tagManager: false }`
- new `openLorebookLibrary()` in `ui.store`, plus the `cardLibraryKind` union, its normalizer
  (`:2875`) and persist partialize

## Phase 5 — Optional, real backend work

Only if wanted; each is genuine new surface, not unblocking.

- `fav` column on personas + server favourite filter → `favorites: true`
- `PATCH /personas/bulk` mirroring `PATCH /characters/bulk` → `bulkEdit: true`, `tagManager: true`

## Honest assessment

**Line count will land roughly neutral in Phase 1.** The 58 branches shrink; the descriptors add
~60 lines each. The previous refactor on this code was projected at −450 and came in at +76 — do
not repeat that claim.

**The economic argument is avoided future code, not deletion.** A lorebook library built the way
the current one was built is another ~1,300–1,700 line component with its own drifting copy of
search, sort, selection and bulk. As a scope it is ~60 lines. The six sidebar panels are what
happens when that cost is not paid early: ~9,900 lines, ~1,200 shared.

**Counterweight:** if no third type were coming, Phase 1 would be marginal tidying on working code.
It is justified by Phase 4 being real, not by today's mess alone.

**Risk:** 58 edits in a 1,758-line component with no component test harness. The failure mode is a
subtle interaction missed while reading — the same way the earlier plan's "the two sidebar cards
differ by one button" turned out to be false on inspection. Mitigation is the commit split above
plus the manual list below.

## Verification

Automated (necessary, not sufficient — none of this covers rendering):
- `pnpm check` — TypeScript, ESLint, localization, build
- `pnpm regression:card-library-search` — extend with asserts that each scope descriptor declares
  the capability set its backend actually supports, so a `true` with no endpoint behind it fails
- `pnpm regression:character-bulk-edit`, `pnpm regression:chat-resource-drop`

Manual, per phase — the real gate:

Phase 1 (character library must be byte-for-byte unchanged in behaviour)
- [ ] Search, including `tag:"x"` and `-tag:"x"` syntax
- [ ] All five sort orders, with and without tag filters active
- [ ] Grid and table, all three densities, persistence across reload
- [ ] Keyboard nav: `/`, `j`/`k`, arrows, Home/End, Enter, Esc
- [ ] Multi-select: ctrl-click, shift-click range, select-all
- [ ] Bulk export, bulk delete, bulk edit, tag manager
- [ ] Infinite scroll and scroll restoration
- [ ] Same pass for the persona library
- [ ] Switch scopes back and forth; confirm no state bleed

Phase 2
- [ ] Persona group chips filter correctly, including Ungrouped
- [ ] Move a persona between groups; confirm exactly two PATCH requests
- [ ] Persona groups still work wherever they are consumed outside the library

Phase 3
- [ ] Existing localStorage lorebook folders survive the upgrade
- [ ] Folders now persist across a cache clear and appear in a backup

Phase 4
- [ ] Lorebook library opens from the lorebooks entrypoint with correct copy
- [ ] Cards render acceptably with no avatar
- [ ] Editing a lorebook from the library returns to the library, not the panel

Per `CLAUDE.md`: leave every checkbox unchecked in the PR. They are a to-do list for a human, not
evidence.

## Open question

Phase 4 gives lorebooks a full-page library while `LorebooksPanel` keeps its own sidebar list with
categories, its own folders and its own sort. That mirrors how characters work today (panel +
library), so it is consistent — but it means two lorebook surfaces to keep aligned, which is the
exact problem this branch exists to fix one level up. Worth deciding before Phase 4 whether the
lorebook panel should defer to the library the way it eventually should for characters.
