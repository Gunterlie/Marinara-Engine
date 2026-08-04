// ──────────────────────────────────────────────
// Character card token estimate + health
// ──────────────────────────────────────────────
// Lives in shared because three consumers need it: the client library (badges, filters),
// the sidebar panel, and Professor Mari's prompt context, which summarises the library so
// she can answer "which cards need work?" without being handed every card in full.

import type { CharacterBook, CharacterBookEntry, CharacterData, DepthPrompt } from "../types/character.js";

const CHARS_PER_TOKEN = 4;

export type CharacterTokenData = Partial<
  Omit<CharacterData, "alternate_greetings" | "character_book" | "extensions">
> & {
  alternate_greetings?: unknown;
  character_book?: unknown;
  extensions?: unknown;
};

const CARD_TEXT_FIELDS: Array<keyof CharacterData> = [
  "name",
  "description",
  "personality",
  "scenario",
  "first_mes",
  "mes_example",
  "creator_notes",
  "system_prompt",
  "post_history_instructions",
];

export function estimateTextTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function collectString(value: unknown, output: string[]) {
  const text = asString(value);
  if (text) output.push(text);
}

function collectStringArray(value: unknown, output: string[]) {
  if (!Array.isArray(value)) return;
  for (const item of value) collectString(item, output);
}

function collectDepthPrompt(value: unknown, output: string[]) {
  const depthPrompt = asRecord(value) as Partial<DepthPrompt>;
  collectString(depthPrompt.prompt, output);
}

function collectCharacterBookEntry(entry: Partial<CharacterBookEntry>, output: string[]) {
  collectString(entry.name, output);
  collectString(entry.comment, output);
  collectString(entry.content, output);
  collectStringArray(entry.keys, output);
  collectStringArray(entry.secondary_keys, output);
}

function collectCharacterBook(value: unknown, output: string[]) {
  const book = asRecord(value) as Partial<CharacterBook>;
  collectString(book.name, output);
  collectString(book.description, output);

  if (!Array.isArray(book.entries)) return;
  for (const entry of book.entries) {
    collectCharacterBookEntry(asRecord(entry) as Partial<CharacterBookEntry>, output);
  }
}

/**
 * Rough card size. A flat 4-chars-per-token heuristic, matching what the server already
 * assumes elsewhere — good for relative sizing, off by 10-30% against a real BPE tokenizer.
 */
export function estimateCharacterCardTokens(data: CharacterTokenData): number {
  const textParts: string[] = [];

  for (const field of CARD_TEXT_FIELDS) {
    collectString(data[field], textParts);
  }

  collectStringArray(data.alternate_greetings, textParts);

  const extensions = asRecord(data.extensions);
  collectString(extensions.backstory, textParts);
  collectString(extensions.appearance, textParts);
  collectString(extensions.world, textParts);
  collectDepthPrompt(extensions.depth_prompt, textParts);

  collectCharacterBook(data.character_book, textParts);

  return estimateTextTokens(textParts.join("\n"));
}

export function formatEstimatedTokens(tokens: number): string {
  return `~${tokens.toLocaleString()} tokens`;
}

// ──────────────────────────────────────────────
// Health
// ──────────────────────────────────────────────

export type CardHealthIssue =
  | "no-first-mes"
  | "no-greetings"
  | "no-avatar"
  | "no-tags"
  | "no-examples"
  | "token-bloat";

// ponytail: flat threshold. Make it a setting if people with deliberately large cards complain.
export const CARD_HEALTH_TOKEN_BLOAT = 2500;

/**
 * Cheap, local completeness check — no model call. `hasAvatar` is passed in because the
 * avatar lives on the row rather than inside the card JSON.
 */
export function getCardHealthIssues(
  data: CharacterTokenData & { tags?: unknown },
  options: { hasAvatar: boolean; tokenEstimate?: number },
): CardHealthIssue[] {
  const issues: CardHealthIssue[] = [];
  const tags = Array.isArray(data.tags) ? data.tags.filter((tag) => asString(tag)) : [];
  const greetings = Array.isArray(data.alternate_greetings)
    ? data.alternate_greetings.filter((greeting) => asString(greeting))
    : [];

  if (!asString(data.first_mes)) issues.push("no-first-mes");
  else if (greetings.length === 0) issues.push("no-greetings");
  if (!options.hasAvatar) issues.push("no-avatar");
  if (tags.length === 0) issues.push("no-tags");
  if (!asString(data.mes_example)) issues.push("no-examples");

  const tokens = options.tokenEstimate ?? estimateCharacterCardTokens(data);
  if (tokens > CARD_HEALTH_TOKEN_BLOAT) issues.push("token-bloat");

  return issues;
}
