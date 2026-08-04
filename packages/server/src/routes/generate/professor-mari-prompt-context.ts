import { PROFESSOR_MARI_ID, estimateCharacterCardTokens, getCardHealthIssues } from "@marinara-engine/shared";

import { MARI_ASSISTANT_PROMPT } from "../../db/seed-mari.js";

type ProfessorMariCharactersStore = {
  list(): Promise<Array<{ id?: string | null; data?: unknown; avatarPath?: unknown }>>;
  listPersonas(): Promise<Array<{ name?: unknown }>>;
};

/**
 * Above this many characters the per-card digest is dropped for a plain name list. A large
 * library would otherwise spend most of the context window describing itself.
 */
const MAX_DIGESTED_CHARACTERS = 200;

/**
 * One line per card: name, tags, rough size, and any completeness gaps. Mari already has
 * `update_character` (tags, favourite, every text field), so seeing this is the whole
 * difference between her guessing and her actually curating the library.
 */
function describeCharacter(data: Record<string, any>, hasAvatar: boolean): string {
  const name = typeof data?.name === "string" ? data.name : "";
  if (!name) return "";
  const tags = Array.isArray(data.tags) ? data.tags.filter((tag: unknown) => typeof tag === "string") : [];
  const tokens = estimateCharacterCardTokens(data);
  const issues = getCardHealthIssues(data, { hasAvatar, tokenEstimate: tokens });
  const parts = [name, `[${tags.length > 0 ? tags.join(", ") : "untagged"}]`, `~${tokens}t`];
  if (issues.length > 0) parts.push(`needs: ${issues.join(", ")}`);
  return parts.join(" ");
}

type NamedListStore = {
  list(): Promise<unknown[]>;
};

function namedValue(row: unknown): string | null {
  if (!row || typeof row !== "object") return null;
  const name = (row as { name?: unknown }).name;
  return typeof name === "string" && name.trim().length > 0 ? name : null;
}

export async function resolveProfessorMariPromptContext(args: {
  chatMeta: Record<string, unknown>;
  chars: ProfessorMariCharactersStore;
  lorebooksStore: NamedListStore;
  chats: NamedListStore;
  presets: NamedListStore;
}): Promise<string> {
  const sections = [MARI_ASSISTANT_PROMPT];

  try {
    const allChars = await args.chars.list();
    const allPersonasList = await args.chars.listPersonas();
    const allLorebooks = await args.lorebooksStore.list();
    const allChats = await args.chats.list();
    const allPresets = await args.presets.list();

    const libraryCharacters = allChars.filter((c) => c.id !== PROFESSOR_MARI_ID);
    const digestLibrary = libraryCharacters.length <= MAX_DIGESTED_CHARACTERS;
    const charNames = libraryCharacters
      .map((c) => {
        try {
          const d = typeof c.data === "string" ? JSON.parse(c.data) : c.data;
          if (!digestLibrary) return d?.name;
          return describeCharacter(d ?? {}, typeof c.avatarPath === "string" && c.avatarPath.length > 0) || d?.name;
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    const personaNames = allPersonasList.map((p) => p.name).filter(Boolean);
    const lorebookNames = allLorebooks.map(namedValue).filter(Boolean);
    const chatNames = allChats
      .slice(0, 50)
      .map(namedValue)
      .filter(Boolean);
    const presetNames = allPresets.map(namedValue).filter(Boolean);

    const namesSections: string[] = [];
    if (charNames.length > 0) {
      // Digest lines carry commas of their own, so they go one per line rather than inline.
      namesSections.push(
        digestLibrary
          ? `<available_names type="character" format="name [tags] ~tokens needs: gaps">\n${charNames.join("\n")}\n</available_names>`
          : `<available_names type="character">\n${charNames.join(", ")}\n</available_names>`,
      );
    }
    if (personaNames.length > 0) {
      namesSections.push(`<available_names type="persona">\n${personaNames.join(", ")}\n</available_names>`);
    }
    if (lorebookNames.length > 0) {
      namesSections.push(`<available_names type="lorebook">\n${lorebookNames.join(", ")}\n</available_names>`);
    }
    if (chatNames.length > 0) {
      namesSections.push(`<available_names type="chat">\n${chatNames.join(", ")}\n</available_names>`);
    }
    if (presetNames.length > 0) {
      namesSections.push(`<available_names type="preset">\n${presetNames.join(", ")}\n</available_names>`);
    }

    if (namesSections.length > 0) sections.push(namesSections.join("\n\n"));
  } catch {
    // Non-critical: continue without name lists.
  }

  const mariContext = args.chatMeta.mariContext as Record<string, string> | undefined;
  if (mariContext && Object.keys(mariContext).length > 0) {
    const contextSections: string[] = [];
    for (const [key, value] of Object.entries(mariContext)) {
      contextSections.push(`<fetched_data key="${key}">\n${value}\n</fetched_data>`);
    }
    sections.push(
      "<loaded_context>\nThe following items were previously fetched and are available for reference:\n\n" +
        contextSections.join("\n\n") +
        "\n</loaded_context>",
    );
  }

  return sections.join("\n\n");
}
