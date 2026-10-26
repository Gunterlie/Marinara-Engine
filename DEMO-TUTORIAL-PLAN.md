# Static Marinara demo and tutorial plan

Status: the browser demo is implemented on `feat/static-demo-tutorial` in the user's fork. The first delivery is a working fork Pages trial; official stable-release publishing remains a separate rollout stage.

## Goal

Publish a browser-only demo for each stable Marinara Engine release. Visitors can explore the real interface and complete guided tutorials using example content and scripted replies. Hosting serves static files only: no Marinara backend, database, AI provider, accounts, or shared user sessions.

Multiple visitors must be able to use the same URL simultaneously. Each browser owns an independent working copy of the example data. One visitor's messages, edits, tutorial progress, and resets must never affect another visitor.

## Initial hosting target

Develop and trial GitHub Pages in the user's `Gunterlie/Marinara-Engine` fork. The feature branch is `feat/static-demo-tutorial`, based on upstream `staging`. Do not configure or deploy upstream Pages as part of this trial.

The expected project-site URL is `https://gunterlie.github.io/Marinara-Engine/`, subject to checking existing Pages configuration. A dedicated demo repository or custom domain remains an option if that site is already occupied. The fork's project site does not require replacing the user's root `gunterlie.github.io` site.

GitHub Pages supports static HTML, CSS, and JavaScript. It cannot run the existing Engine server. Build the demo with paths that work beneath the repository prefix and each release subdirectory; audit hardcoded root paths, dynamic imports, localization files, images, fonts, and downloads.

GitHub currently documents a 1 GB published-site limit and a soft 100 GB monthly bandwidth limit. Set artifact-size and archive-retention budgets before accumulating release snapshots. Retain downloadable demo archives as release artifacts; do not promise unlimited versions on the Pages site.

References:
- https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits

## Visitor experience

- Explore: browse curated characters, personas, example chats, and lorebooks.
- Learn: follow practical tutorials with Professor Mari.
- Show the stable version and clearly identify scripted responses.
- Provide Reset demo and Install Marinara actions.
- Allow supported local edits and appearance changes.
- Explain unsupported operations before they produce errors.
- Accept no real provider credentials and send no user messages to remote services.

## Technical approach

Reuse the actual Engine frontend inside this repository. Produce separate normal-app and static-demo build outputs, rather than maintaining a copied interface.

Add a browser-side implementation of the backend operations required by supported demo journeys. Keep the existing API shapes and React Query flow where practical. Keep example content immutable and create a working copy per browser session.

The central API client is a useful integration point, but it is insufficient alone. Audit direct fetch calls, streaming, startup health checks, settings synchronization, diagnostics, update prompts, package loading, asset routes, and external integrations. Explicitly handle or disable each required path. Unsupported operations must not fall through to a real backend.

Use one clear build-mode boundary and a small, explicit supported operation set. Avoid implementing a complete duplicate of the server or spreading demo checks through every component. Prove the integration approach with a vertical slice before broadening it.

Disable demo service-worker registration initially to simplify cache and release isolation. Preserve ordinary Engine behavior.

## Session and concurrency model

- Serve the same immutable application files to all visitors.
- Keep active chats and edits in browser memory initially.
- Persist tutorial completion and preferences locally where useful.
- Namespace persistent keys by demo identity and release version.
- Reload may restore example content while retaining tutorial completion; document that behavior.
- Reset cancels active scripts, clears the demo's own preferences and lesson progress, and reloads its seed content and query caches.
- Never clear unrelated local storage. Account for multiple Pages projects sharing the same origin.
- Treat separate tabs as independent active sessions; avoid synchronizing mutable chat data through local storage.
- No shared writes, database, server-side session store, or per-visitor backend processes.

Concurrency is primarily static-file delivery and bandwidth. Verify isolation with separate browser contexts and simultaneous scripted chats.

## Scripted chat behavior

Store authored scenarios and response branches as content, separate from UI code. Provide suggested messages that lead through meaningful examples.

Simulate streamed replies and support sending, stopping, and the selected edit/regenerate actions taught by tutorials. Define repeat behavior and an honest fallback for messages outside a scenario. Do not imply that arbitrary free-form input is understood by an AI.

Cancellation, reset, switching chats, and retry must not append delayed messages to the wrong conversation. A prepared example of a lorebook or agent effect must be identified as a simulation rather than evidence of live model reasoning.

## Feature boundaries

