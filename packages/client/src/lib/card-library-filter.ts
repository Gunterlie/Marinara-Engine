// ──────────────────────────────────────────────
// Card library filter + sort pipeline
// ──────────────────────────────────────────────
// One filter/sort implementation for both character surfaces. Previously each rolled its own
// and they disagreed: the sidebar weighted tag-match count when sorting and the full library
// did not, and the two disagree on whether multiple included tags AND or OR together.
//
// The AND/OR split is preserved deliberately via `tagMatch` rather than silently unified —
// changing either surface's filtering out from under users is not a refactor.

import { normalizeTextForMatch } from "@marinara-engine/shared";

import {
  matchesCardLibrarySearch,
  parseCardLibrarySearchQuery,
  withCardLibraryTagFilters,
} from "./card-library-search";
import type { LibraryCard } from "./character-library-card";

export type CardLibraryFavoriteFilter = "all" | "favorites" | "non-favorites";

/** `all` narrows to cards carrying every chosen tag; `any` widens to cards carrying at least one. */
export type CardLibraryTagMatch = "all" | "any";

export type CardLibraryFilters = {
  search: string;
  includedTags: readonly string[];
  excludedTags: readonly string[];
  untaggedOnly?: boolean;
  /** Applied client-side only. Characters filter favorites server-side; personas do not. */
  favorite?: CardLibraryFavoriteFilter;
  tagMatch?: CardLibraryTagMatch;
};

export type CardLibrarySort = "name-asc" | "name-desc" | "newest" | "oldest" | "favorites" | "default";

function toKeys(tags: readonly string[]): string[] {
  return tags.map((tag) => normalizeTextForMatch(tag)).filter(Boolean);
}

function countTagMatches(card: LibraryCard, includedKeys: readonly string[]): number {
  if (includedKeys.length === 0) return 0;
  const cardTags = new Set(card.tags.map((tag) => normalizeTextForMatch(tag)));
  return includedKeys.filter((key) => cardTags.has(key)).length;
}

export function filterLibraryCards(
  cards: readonly LibraryCard[],
  filters: CardLibraryFilters,
): LibraryCard[] {
  const { untaggedOnly, favorite = "all", tagMatch = "all" } = filters;
  const includedKeys = toKeys(filters.includedTags);

  // In `any` mode the include set is applied here and withheld from the parsed query, because
  // matchesCardLibrarySearch ANDs whatever it is given.
  const query =
    tagMatch === "any"
      ? withCardLibraryTagFilters(parseCardLibrarySearchQuery(filters.search), [], filters.excludedTags)
      : withCardLibraryTagFilters(
          parseCardLibrarySearchQuery(filters.search),
          filters.includedTags,
          filters.excludedTags,
        );

  return cards.filter((card) => {
    if (untaggedOnly && card.tags.length > 0) return false;
    if (favorite !== "all" && card.favorite !== (favorite === "favorites")) return false;
    if (tagMatch === "any" && includedKeys.length > 0 && countTagMatches(card, includedKeys) === 0) return false;
    return matchesCardLibrarySearch(card, query);
  });
}

/**
 * Cards matching more of the chosen tags float up within the chosen sort. Sorting is stable
 * on a copy — the input array is never mutated.
 */
export function sortLibraryCards(
  cards: readonly LibraryCard[],
  sort: CardLibrarySort,
  includedTags: readonly string[] = [],
): LibraryCard[] {
  const list = [...cards];
  const includedKeys = toKeys(includedTags);
  const byTagMatch =
    includedKeys.length > 0
      ? (left: LibraryCard, right: LibraryCard) =>
          countTagMatches(right, includedKeys) - countTagMatches(left, includedKeys)
      : null;

  const byName = (left: LibraryCard, right: LibraryCard) => left.name.localeCompare(right.name);
  const withTagMatch =
    (next: (left: LibraryCard, right: LibraryCard) => number) => (left: LibraryCard, right: LibraryCard) => {
      if (byTagMatch) {
        const diff = byTagMatch(left, right);
        if (diff !== 0) return diff;
      }
      return next(left, right);
    };

  switch (sort) {
    case "name-asc":
      return list.sort(withTagMatch(byName));
    case "name-desc":
      return list.sort(withTagMatch((left, right) => right.name.localeCompare(left.name)));
    case "newest":
      return list.sort(withTagMatch((left, right) => (right.createdAt ?? "").localeCompare(left.createdAt ?? "")));
    case "oldest":
      return list.sort(withTagMatch((left, right) => (left.createdAt ?? "").localeCompare(right.createdAt ?? "")));
    case "favorites":
      return list.sort((left, right) => {
        const favDiff = Number(right.favorite) - Number(left.favorite);
        if (favDiff !== 0) return favDiff;
        return withTagMatch(byName)(left, right);
      });
    default:
      return byTagMatch ? list.sort(withTagMatch(byName)) : list;
  }
}

export function collectLibraryTags(cards: readonly LibraryCard[]): string[] {
  const tagSet = new Set<string>();
  for (const card of cards) for (const tag of card.tags) tagSet.add(tag);
  return [...tagSet].sort((left, right) => left.localeCompare(right));
}

export function getLibraryTagState(
  tag: string,
  included: readonly string[],
  excluded: readonly string[],
): "off" | "included" | "excluded" {
  const key = normalizeTextForMatch(tag);
  if (included.some((entry) => normalizeTextForMatch(entry) === key)) return "included";
  if (excluded.some((entry) => normalizeTextForMatch(entry) === key)) return "excluded";
  return "off";
}

/** Clicking a tag toggles it into the filter; alt/right-click toggles it as an exclusion. */
export function toggleLibraryTagFilter(
  tag: string,
  exclude: boolean,
  included: readonly string[],
  excluded: readonly string[],
): { included: string[]; excluded: string[] } {
  const key = normalizeTextForMatch(tag);
  const drop = (list: readonly string[]) => list.filter((entry) => normalizeTextForMatch(entry) !== key);
  const target = exclude ? excluded : included;
  const alreadyOn = target.some((entry) => normalizeTextForMatch(entry) === key);
  const nextTarget = alreadyOn ? drop(target) : [...drop(target), tag];
  const nextOther = alreadyOn ? [...(exclude ? included : excluded)] : drop(exclude ? included : excluded);
  return exclude
    ? { included: nextOther, excluded: nextTarget }
    : { included: nextTarget, excluded: nextOther };
}
