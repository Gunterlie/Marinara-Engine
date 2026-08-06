import assert from "node:assert/strict";
import {
  formatSkillCheckResultSummary,
  serializeResolvedSkillCheckTag,
  skillCheckDiceSumToTotal,
  type SkillCheckResult,
} from "../../packages/shared/dist/index.js";
import { resolveSkillCheck } from "../../packages/server/src/services/game/skill-check.service.js";

// The dice card may only claim "a + b = total" when that is literally true.
// Regression source: a d20-sum layout rendered a Vampire (V20) pool as
// "4 + 1 + 9 + 4 + 2 + 8 = 1", making a correct success count look like broken
// arithmetic, and labelling ten-sided dice as d20.

const base: SkillCheckResult = {
  skill: "Larceny",
  dc: 6,
  rolls: [12],
  usedRoll: 12,
  modifier: 3,
  total: 15,
  success: true,
  criticalSuccess: false,
  criticalFailure: false,
  rollMode: "normal",
  dice: "1d20",
};

// Plain d20 check: the dice do add up, so the addition is honest.
assert.equal(skillCheckDiceSumToTotal(base), true);
assert.match(formatSkillCheckResultSummary(base), / = 15\./);

// Advantage discards a die, so the remaining dice do not sum to the total.
const advantage: SkillCheckResult = {
  ...base,
  rolls: [3, 19],
  usedRoll: 19,
  total: 22,
  rollMode: "advantage",
  dice: "2d20",
};
assert.equal(skillCheckDiceSumToTotal(advantage), false, "3 + 19 + 3 is 25, not the total of 22");
assert.doesNotMatch(formatSkillCheckResultSummary(advantage), /= 22\./, "must not assert a false sum");
assert.match(formatSkillCheckResultSummary(advantage), /→ 22\./);

// Pool system: six ten-sided dice, one success. Never an addition.
const pool: SkillCheckResult = {
  ...base,
  rolls: [4, 1, 9, 4, 2, 8],
  usedRoll: 1,
  modifier: 0,
  total: 1,
  dice: "6d10",
};
assert.equal(skillCheckDiceSumToTotal(pool), false);
assert.doesNotMatch(formatSkillCheckResultSummary(pool), /= 1\./);
// The declared dice survive serialization, so the card can draw d10s.
assert.match(serializeResolvedSkillCheckTag(pool), /dice="6d10"/);

// The built-in resolver always labels the dice it actually threw.
const normal = resolveSkillCheck({ skill: "Stealth", dc: 10, skillModifier: 2, attributeModifier: 1 });
assert.equal(normal.dice, "1d20");
assert.equal(normal.rolls.length, 1);
assert.equal(normal.total, normal.usedRoll + 3);
assert.equal(skillCheckDiceSumToTotal(normal), true);

const withAdvantage = resolveSkillCheck({
  skill: "Stealth",
  dc: 10,
  skillModifier: 0,
  attributeModifier: 0,
  advantage: true,
});
assert.equal(withAdvantage.dice, "2d20", "advantage throws two dice and must say so");
assert.equal(withAdvantage.usedRoll, Math.max(...withAdvantage.rolls));

// A pre-rolled d20 still gets modifiers applied on top, and still adds up.
const preRolled = resolveSkillCheck({
  skill: "Athletics",
  dc: 12,
  skillModifier: 2,
  attributeModifier: 2,
  preRolledD20: 11,
});
assert.equal(preRolled.usedRoll, 11);
assert.equal(preRolled.total, 15);
assert.equal(preRolled.success, true);
assert.equal(skillCheckDiceSumToTotal(preRolled), true);

process.stdout.write("Dice display regression passed.\n");