| Area | Initial behavior |
| --- | --- |
| Characters, personas, lorebooks | Browse and supported local editing |
| Chats | Authored scenarios and simulated streaming |
| Appearance | Supported browser-local settings |
| Provider setup | Explain using example values; no real secrets |
| Images, audio, agents | Clearly labeled bundled demonstrations where included |
| Downloads, updates, server administration | Explain availability in the installed app |
| External catalogs and integrations | Curated examples; no live integrations initially |

## Tutorials

Reuse the existing onboarding tour's highlighting, navigation, focus behavior, and Mari presentation where practical. Navigation is currently state-based, so avoid introducing a URL router merely for this feature.

Initial lessons:
1. Open a character and send a first message.
2. Edit a character and understand the main fields.
3. Create a persona.
4. Add a lorebook entry and inspect a prepared demonstration of its effect.
5. Understand provider connections and continue in an installed Engine.

Each lesson defines its seed state, instructions, expected actions, completion conditions, and exit/restart behavior. Allow skipping and restarting. Account for user detours and missing highlighted elements.

All new interface copy uses semantic localization keys and the canonical English catalog. Community translations can fall back to English. Verify phone and desktop layouts, light/dark themes, keyboard use, focus management, and reduced motion.

## Content and assets

Bundle required avatars, backgrounds, Mari sprites, localization resources, and example media. Replace server-owned asset URLs with static demo assets where necessary.

Use original or appropriately licensed content. Include no personal data, production exports, credentials, or remote executable packages. Include only assets needed by supported journeys and measure initial transfer size.

## Stable-release publishing

Build each demo from the exact stable release tag. Keep scenario content and build provenance with that source version.

Provide a release index, version-specific paths such as `versions/vX.Y.Z/`, a latest-demo entry, and downloadable static archives. Prefer a small landing page linking to the latest version rather than copying every release twice.

Use a GitHub Actions Pages deployment for the fork trial after checking existing configuration and permissions. Publish the complete site artifact, retaining selected previous versions: a Pages deployment must not accidentally erase them. Choose a reproducible archive source rather than relying only on expiring workflow artifacts.

Serialize publications and ensure an older job cannot replace the latest pointer with an older release. Publish only tested artifacts. Keep the previous working demo when a new build or verification fails. A demo failure should report clearly without silently breaking normal application release publishing.

Check stable-versus-prerelease metadata explicitly. Support manual rebuilds for an exact tag and distinguish trial previews from official stable demos. Do not change upstream release automation until the fork trial proves the approach.

## Verification and acceptance

Serve the built artifact with an ordinary static server, with no Engine backend present. Development-server proxies must not hide missing implementation.

Required proof:
- Static startup and all supported journeys complete without backend or AI requests.
- Two isolated browser sessions send messages and edit content concurrently without interference.
- Reset and tutorial completion in one visitor's session do not affect another.
- Multiple tabs do not share mutable chat state accidentally.
- Unhandled operations are rejected clearly, with no real-service fallback.
- Cancellation, reset, chat switching, regeneration, and refresh have deterministic behavior.
- Version-specific demos isolate persistent state.
- Repository-prefix and nested-version asset paths work, including dynamic imports.
- Phone, desktop, keyboard, reduced-motion, light, and dark journeys work.
- The normal Engine build retains its existing behavior.
- Deployment retention and older-job ordering preserve the correct published versions.

Run narrow checks first, then applicable repository validation, localization checks, builds, and browser smoke coverage. Run heavy commands through `heavy` and stop temporary servers and browsers afterward. Keep the smallest runnable regression proof in repository-supported form; do not retain temporary `.test.ts` files.

## Delivery stages

1. Technical proof: static startup, one character, one scripted chat, two independent browser sessions, and nested-path hosting verification.
2. Useful playground: curated content, supported edits, reset behavior, startup audit, and clear feature limitations.
3. Guided learning: initial lessons, responsive and accessible interaction, localization, and realistic scenario content.
4. Fork Pages trial: reproducible static artifact, deployment workflow, version paths, publication checks, and a working public trial URL.
5. Stable-release integration: validated release triggering, latest pointer, retained-version policy, archive availability, and maintenance documentation. Decide separately whether official hosting remains in the user fork or moves upstream.

Each stage must pass its acceptance proof before expanding scope. Implementation belongs against staging and follows repository review requirements. This plan does not authorize merging, an official upstream deployment, or a release.

## Maintenance

For each stable release, run demo journeys and review lessons affected by UI or behavior changes. Assign ownership for scenario updates and publication failures. Record source version, commit, scenario revision, and artifact size with each demo.

