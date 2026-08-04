import assert from "node:assert/strict";
import {
  CARD_HEALTH_TOKEN_BLOAT,
  estimateCharacterCardTokens,
  getCardHealthIssues,
} from "../../packages/shared/src/utils/character-card-health.js";
import {
  formatCardLibraryMeta,
  getCardLibrarySummary,
  matchesCardLibrarySearch,
  parseCardLibrarySearchQuery,
} from "../../packages/client/src/lib/card-library-search.js";
import {
  collectLibraryTags,
  filterLibraryCards,
  getLibraryTagState,
  sortLibraryCards,
  toggleLibraryTagFilter,
} from "../../packages/client/src/lib/card-library-filter.js";
import {
  collectGroupedCharacterIds,
  computeGroupMembershipUpdates,
  parseCharacterGroups,
  type LibraryCard,
} from "../../packages/client/src/lib/character-library-card.js";

const characterLibrarySearchDocument = {
  name: "Il Dottore",
  title: "Modern AU version",
  meta: formatCardLibraryMeta("Pasta Devs", "3.0"),
  summary: getCardLibrarySummary(["A meticulous creator note.", "A Fatui researcher."]),
  tags: ["scientist", "villain"],
  sections: [
    { content: "A Fatui researcher." },
    { content: "Clinical and exacting." },
    { content: "A laboratory in Snezhnaya." },
    { content: "You are late." },
  ],
};

assert.equal(
  matchesCardLibrarySearch(characterLibrarySearchDocument, parseCardLibrarySearchQuery("pasta devs")),
  true,
);
assert.equal(
  matchesCardLibrarySearch(characterLibrarySearchDocument, parseCardLibrarySearchQuery("snezhnaya")),
  true,
);
assert.equal(
  matchesCardLibrarySearch(characterLibrarySearchDocument, parseCardLibrarySearchQuery("-tag:villain dottore")),
  false,
);

const personaLibrarySearchDocument = {
  name: "Mari",
  title: "Research partner",
  meta: formatCardLibraryMeta("SpicyMarinara", "2.0"),
  summary: getCardLibrarySummary(["A precise persona card.", "An AI engineer."]),
  tags: ["engineer"],
  sections: [
    { content: "An AI engineer." },
    { content: "Curious and formidable." },
    { content: "Working beside Dottore." },
    { content: "A shared laboratory history." },
    { content: "White coat and crimson accents." },
  ],
};

assert.equal(
  matchesCardLibrarySearch(personaLibrarySearchDocument, parseCardLibrarySearchQuery("spicymarinara")),
  true,
);
assert.equal(
  matchesCardLibrarySearch(personaLibrarySearchDocument, parseCardLibrarySearchQuery("formidable")),
  true,
);

// ──────────────────────────────────────────────
// Shared filter/sort pipeline
// ──────────────────────────────────────────────
// Both character surfaces run through this. The AND/OR split is load-bearing: the full
// library narrows on multiple tags, the sidebar widens, and neither may silently change.

function card(overrides: Partial<LibraryCard> & { id: string; name: string }): LibraryCard {
  return {
    title: null,
    meta: null,
    summary: "",
    avatarPath: null,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    tags: [],
    tokenEstimate: 0,
    favorite: false,
    active: false,
    creatorNotes: "",
    sections: [],
    hasStoredSummary: false,
    summarySource: { id: overrides.id, name: overrides.name, description: "", personality: "", scenario: "", tags: [] },
    ...overrides,
  };
}

const both = card({ id: "both", name: "Both", tags: ["scientist", "villain"], createdAt: "2026-01-03" });
const oneTag = card({ id: "one", name: "Alpha", tags: ["scientist"], createdAt: "2026-01-02" });
const untagged = card({ id: "none", name: "Zeta", favorite: true, createdAt: "2026-01-01" });
const pool = [oneTag, untagged, both];
const ids = (list: LibraryCard[]) => list.map((entry) => entry.id);

// `all` (full library) narrows to cards carrying every tag; `any` (sidebar) widens.
assert.deepEqual(
  ids(filterLibraryCards(pool, { search: "", includedTags: ["scientist", "villain"], excludedTags: [] })),
  ["both"],
);
assert.deepEqual(
  ids(
    filterLibraryCards(pool, {
      search: "",
      includedTags: ["scientist", "villain"],
      excludedTags: [],
      tagMatch: "any",
    }),
  ),
  ["one", "both"],
);

// Exclusion beats inclusion, in both tag modes.
for (const tagMatch of ["all", "any"] as const) {
  assert.deepEqual(
    ids(filterLibraryCards(pool, { search: "", includedTags: ["scientist"], excludedTags: ["villain"], tagMatch })),
    ["one"],
  );
}

