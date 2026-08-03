import { includesTextForMatch, normalizeTextForMatch } from "@marinara-engine/shared";

export type CardLibrarySearchQuery = {
  text: string;
  includedTags: string[];
  excludedTags: string[];
};

export type CardLibrarySearchDocument = {
  name?: unknown;
  title?: unknown;
  meta?: unknown;
  summary?: unknown;
  tags?: readonly string[];
  sections?: readonly { content?: unknown }[];
};

function getText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function parseCardLibrarySearchQuery(value: string): CardLibrarySearchQuery {
  const excludedTags: string[] = [];
  const includedTags: string[] = [];
  const text = value
    // Negative filters run first: `-tag:"x"`, `-#x` and the bare `-x` shorthand all exclude.
    .replace(/(?:^|\s)(?:-|!)(?:tag:|#)?(?:"([^"]+)"|(\S+))/gi, (_match, quoted: string, bare: string) => {
      const tag = (quoted ?? bare ?? "").trim();
      if (tag) excludedTags.push(normalizeTextForMatch(tag));
      return " ";
    })
    // Positive filters must be explicit (`tag:"x"` / `#x`) — a bare word stays free-text search,
    // otherwise every ordinary query would silently become a tag filter that matches nothing.
    .replace(/(?:^|\s)(?:tag:|#)(?:"([^"]+)"|(\S+))/gi, (_match, quoted: string, bare: string) => {
      const tag = (quoted ?? bare ?? "").trim();
      if (tag) includedTags.push(normalizeTextForMatch(tag));
      return " ";
    })
    .replace(/\s+/gu, " ")
    .trim();

  return {
    text: normalizeTextForMatch(text),
    includedTags,
    excludedTags,
  };
}

/**
 * Merges the chip-driven tag filters into a parsed query so the grid has exactly one matcher to
 * consult. Chips and typed `tag:` syntax are the same filter by the time matching happens.
 */
export function withCardLibraryTagFilters(
  query: CardLibrarySearchQuery,
  included: readonly string[],
  excluded: readonly string[],
): CardLibrarySearchQuery {
  return {
    text: query.text,
    includedTags: [...query.includedTags, ...included.map(normalizeTextForMatch)],
    excludedTags: [...query.excludedTags, ...excluded.map(normalizeTextForMatch)],
  };
}

export function formatCardLibraryMeta(creator: unknown, version: unknown): string | null {
  const parts: string[] = [];
  const creatorText = getText(creator);
  const versionText = getText(version);
  if (creatorText) parts.push(creatorText);
  if (versionText) parts.push(`v${versionText}`);
  return parts.join(" · ") || null;
}

export function getCardLibrarySummary(values: readonly unknown[]): string {
  return values.map(getText).find(Boolean) ?? "No creator notes yet.";
}

export function matchesCardLibrarySearch(
  document: CardLibrarySearchDocument,
  query: CardLibrarySearchQuery,
): boolean {
  const tags = document.tags ?? [];
  const tagSet = new Set(tags.map((tag) => normalizeTextForMatch(tag)));
  if (query.excludedTags.some((tag) => tagSet.has(tag))) return false;
  // Included tags are ANDed: picking two chips narrows to cards carrying both.
  if (query.includedTags.some((tag) => !tagSet.has(tag))) return false;
  if (!query.text) return true;

  return [
    document.name,
    document.title,
    document.meta,
    document.summary,
    ...tags,
    ...(document.sections ?? []).map((section) => section.content),
  ]
    .filter((value): value is string => typeof value === "string")
    .some((value) => includesTextForMatch(value, query.text));
}