Before implementation, confirm existing fork Pages usage, first-release scope, asset budget, archive-retention policy, and tutorial-content owner. Use the defaults in this plan for the technical proof; hosting decisions need not block that local proof.

## Completion criterion

Two people can open the same public demo URL, take different actions, and complete tutorials independently, with only static hosting running. The version displayed matches the release used to build it, and an installation link takes visitors to the real application.

## Trial development commands

```sh
heavy pnpm install --frozen-lockfile
heavy pnpm build:demo
heavy pnpm smoke:demo
```

The build writes `packages/client/dist-demo`, leaving normal `dist` output separate. `smoke:demo` serves that output with a temporary static server, opens independent browser contexts, exercises real chat controls and local edits, checks reset isolation, and captures screenshots under ignored `pr-evidence/static-demo`. It closes its server and browser on success or failure.

To prove nested release paths, build and run the same smoke with a different base:

```sh
MARINARA_DEMO_BASE=/Marinara-Engine/versions/v2.5.1/ heavy pnpm build:demo
heavy pnpm smoke:demo
```

The fork-only `demo-pages.yml` workflow builds and tests the trial branch before deployment. Pages must be configured for GitHub Actions in the fork. This trial workflow publishes one current demo; it does not yet implement release retention or claim to publish every stable release. Those remain stage 5 work.

The initial lessons are replayable orientation tours. A viewed indicator means the visitor reached the end of the lesson; it does not attest that an editing or chat task was completed. Task-validated lessons remain part of the later tutorial expansion.


## Trial implementation and proof

The trial includes a per-tab in-memory API adapter, deterministic streaming replies, curated lighthouse content, supported local character/chat/lorebook edits, three replayable lessons, and reset. Preferences and viewed lessons use storage namespaced by app version and hosting base; unavailable storage falls back to page memory. Reset clears that namespace on the next startup, after the outgoing document finishes saving preferences.

Local validation completed: full `pnpm check`, the seven normal `smoke:ui` cases, `version:check`, and the dedicated static-demo smoke. The demo smoke exercises simultaneous independent visitors, real composer sends and PATCH requests through the CSRF shim, cancellation, pagination, same-browser tab isolation, reset without clearing unrelated storage, keyboard lesson navigation, and denied browser storage. Screenshots cover 390, 768, and 1440 px, both visual styles, and light/dark appearance. The normal build contains no `demo-message` seed marker. The same smoke also passed under `/Marinara-Engine/versions/v2.5.1/`. The final focused CodeRabbit rerun found no additional findings after the reset and focus fixes.

Review fixes included request-body preservation, correct typing events, cursor pagination, normal-build module exclusion, public-asset prefixing, storage fallback, keyboard focus, mobile drawer positioning, and reset persistence. Review suggestions to remove the static runtime import were rejected after tracing the import graph: it loads no persisted stores before storage isolation. Suggestions to rewrite all dynamic sprite paths were rejected because those paths are API assets; the public Mari animation helper is handled explicitly. Reset copy deliberately distinguishes per-tab chats from preferences shared across tabs.

Real iOS keyboard panning and notch safe areas still need device verification. Optional server-backed features return an explicit unsupported error. The initial lessons show orientation and record viewing; they do not validate a visitor's editing task. This fork trial does not provide automatic stable-release publication, retained snapshots, or a latest-version index yet.


## Homepage and documentation extension

The demo Home surface doubles as a product landing page: an introduction to Marinara, Professor Mari, a clearly labelled scripted preview, Try the demo, and platform installation guides. Normal installed Engine Home behavior stays separate.

The static artifact includes English documentation from the same source checkout. Visitors can browse and search the guides without a documentation server. URLs use hash routes so GitHub Pages can serve direct visits and refreshes:

- `#/` — homepage
- `#/demo` — scripted chat
- `#/docs` — documentation index and search
- `#/docs/installation/windows.md` — an individual guide
- `#/docs/installation/windows.md?section=<heading-id>` — a guide section

The reader offers an on-page contents list and Copy page link. Internal Markdown links stay in the reader; links to source files point to the fork source branch during this trial. Documentation is bundled in English; downloading translation packs requires an installed Engine. The site continues to use independent browser sessions and static hosting.

Homepage review decision: hash navigation deliberately closes the chat sidebar on desktop as well as mobile, so the public landing and documentation have the full central surface. The chat toggle remains available. A review suggestion to preserve the desktop sidebar was dismissed as conflicting with this homepage behavior.
