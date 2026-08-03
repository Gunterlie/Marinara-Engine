import assert from "node:assert/strict";
import {
  applyBulkCharacterTags,
  findTagVariantGroups,
  normalizeTagKey,
} from "../../packages/shared/src/utils/character-bulk-tags.js";

// Adding a tag the card already carries must not duplicate it, and must not rewrite its casing.
assert.deepEqual(applyBulkCharacterTags(["villain", "mage"], ["Villain"], []), ["villain", "mage"]);

// Removal is case-insensitive.
assert.deepEqual(applyBulkCharacterTags(["Villain", "mage"], [], ["villain"]), ["mage"]);

// A tag in both lists is removed, not re-added — otherwise "swap tag A for tag A" would be a no-op
// for some cards and an addition for others depending on their existing tags.
assert.deepEqual(applyBulkCharacterTags(["villain"], ["villain"], ["villain"]), []);

// Additions are deduplicated against each other.
assert.deepEqual(applyBulkCharacterTags([], ["fantasy", "Fantasy"], []), ["fantasy"]);

// Cards with no tags yet still receive additions.
assert.deepEqual(applyBulkCharacterTags([], ["slow burn"], ["absent"]), ["slow burn"]);

// Untouched tags keep their original order.
assert.deepEqual(applyBulkCharacterTags(["c", "b", "a"], ["d"], ["b"]), ["c", "a", "d"]);

// Tag manager: the spellings people actually produce for the same tag collapse to one key.
assert.equal(normalizeTagKey("Slow Burn"), normalizeTagKey("slow-burn"));
assert.equal(normalizeTagKey("slow_burn"), normalizeTagKey("slowburn"));

// Genuinely different tags must NOT collapse — offering to merge these would destroy data.
assert.notEqual(normalizeTagKey("vampire"), normalizeTagKey("vampires"));
assert.notEqual(normalizeTagKey("mage"), normalizeTagKey("magic"));

// Only groups with more than one spelling are reported.
assert.deepEqual(
  findTagVariantGroups([
    { tag: "fantasy", count: 10 },
    { tag: "villain", count: 4 },
  ]),
  [],
);

// The most-used spelling wins and is offered first as the merge target.
const [variantGroup] = findTagVariantGroups([
  { tag: "slow-burn", count: 2 },
  { tag: "Slow Burn", count: 9 },
  { tag: "slowburn", count: 5 },
]);
assert.deepEqual(
  variantGroup.map((entry) => entry.tag),
  ["Slow Burn", "slowburn", "slow-burn"],
);

// A merge group applied through the tag rules leaves exactly the winning spelling behind.
assert.deepEqual(applyBulkCharacterTags(["slowburn", "fantasy"], ["Slow Burn"], ["slowburn"]), [
  "fantasy",
  "Slow Burn",
]);

console.log("character-bulk-edit regression passed");
