/**
 * Applies a bulk tag add/remove to one card's tag list.
 *
 * Removals win over additions and both compare case-insensitively, so a bulk edit that adds
 * "Villain" to a card already tagged "villain" leaves the original casing alone instead of
 * producing a duplicate the library would then render twice.
 */
export function applyBulkCharacterTags(currentTags: string[], addTags: string[], removeTags: string[]): string[] {
  const removed = new Set(removeTags.map((tag) => tag.toLowerCase()));
  const next = currentTags.filter((tag) => !removed.has(tag.toLowerCase()));
  const seen = new Set(next.map((tag) => tag.toLowerCase()));
  for (const tag of addTags) {
    const key = tag.toLowerCase();
    if (seen.has(key) || removed.has(key)) continue;
    seen.add(key);
    next.push(tag);
  }
  return next;
}
