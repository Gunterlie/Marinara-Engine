import assert from "node:assert/strict";
import { applyBulkCharacterTags } from "../../packages/shared/src/utils/character-bulk-tags.js";

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

console.log("character-bulk-edit regression passed");