assert.deepEqual(ids(filterLibraryCards(pool, { search: "", includedTags: [], excludedTags: [], untaggedOnly: true })), [
  "none",
]);
assert.deepEqual(
  ids(filterLibraryCards(pool, { search: "", includedTags: [], excludedTags: [], favorite: "favorites" })),
  ["none"],
);

// Tag-match count outranks the chosen sort, so the best match leads regardless of name order.
assert.deepEqual(ids(sortLibraryCards(pool, "name-asc")), ["one", "both", "none"]);
assert.deepEqual(ids(sortLibraryCards(pool, "name-asc", ["scientist", "villain"])), ["both", "one", "none"]);
assert.deepEqual(ids(sortLibraryCards(pool, "newest")), ["both", "one", "none"]);
// Sorting never mutates its input.
assert.deepEqual(ids(pool), ["one", "none", "both"]);

assert.deepEqual(collectLibraryTags(pool), ["scientist", "villain"]);
assert.equal(getLibraryTagState("Scientist", ["scientist"], []), "included");
assert.equal(getLibraryTagState("villain", [], ["villain"]), "excluded");
assert.equal(getLibraryTagState("ghost", ["scientist"], ["villain"]), "off");

// Toggling a tag as an exclusion lifts it out of the include list rather than holding both.
assert.deepEqual(toggleLibraryTagFilter("villain", true, ["villain"], []), { included: [], excluded: ["villain"] });
assert.deepEqual(toggleLibraryTagFilter("villain", false, ["villain"], []), { included: [], excluded: [] });

// ──────────────────────────────────────────────
// Group membership
// ──────────────────────────────────────────────

const groups = parseCharacterGroups([
  { id: "g1", name: "Heroes", description: "", avatarPath: null, characterIds: JSON.stringify(["a", "b"]) },
  { id: "g2", name: "Villains", description: "", avatarPath: null, characterIds: JSON.stringify(["c"]) },
  { id: "g3", name: "Broken", description: "", avatarPath: null, characterIds: "not json" },
]);

assert.deepEqual(
  groups.map((group) => group.memberIds),
  [["a", "b"], ["c"], []],
);
assert.deepEqual([...collectGroupedCharacterIds(groups)].sort(), ["a", "b", "c"]);

// A move touches only the source and the target — not every group.
assert.deepEqual(computeGroupMembershipUpdates(groups, ["a"], "g2"), [
  { id: "g1", characterIds: ["b"] },
  { id: "g2", characterIds: ["c", "a"] },
]);
// Moving to the root only drops from the source.
assert.deepEqual(computeGroupMembershipUpdates(groups, ["c"], null), [{ id: "g2", characterIds: [] }]);
// A no-op move writes nothing.
assert.deepEqual(computeGroupMembershipUpdates(groups, ["c"], "g2"), []);
assert.deepEqual(computeGroupMembershipUpdates(groups, [], "g1"), []);

// ──────────────────────────────────────────────
// Card health
// ──────────────────────────────────────────────
// Feeds the library badge and Professor Mari's prompt digest, so a wrong answer here shows
// up as her confidently misreporting the library.

const completeCard = {
  name: "Il Dottore",
  first_mes: "You are late.",
  alternate_greetings: ["Another door, another experiment."],
  mes_example: "<START>\n{{user}}: Hello\n{{char}}: Fascinating.",
  tags: ["scientist"],
};

assert.deepEqual(getCardHealthIssues(completeCard, { hasAvatar: true }), []);
assert.deepEqual(getCardHealthIssues({ ...completeCard, first_mes: "" }, { hasAvatar: true }), ["no-first-mes"]);
// A card with an opening line but no alternates is flagged for greetings, not for first_mes.
assert.deepEqual(getCardHealthIssues({ ...completeCard, alternate_greetings: [] }, { hasAvatar: true }), [
  "no-greetings",
]);
assert.deepEqual(getCardHealthIssues(completeCard, { hasAvatar: false }), ["no-avatar"]);
assert.deepEqual(getCardHealthIssues({ ...completeCard, tags: [] }, { hasAvatar: true }), ["no-tags"]);
assert.deepEqual(getCardHealthIssues({ ...completeCard, mes_example: "" }, { hasAvatar: true }), ["no-examples"]);
assert.deepEqual(
  getCardHealthIssues({ ...completeCard, description: "x".repeat(CARD_HEALTH_TOKEN_BLOAT * 4 + 8) }, {
    hasAvatar: true,
  }),
  ["token-bloat"],
);

// Whitespace-only tags and greetings do not count as present.
assert.deepEqual(getCardHealthIssues({ ...completeCard, tags: ["  "] }, { hasAvatar: true }), ["no-tags"]);

assert.equal(estimateCharacterCardTokens({ description: "x".repeat(400) }), 100);

console.info("Card library search regression checks passed.");
