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

export type TagUsage = { tag: string; count: number };

/**
 * Collapses the spelling differences people actually produce when typing the same tag twice:
 * case, surrounding and inner whitespace, and the hyphen/underscore/space split in multi-word
 * tags. Deliberately not a fuzzy match — "vampire" and "vampires" are left as distinct tags,
 * because silently offering to merge genuinely different tags is worse than missing one.
 */
export function normalizeTagKey(tag: string): string {
  return tag.toLowerCase().replace(/[\s_-]+/g, "");
}

/**
 * Groups tags that normalize to the same key, so the tag manager can offer a one-click merge.
 * Only groups with more than one spelling are returned, each ordered most-used first — the
 * winner is the spelling the library already uses most, which is the sane merge target.
 */
export function findTagVariantGroups(usage: TagUsage[]): TagUsage[][] {
  const groups = new Map<string, TagUsage[]>();
  for (const entry of usage) {
    const key = normalizeTagKey(entry.tag);
    if (!key) continue;
    const group = groups.get(key);
    if (group) group.push(entry);
    else groups.set(key, [entry]);
  }

  return [...groups.values()]
    .filter((group) => group.length > 1)
    .map((group) => [...group].sort((left, right) => right.count - left.count || left.tag.localeCompare(right.tag)))
    .sort((left, right) => right.length - left.length || (left[0]?.tag ?? "").localeCompare(right[0]?.tag ?? ""));
}
