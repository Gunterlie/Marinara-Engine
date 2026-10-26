# Marinara Engine as its own website

Status: official-site direction reviewed with Claude Opus; maintainer explicitly chose the Engine Home as the first page. The fork Pages site is the preview environment; it is not yet an official-domain or upstream release deployment.

## The idea

Make the website a useful introduction to the product and a working example of it. Visitors can understand Marinara, see what the installed Engine does, read guides, and try a safe scripted version before downloading. One source of product truth, theme language, documentation, and demo scenarios should serve all of these journeys.

The website's job is to help someone decide whether Marinara is for them and get them successfully installed. The maintainer explicitly wants the real Engine Home to be the first page, inside the Engine shell. Preserve that identity and continuity. Make Home welcoming and purposeful, then defer expensive features it does not need; do not replace it with a separate marketing entry.

## Visitor journey

1. Understand: a short explanation, actual product screenshots, and concrete examples of Conversation, Roleplay, and Game Mode.
2. See value: characters, world knowledge, visual scenes, voice/media, and agents shown through real product behavior. Mark screenshots of the full installed Engine separately from features available in the scripted preview.
3. Choose: Download / installation for the visitor's platform, or Try the scripted demo. Offer all platforms explicitly; detection may suggest a default but never hide the alternatives.
4. Try: enter the real Engine interface with curated content, short lessons, clear scripted-reply labeling, reset, and an obvious route back to the website or docs.
5. Install: get the right stable artifact or platform guide, understand prerequisites, connect a model, and reach a first conversation.
6. Return: searchable docs, release information, GitHub, community, and contribution links remain easy to find.

“Free” describes the open-source app. The visitor brings a model: hosted providers can charge, and local models need suitable hardware. Android's current APK requires the documented Termux setup; iOS PWA connects to an Engine hosted on another device. Do not present either as a standalone, one-tap native app.

## Public page map

| Surface | Purpose |
| --- | --- |
| Home | Product identity, real screenshots, benefits, Download and Try demo |
| Features | A few visual, concrete stories with links to relevant guides and demo journeys |
| Install / platform | Current stable download where available, requirements, concise setup steps, troubleshooting |
| Demo | Full Engine, scripted runtime, lessons, supported edits, independent visitor state |
| Documentation / guide / heading | Browse, full-text search, stable section links and copyable addresses |
| Releases | Published stable version/date, notes, compatibility and installation caveats |
| Community / footer | GitHub, verified community link, contribution and license information |

Use website navigation on public surfaces: Home, Features, Documentation, Download, Try demo. Keep the Engine shell and its navigation. The Home content prioritizes product information, installation and guides; advanced controls remain discoverable through the existing Engine navigation. Professor Mari can guide the visitor, but real product imagery should carry the main claim.

## Architecture

Keep this in the Engine repository. Keep the demo adapter independent from ordinary installed behavior. Avoid a separate marketing framework or duplicated docs.

The real Engine application opens on its enhanced Home. Measure its initial download and render cost, then defer optional editors, mode-specific assets, media/3D/game runtimes and work that Home does not need. Use existing lazy-loading boundaries before adding new architecture. A separate lightweight landing application is not the selected design.

For discovery, progressively generate static HTML snapshots of the same Home and user-guide content at build time, with real paths beneath the Pages base and hydration into the Engine. Public-facing content should remain readable without JavaScript where practical. The visible first experience and navigation remain Engine Home; a new framework or server is unnecessary.

The current preview uses hash routes (`#/`, `#/demo`, `#/docs/<path>?section=<heading>`) because Pages serves them without rewrite rules. These establish the navigation and reader behavior, but are not the final SEO architecture. Retain redirects from shared preview URLs when real public routes are introduced.

Every public guide needs a unique title, description, canonical URL, social preview, heading IDs and meaningful links. Generate sitemap/robots files and per-path index.html files; unknown paths need a helpful 404. A blank SPA shell plus a redirect is insufficient for search engines or no-JavaScript documentation.

Keep the fork preview out of indexing until the official canonical site is chosen. The installed app retains its existing noindex policy. Only the official public-site build becomes indexable. Do not change DNS, an official domain, upstream deployment settings, or release ownership as part of the preview.

## Documentation and content

Publish user guides from the same source revision as the site. Use an explicit public category list; development PRDs, cleanup audits, implementation plans and contribution internals stay linked on GitHub. Noodle's user-facing overview/settings guides remain public product documentation.

Internal links stay in the site and preserve sections. Source-file links go to a source revision that really contains them. Do not rewrite Markdown inside code examples. All published images must be local or explicitly supported; illustrative code samples are not image requests. Search should not require downloading the whole Engine or internal docs.

Translations can follow from docs-i18n after the English flow is proven. Distinguish UI language from guide language and show fallback honestly.

## Release truth and operations

Build the official site/demo from the published stable source, record its tag and commit, and show that exact version. Never infer “latest stable” from a staging package.json. Resolve installer links from the release's actual artifacts, with a working guide fallback for platforms without a direct installer.

Publish immutable version snapshots and a latest pointer atomically after validation. Define a Pages storage budget and retention policy; retain downloadable archives separately. A failed release build must leave the previous website online. Keep English docs and scenario revision paired with the release. Treat official-domain cutover, upstream adoption and release-trigger credentials as explicit rollout decisions.

Start without advertising networks, tracking cookies, accounts, email capture or remote AI calls. “Advertising” here means explaining Marinara well. Consider minimal aggregate analytics only if there is a concrete question they need to answer; never collect demo conversation text. Prefer ordinary links to trustworthy release/community destinations.

## Delivery sequence and proof

1. **Preview experience (current work):** landing inside the demo, real screenshots, model-cost clarity, platform guides, integrated public docs, section links, navigation and independent sessions. Show desktop/phone screenshots and let the maintainer try the fork preview.
2. **Engine-Home delivery/performance:** keep Engine Home as the first screen, measure requests and mobile loading, and defer work not needed by Home. Add static snapshots of the same content, metadata/social artwork, real routes, old-hash redirects, sitemap and useful 404 without replacing the Engine entry experience.
3. **Download/release integration:** stable source/asset manifest, release notes, per-platform links, version snapshots and retention. Verify every download destination and publish failure recovery.
4. **Official cutover:** maintainer chooses the canonical domain/repository and ownership, then validate redirects, indexing, link previews and monitoring before enabling public discovery.
5. **Expansion:** richer task-validated demo journeys, translations, additional product stories and measured conversion improvements.

Acceptance includes: 390/768/1440 px, light/dark and both visual themes for shared surfaces; keyboard/focus and reduced motion; direct guide/heading visit, refresh and Back/Forward; internal links/search/no-results/missing-guide states; two simultaneous isolated visitors; reset without unrelated data loss; normal installed Home unchanged; static public snapshots readable with JavaScript off once implemented; no accidental API/provider traffic; real stable downloads; social previews and canonical tags matching each page. Set performance budgets using a reproducible mobile profile before calling the official site fast. Lighthouse targets and timing claims require measured results.

## Decisions before official launch

- Canonical domain and deployment repository; fork preview can continue in the meantime.
- Who owns website copy, product screenshots, docs accuracy and release-publish failures.
- Stable release archive retention/storage budget.
- Which verified community destination to promote.

These decisions do not block the preview. They do block claiming the trial is the official, searchable, release-maintained website.

Maintainer decision (2026-10-26): the actual Engine Home is the website first page. Opus's suggestion of a separate lightweight public entry was considered and declined. Performance work must respect this constraint. No first-load performance score or byte budget has been measured yet.
