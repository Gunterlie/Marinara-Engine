// ──────────────────────────────────────────────
// Character library card model
// ──────────────────────────────────────────────
// The normalized shape both character surfaces agree on: the sidebar panel
// (CharactersPanel) and the full library (CharacterLibraryView). Both used to build this
// shape ad hoc, which is how their sort and tag-filter behaviour drifted apart.
//
// Personas keep their own converters in CharacterLibraryView — only the library renders
// them, so there is nothing to share yet.

import type { CharacterData } from "@marinara-engine/shared";

import { formatCardLibraryMeta, getCardLibrarySummary } from "./card-library-search";
import { getCharacterTitle } from "./character-display";
import { estimateCharacterCardTokens } from "./character-token-count";
import type { AvatarCropValue } from "./utils";

export type CharacterRow = {
  id: string;
  data: string;
  comment?: string | null;
  avatarPath: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ParsedCharacterRow = CharacterRow & {
  parsed: Partial<CharacterData> & {
    extensions?: Record<string, unknown>;
  };
};

export type LibrarySection = { title: string; content: string };

/** Trimmed card text handed to the AI summariser. Empty for personas, which it does not cover. */
export type LibraryCardSummarySource = {
  id: string;
  name: string;
  description: string;
  personality: string;
  scenario: string;
  tags: string[];
};

export type LibraryCard = {
  id: string;
  name: string;
  title: string | null;
  meta: string | null;
  summary: string;
  avatarPath: string | null;
  avatarCrop?: AvatarCropValue;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  tokenEstimate: number;
  favorite: boolean;
  active: boolean;
  creatorNotes: string;
  sections: LibrarySection[];
  /** True when `summary` came from a saved `extensions.marinaraSummary` rather than being derived. */
  hasStoredSummary: boolean;
  summarySource: LibraryCardSummarySource;
};

export function getText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function parseCharacterRow(char: CharacterRow): ParsedCharacterRow {
  try {
    const parsed = typeof char.data === "string" ? JSON.parse(char.data) : char.data;
    return { ...char, parsed: (parsed as ParsedCharacterRow["parsed"]) ?? {} };
  } catch {
    return { ...char, parsed: { name: "Unknown", description: "" } };
  }
}

export function getCharacterTags(char: ParsedCharacterRow): string[] {
  return (Array.isArray(char.parsed.tags) ? char.parsed.tags : []).filter(
    (tag): tag is string => typeof tag === "string" && tag.trim().length > 0,
  );
}

export function getCharacterSummary(char: ParsedCharacterRow): string {
  return getCardLibrarySummary([char.parsed.creator_notes, char.parsed.description, char.parsed.personality]);
}

export function getCharacterSections(char: ParsedCharacterRow): LibrarySection[] {
  return [
    { title: "Description", content: getText(char.parsed.description) },
    { title: "Personality", content: getText(char.parsed.personality) },
    { title: "Scenario", content: getText(char.parsed.scenario) },
    { title: "Opening Message", content: getText(char.parsed.first_mes) },
  ].filter((section) => section.content);
}

/**
 * Sidebar-flavoured subtitle. Unlike `formatCardLibraryMeta` this also surfaces the import
 * spec recorded on `extensions.importMetadata`, and falls back to the first few tags so a
 * card imported without creator details still says something useful.
 */
export function getCharacterPreviewMetadata(char: ParsedCharacterRow): string | null {
  const parts: string[] = [];
  const creator = getText(char.parsed.creator);
  const version = getText(char.parsed.character_version);
  const importMetadata =
    char.parsed.extensions?.importMetadata && typeof char.parsed.extensions.importMetadata === "object"
      ? (char.parsed.extensions.importMetadata as Record<string, unknown>)
      : {};
  const cardMetadata =
    importMetadata.card && typeof importMetadata.card === "object"
      ? (importMetadata.card as Record<string, unknown>)
      : {};
  const spec = getText(cardMetadata.spec);
  const specVersion = getText(cardMetadata.specVersion);
  const tags = getCharacterTags(char);

  if (creator) parts.push(`by ${creator}`);
  if (version) parts.push(`v${version}`);
  if (spec) parts.push(spec);
  if (specVersion) parts.push(`spec ${specVersion}`);
  if (parts.length > 0) return parts.join(", ");
  if (tags.length > 0) return tags.slice(0, 3).join(", ");
  return null;
}

export function toCharacterLibraryCard(char: ParsedCharacterRow): LibraryCard {
  const name = getText(char.parsed.name) || "Unnamed";
  const tags = getCharacterTags(char);
  const storedSummary = getText(char.parsed.extensions?.marinaraSummary);
  return {
    id: char.id,
    name,
    title: getCharacterTitle({ name, comment: char.comment }),
    meta: formatCardLibraryMeta(char.parsed.creator, char.parsed.character_version),
    summary: storedSummary || getCharacterSummary(char),
    hasStoredSummary: !!storedSummary,
    summarySource: {
      id: char.id,
      name,
      description: getText(char.parsed.description),
      personality: getText(char.parsed.personality),
      scenario: getText(char.parsed.scenario),
      tags,
    },
    avatarPath: char.avatarPath,
    avatarCrop: char.parsed.extensions?.avatarCrop as AvatarCropValue | undefined,
    createdAt: char.createdAt,
    updatedAt: char.updatedAt,
    tags,
    tokenEstimate: estimateCharacterCardTokens(char.parsed),
    favorite: !!char.parsed.extensions?.fav,
    active: false,
    creatorNotes: getText(char.parsed.creator_notes),
    sections: getCharacterSections(char),
  };
}

// ──────────────────────────────────────────────
// Groups
// ──────────────────────────────────────────────
// `character_groups` rows serve double duty: the sidebar renders them as folders, and the
// chat/game setup wizards offer them as party presets. Same table, one concept.

export type CharacterGroupRow = {
  id: string;
  name: string;
  description: string;
  characterIds: string;
  avatarPath: string | null;
};

export type ParsedCharacterGroup = CharacterGroupRow & { memberIds: string[] };

export function parseCharacterGroups(rows: readonly unknown[] | undefined | null): ParsedCharacterGroup[] {
  if (!rows) return [];
  return (rows as CharacterGroupRow[]).map((group) => {
    let memberIds: string[] = [];
    try {
      const parsed = JSON.parse(group.characterIds);
      if (Array.isArray(parsed)) memberIds = parsed.filter((id): id is string => typeof id === "string");
    } catch {
      memberIds = [];
    }
    return { ...group, memberIds };
  });
}

/** Every character id that belongs to at least one group. The complement is the root level. */
export function collectGroupedCharacterIds(groups: readonly ParsedCharacterGroup[]): Set<string> {
  const ids = new Set<string>();
  for (const group of groups) for (const id of group.memberIds) ids.add(id);
  return ids;
}

/**
 * Membership is exclusive: a character lives in one group or at the root. Returns only the
 * groups whose member list actually changes, so a normal move issues two PATCHes rather than
 * one per group. `targetGroupId: null` moves to the root.
 */
export function computeGroupMembershipUpdates(
  groups: readonly ParsedCharacterGroup[],
  charIds: readonly string[],
  targetGroupId: string | null,
): Array<{ id: string; characterIds: string[] }> {
  const moving = new Set(charIds);
  if (moving.size === 0) return [];

  const updates: Array<{ id: string; characterIds: string[] }> = [];
  for (const group of groups) {
    const without = group.memberIds.filter((id) => !moving.has(id));
    const next =
      group.id === targetGroupId ? [...without, ...charIds.filter((id) => !without.includes(id))] : without;
    const unchanged = next.length === group.memberIds.length && next.every((id, i) => id === group.memberIds[i]);
    if (!unchanged) updates.push({ id: group.id, characterIds: next });
  }
  return updates;
}
