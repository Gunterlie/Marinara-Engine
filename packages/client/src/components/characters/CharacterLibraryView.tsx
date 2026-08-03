import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type UIEvent,
} from "react";
import {
  ArrowLeft,
  ArrowUpDown,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Hash,
  LayoutGrid,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Rows3,
  Search,
  Star,
  StarOff,
  Tag,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { type CharacterData } from "@marinara-engine/shared";
import { useTranslation, useTranslation as useUiTranslation } from "react-i18next";
import {
  flattenCharacterPages,
  flattenPersonaPages,
  useBulkUpdateCharacters,
  useCharacterPages,
  useDeleteCharacter,
  useDeletePersona,
  usePersonaPages,
} from "../../hooks/use-characters";
import { api } from "../../lib/api-client";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { SelectionActionBar } from "../ui/SelectionActionBar";
import { ActionDropdown } from "../game-assets/ActionDropdown";
import { CharacterBulkEditModal, type BulkSummarySource } from "./CharacterBulkEditModal";
import { CharacterTagManagerModal } from "./CharacterTagManagerModal";
import { getCharacterTitle } from "../../lib/character-display";
import {
  formatCardLibraryMeta,
  getCardLibrarySummary,
  matchesCardLibrarySearch,
  parseCardLibrarySearchQuery,
  withCardLibraryTagFilters,
} from "../../lib/card-library-search";
import { estimateCharacterCardTokens, formatEstimatedTokens } from "../../lib/character-token-count";
import { applyInlineMarkdown, renderMarkdownBlocks } from "../../lib/markdown";
import { cn, getAvatarCropStyle, parseAvatarCropJson, type AvatarCropValue } from "../../lib/utils";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import {
  useUIStore,
  type CardLibraryKind,
  type CharacterLibrarySort,
  type ResourcePanelSort,
} from "../../stores/ui.store";

const libraryToolbarButtonClass =
  "mari-chrome-control mari-chrome-control--primary h-10 min-h-10 min-w-0 px-3 text-[0.75rem]";
const libraryToolbarFieldClass = "mari-chrome-field h-10 w-full text-[0.75rem] md:h-9";

type LibraryDensity = "compact" | "comfortable" | "cover";

/**
 * Grid shape per density. `cover` drops the text body entirely and overlays the name on the
 * avatar, which is what a browsing pass through a large character library actually wants.
 */
const DENSITY_CONFIG: Record<LibraryDensity, { label: string; grid: string; summaryLines: number }> = {
  compact: {
    label: "Compact",
    grid: "grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6",
    summaryLines: 0,
  },
  comfortable: {
    label: "Comfortable",
    grid: "grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4",
    summaryLines: 3,
  },
  cover: {
    label: "Cover",
    grid: "grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6",
    summaryLines: 0,
  },
};

const DENSITY_ORDER: LibraryDensity[] = ["compact", "comfortable", "cover"];

/** Tag chip shared by the grid cards, the table rows and the active-filter row. */
function TagChip({
  tag,
  state,
  onToggle,
  className,
}: {
  tag: string;
  state: "off" | "included" | "excluded";
  onToggle: (tag: string, exclude: boolean) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onToggle(tag, event.altKey);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggle(tag, true);
      }}
      title={`Filter by "${tag}" — alt-click or right-click to exclude`}
      className={cn(
        "max-w-[10rem] truncate rounded-full px-1.5 py-0.5 text-[0.5625rem] font-medium transition-colors sm:px-2 sm:py-1 sm:text-[0.625rem]",
        state === "included"
          ? "mari-chrome-accent-surface"
          : state === "excluded"
            ? "bg-[var(--marinara-chat-chrome-button-bg)] text-[var(--marinara-chat-chrome-panel-muted)] line-through"
            : "bg-[var(--marinara-chat-chrome-highlight-bg)] text-[var(--marinara-chat-chrome-panel-text)] hover:bg-[var(--marinara-chat-chrome-button-bg)]",
        className,
      )}
    >
      {tag}
    </button>
  );
}

type CharacterRow = {
  id: string;
  data: string;
  comment?: string | null;
  avatarPath: string | null;
  createdAt: string;
  updatedAt: string;
};

type ParsedCharacterRow = CharacterRow & {
  parsed: Partial<CharacterData> & {
    extensions?: Record<string, unknown>;
  };
};

type PersonaRow = {
  id: string;
  name: string;
  comment?: string | null;
  creator?: string | null;
  personaVersion?: string | null;
  creatorNotes?: string | null;
  description?: string | null;
  personality?: string | null;
  scenario?: string | null;
  backstory?: string | null;
  appearance?: string | null;
  avatarPath: string | null;
  avatarCrop?: string | AvatarCropValue | null;
  isActive?: boolean | string;
  tags?: string | string[] | null;
  createdAt: string;
  updatedAt: string;
};

type LibrarySection = { title: string; content: string };

type LibraryCard = {
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
  /** Trimmed card text handed to the AI summariser. Empty for personas, which it does not cover. */
  summarySource: BulkSummarySource;
};

type LibraryCopy = {
  singular: "character" | "persona";
  plural: "characters" | "personas";
  title: "Character Library" | "Persona Library";
  heading: string;
};

const LIBRARY_COPY: Record<CardLibraryKind, LibraryCopy> = {
  characters: {
    singular: "character",
    plural: "characters",
    title: "Character Library",
    heading: "Browse your characters",
  },
  personas: {
    singular: "persona",
    plural: "personas",
    title: "Persona Library",
    heading: "Browse your personas",
  },
};

function parseCharacterRow(char: CharacterRow): ParsedCharacterRow {
  try {
    const parsed = typeof char.data === "string" ? JSON.parse(char.data) : char.data;
    return { ...char, parsed: (parsed as ParsedCharacterRow["parsed"]) ?? {} };
  } catch {
    return { ...char, parsed: { name: "Unknown", description: "" } };
  }
}

function getText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getCharacterTags(char: ParsedCharacterRow): string[] {
  return (Array.isArray(char.parsed.tags) ? char.parsed.tags : []).filter(
    (tag): tag is string => typeof tag === "string" && tag.trim().length > 0,
  );
}

function getPersonaTags(persona: PersonaRow): string[] {
  if (Array.isArray(persona.tags)) {
    return persona.tags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0);
  }
  if (!persona.tags) return [];
  try {
    const parsed = JSON.parse(persona.tags);
    return Array.isArray(parsed)
      ? parsed.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

function getCharacterSummary(char: ParsedCharacterRow) {
  return getCardLibrarySummary([char.parsed.creator_notes, char.parsed.description, char.parsed.personality]);
}

function getPersonaSummary(persona: PersonaRow) {
  return getCardLibrarySummary([persona.creatorNotes, persona.description, persona.personality, persona.backstory]);
}

function truncateText(content: string, maxLength: number) {
  if (content.length <= maxLength) return content;
  return `${content.slice(0, maxLength - 3).trimEnd()}...`;
}

function getCharacterSections(char: ParsedCharacterRow): LibrarySection[] {
  return [
    { title: "Description", content: getText(char.parsed.description) },
    { title: "Personality", content: getText(char.parsed.personality) },
    { title: "Scenario", content: getText(char.parsed.scenario) },
    { title: "Opening Message", content: getText(char.parsed.first_mes) },
  ].filter((section) => section.content);
}

function getPersonaSections(persona: PersonaRow): LibrarySection[] {
  return [
    { title: "Description", content: getText(persona.description) },
    { title: "Personality", content: getText(persona.personality) },
    { title: "Scenario", content: getText(persona.scenario) },
    { title: "Backstory", content: getText(persona.backstory) },
    { title: "Appearance", content: getText(persona.appearance) },
  ].filter((section) => section.content);
}

function estimatePersonaTokens(persona: PersonaRow) {
  return Math.ceil(
    [persona.description, persona.personality, persona.scenario, persona.backstory, persona.appearance]
      .map(getText)
      .join("").length / 4,
  );
}

function parsePersonaAvatarCrop(value: PersonaRow["avatarCrop"]): AvatarCropValue | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return parseAvatarCropJson(value) ?? undefined;
  return value;
}

function toCharacterLibraryCard(char: ParsedCharacterRow): LibraryCard {
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

function toPersonaLibraryCard(persona: PersonaRow): LibraryCard {
  return {
    id: persona.id,
    name: getText(persona.name) || "Unnamed",
    title: getText(persona.comment) || null,
    meta: formatCardLibraryMeta(persona.creator, persona.personaVersion),
    summary: getPersonaSummary(persona),
    avatarPath: persona.avatarPath,
    avatarCrop: parsePersonaAvatarCrop(persona.avatarCrop),
    createdAt: persona.createdAt,
    updatedAt: persona.updatedAt,
    tags: getPersonaTags(persona),
    tokenEstimate: estimatePersonaTokens(persona),
    favorite: false,
    active: persona.isActive === true || persona.isActive === "true",
    creatorNotes: getText(persona.creatorNotes),
    sections: getPersonaSections(persona),
    // Personas are not part of the character bulk-edit endpoint, so they never carry a stored summary.
    hasStoredSummary: false,
    summarySource: { id: persona.id, name: getText(persona.name), description: "", personality: "", scenario: "", tags: [] },
  };
}

function CardLibraryDetailCard({
  card,
  kind,
  onEdit,
  onChat,
  onToggleFavorite,
  onToggleTag,
  tagState,
  position,
  onStep,
}: {
  card: LibraryCard;
  kind: CardLibraryKind;
  onEdit: (id: string) => void;
  onChat?: (card: LibraryCard) => void;
  onToggleFavorite?: (card: LibraryCard) => void;
  onToggleTag: (tag: string, exclude: boolean) => void;
  tagState: (tag: string) => "off" | "included" | "excluded";
  /** 1-based position in the current result set, used for the prev/next stepper. */
  position?: { index: number; total: number };
  onStep?: (delta: number) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const copy = LIBRARY_COPY[kind];
  const placeholderClass =
    kind === "characters" ? "mari-avatar-placeholder--character" : "mari-avatar-placeholder--persona";

  return (
    <div className="space-y-4">
      {position && onStep && position.total > 1 && (
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onStep(-1)}
            disabled={position.index <= 1}
            className="mari-chrome-control h-9 w-9 rounded-xl p-0"
            title={localizeUi("ui.characters.characterlibraryview.previous")}
            aria-label={localizeUi("ui.characters.characterlibraryview.previous")}
          >
            <ChevronLeft size="0.875rem" />
          </button>
          <span className="text-[0.6875rem] tabular-nums text-[var(--marinara-chat-chrome-panel-muted)]">
            {position.index} / {position.total}
          </span>
          <button
            type="button"
            onClick={() => onStep(1)}
            disabled={position.index >= position.total}
            className="mari-chrome-control h-9 w-9 rounded-xl p-0"
            title={localizeUi("ui.characters.characterlibraryview.next")}
            aria-label={localizeUi("ui.characters.characterlibraryview.next")}
          >
            <ChevronRight size="0.875rem" />
          </button>
        </div>
      )}
      <div className="overflow-hidden rounded-[1.5rem] border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)]/70 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.95)] sm:rounded-[2rem]">
        <div className={cn("mari-avatar-placeholder relative aspect-square overflow-hidden", placeholderClass)}>
          {card.avatarPath ? (
            <img
              src={card.avatarPath}
              alt={card.name}
              className="h-full w-full object-cover"
              style={getAvatarCropStyle(card.avatarCrop)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[var(--marinara-chat-chrome-panel-title)]">
              <User size="2.5rem" />
            </div>
          )}
        </div>

        <div className="space-y-4 p-5">
          <div>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-xl font-semibold text-[var(--marinara-chat-chrome-panel-title)] sm:text-2xl">
                  {card.name}
                </h2>
                {card.title && (
                  <p className="mt-1 truncate text-sm italic text-[var(--marinara-chat-chrome-panel-muted)]">
                    {card.title}
                  </p>
                )}
                {card.meta && (
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--marinara-chat-chrome-panel-muted)]">
                    {card.meta}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <span
                  className="mari-chrome-muted-badge gap-1 px-2.5 py-1 text-[0.6875rem]"
                  title={localizeUi(
                    "ui.characters.cardlibrarydetailcard.estimatedFromValue1CardTextFieldsActualTokenizerCounts",
                    { value1: copy.singular },
                  )}
                >
                  <Hash size="0.75rem" />
                  {formatEstimatedTokens(card.tokenEstimate)}
                </span>
                {onToggleFavorite ? (
                  <button
                    type="button"
                    onClick={() => onToggleFavorite(card)}
                    data-character-favorite-indicator={card.favorite ? "detail" : undefined}
                    aria-pressed={card.favorite}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.6875rem] font-medium transition-colors",
                      card.favorite
                        ? "mari-chrome-accent-surface mari-accent-animated"
                        : "mari-chrome-muted-badge hover:text-[var(--marinara-chat-chrome-panel-title)]",
                    )}
                  >
                    <Star size="0.75rem" className={cn(card.favorite && "fill-current")} />{" "}
                    {localizeUi("ui.characters.cardlibrarydetailcard.favorite")}
                  </button>
                ) : (
                  card.favorite && (
                    <span
                      data-character-favorite-indicator="detail"
                      className="mari-chrome-accent-surface mari-accent-animated inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.6875rem] font-medium"
                    >
                      <Star size="0.75rem" className="fill-current" />{" "}
                      {localizeUi("ui.characters.cardlibrarydetailcard.favorite")}
                    </span>
                  )
                )}
                {card.active && (
                  <span className="mari-chrome-muted-badge mari-chrome-accent-surface gap-1 px-2.5 py-1 text-[0.6875rem]">
                    <Check size="0.75rem" /> {localizeUi("ui.characters.lorebooktab.active")}
                  </span>
                )}
              </div>
            </div>

            {card.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {card.tags.map((tag) => (
                  <TagChip key={tag} tag={tag} state={tagState(tag)} onToggle={onToggleTag} />
                ))}
              </div>
            )}

            {card.creatorNotes && (
              <div className="mari-message-content mt-4 whitespace-pre-wrap rounded-[1.5rem] border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-highlight-bg)] px-4 py-3 text-sm leading-6 text-[var(--marinara-chat-chrome-panel-text)]">
                {renderMarkdownBlocks(card.creatorNotes, applyInlineMarkdown, `creator-notes-${card.id}`)}
              </div>
            )}

            <div className={cn("mt-4 gap-2", onChat ? "grid grid-cols-2" : "flex flex-wrap")}>
              <button
                onClick={() => onEdit(card.id)}
                className="mari-chrome-control mari-chrome-control--regular-label min-h-10 px-3 py-2 text-xs sm:px-4 sm:text-sm"
              >
                <Pencil size="0.875rem" />
                {localizeUi("ui.noodle.noodlepostcard.edit")}{" "}
                {copy.singular === "character"
                  ? localizeUi("ui.characters.cardlibrarydetailcard.character")
                  : localizeUi("ui.characters.cardlibrarydetailcard.persona")}
              </button>
              {onChat && (
                <button
                  type="button"
                  onClick={() => onChat(card)}
                  className="mari-chrome-control mari-chrome-control--regular-label min-h-10 px-3 py-2 text-xs sm:px-4 sm:text-sm"
                >
                  <MessageCircle size="0.875rem" />
                  {localizeUi("ui.characters.characterlibraryview.chatNow")}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {card.sections.length > 0 && (
        <div className="space-y-3">
          {card.sections.map((section) => (
            <section
              key={section.title}
              className="rounded-[1.5rem] border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)]/65 p-4"
            >
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--marinara-chat-chrome-panel-muted)]">
                {section.title}
              </h3>
              <div className="mari-message-content mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--marinara-chat-chrome-panel-text)]">
                {renderMarkdownBlocks(
                  truncateText(section.content, section.title === "Opening Message" ? 420 : 620),
                  applyInlineMarkdown,
                  `card-${card.id}-${section.title}`,
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export function CharacterLibraryView() {
  const { t: localizeUi } = useUiTranslation();
  const { t } = useTranslation();
  const localize = useLocalizedUiText();
  const kind = useUIStore((s) => s.cardLibraryKind);
  const copy = LIBRARY_COPY[kind];
  const isPersonaLibrary = kind === "personas";
  const closeLibrary = useUIStore((s) => s.closeCharacterLibrary);
  const openCharacterDetail = useUIStore((s) => s.openCharacterDetail);
  const openPersonaDetail = useUIStore((s) => s.openPersonaDetail);
  const openModal = useUIStore((s) => s.openModal);
  const characterSelectedId = useUIStore((s) => s.characterLibrarySelectedId);
  const personaSelectedId = useUIStore((s) => s.personaLibrarySelectedId);
  const setCharacterSelectedId = useUIStore((s) => s.setCharacterLibrarySelectedId);
  const setPersonaSelectedId = useUIStore((s) => s.setPersonaLibrarySelectedId);
  const characterSort = useUIStore((s) => s.characterLibrarySort);
  const personaSort = useUIStore((s) => s.personaLibrarySort);
  const setCharacterSort = useUIStore((s) => s.setCharacterLibrarySort);
  const setPersonaSort = useUIStore((s) => s.setPersonaLibrarySort);
  const setCharacterScrollTop = useUIStore((s) => s.setCharacterLibraryScrollTop);
  const setPersonaScrollTop = useUIStore((s) => s.setPersonaLibraryScrollTop);

  const selectedId = isPersonaLibrary ? personaSelectedId : characterSelectedId;
  const sort = isPersonaLibrary ? personaSort : characterSort;
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [density, setDensity] = useState<LibraryDensity>("comfortable");
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [exportingSelected, setExportingSelected] = useState(false);
  const [favoriteFilter, setFavoriteFilter] = useState<"all" | "favorites" | "non-favorites">("all");
  const [untaggedOnly, setUntaggedOnly] = useState(false);
  const [includedTags, setIncludedTags] = useState<string[]>([]);
  const [excludedTags, setExcludedTags] = useState<string[]>([]);
  const [overflowMenu, setOverflowMenu] = useState<{ x: number; y: number } | null>(null);
  const deleteCharacter = useDeleteCharacter();
  const deletePersona = useDeletePersona();
  const bulkUpdate = useBulkUpdateCharacters();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  /** Anchor for shift-click range selection — the last card the user checked on purpose. */
  const selectionAnchorRef = useRef<string | null>(null);
  const serverSearch = useMemo(() => parseCardLibrarySearchQuery(search).text, [search]);
  const serverFavoriteFilter = isPersonaLibrary || favoriteFilter === "all" ? "" : favoriteFilter;
  const characterPages = useCharacterPages({
    enabled: !isPersonaLibrary,
    search: serverSearch,
    sort: characterSort,
    favoriteFilter: serverFavoriteFilter,
  });
  const personaPages = usePersonaPages({ enabled: isPersonaLibrary, search: serverSearch, sort: personaSort });
  const characters = useMemo(() => flattenCharacterPages(characterPages.data), [characterPages.data]);
  const personas = useMemo(() => flattenPersonaPages(personaPages.data), [personaPages.data]);
  const isLoading = isPersonaLibrary ? personaPages.isLoading : characterPages.isLoading;
  const hasNextPage = isPersonaLibrary ? personaPages.hasNextPage : characterPages.hasNextPage;
  const isFetchingNextPage = isPersonaLibrary ? personaPages.isFetchingNextPage : characterPages.isFetchingNextPage;
  const libraryRootScrollRef = useRef<HTMLDivElement | null>(null);
  const libraryListScrollRef = useRef<HTMLElement | null>(null);
  const pendingLibraryScrollTopRef = useRef(0);
  const libraryScrollFrameRef = useRef<number | null>(null);

  const cards = useMemo<LibraryCard[]>(() => {
    if (isPersonaLibrary) return (personas as PersonaRow[]).map(toPersonaLibraryCard);
    return (characters as CharacterRow[]).map(parseCharacterRow).map(toCharacterLibraryCard);
  }, [characters, isPersonaLibrary, personas]);

  const filteredCards = useMemo(() => {
    const query = withCardLibraryTagFilters(parseCardLibrarySearchQuery(search), includedTags, excludedTags);
    return cards.filter((card) => {
      if (untaggedOnly && card.tags.length > 0) return false;
      // Personas have no server-side favorite filter, so honour the chip client-side for them.
      if (isPersonaLibrary && favoriteFilter !== "all") return card.favorite === (favoriteFilter === "favorites");
      return true;
    }).filter((card) => matchesCardLibrarySearch(card, query));
  }, [cards, excludedTags, favoriteFilter, includedTags, isPersonaLibrary, search, untaggedOnly]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const card of cards) for (const tag of card.tags) tagSet.add(tag);
    return [...tagSet].sort((left, right) => left.localeCompare(right));
  }, [cards]);

  const tagState = useCallback(
    (tag: string): "off" | "included" | "excluded" => {
      const key = tag.toLowerCase();
      if (includedTags.some((entry) => entry.toLowerCase() === key)) return "included";
      if (excludedTags.some((entry) => entry.toLowerCase() === key)) return "excluded";
      return "off";
    },
    [excludedTags, includedTags],
  );

  /** Clicking a tag toggles it into the filter; alt/right-click toggles it as an exclusion. */
  const toggleTagFilter = useCallback(
    (tag: string, exclude: boolean) => {
      const key = tag.toLowerCase();
      const drop = (list: string[]) => list.filter((entry) => entry.toLowerCase() !== key);
      const [target, setTarget, other, setOther] = exclude
        ? ([excludedTags, setExcludedTags, includedTags, setIncludedTags] as const)
        : ([includedTags, setIncludedTags, excludedTags, setExcludedTags] as const);
      const alreadyOn = target.some((entry) => entry.toLowerCase() === key);
      setTarget(alreadyOn ? drop(target) : [...drop(target), tag]);
      if (!alreadyOn) setOther(drop(other));
    },
    [excludedTags, includedTags],
  );

  const hasActiveFilters =
    search.trim().length > 0 ||
    includedTags.length > 0 ||
    excludedTags.length > 0 ||
    untaggedOnly ||
    favoriteFilter !== "all";

  const clearFilters = useCallback(() => {
    setSearch("");
    setIncludedTags([]);
    setExcludedTags([]);
    setUntaggedOnly(false);
    setFavoriteFilter("all");
  }, []);

  const sortedCards = useMemo(() => {
    const list = [...filteredCards];
    switch (sort) {
      case "name-asc":
        return list.sort((left, right) => left.name.localeCompare(right.name));
      case "name-desc":
        return list.sort((left, right) => right.name.localeCompare(left.name));
      case "newest":
        return list.sort((left, right) => (right.createdAt ?? "").localeCompare(left.createdAt ?? ""));
      case "oldest":
        return list.sort((left, right) => (left.createdAt ?? "").localeCompare(right.createdAt ?? ""));
      case "favorites":
        return list.sort(
          (left, right) => Number(right.favorite) - Number(left.favorite) || left.name.localeCompare(right.name),
        );
      default:
        return list;
    }
  }, [filteredCards, sort]);

  const setSelectedId = useCallback(
    (id: string | null) => {
      if (isPersonaLibrary) setPersonaSelectedId(id);
      else setCharacterSelectedId(id);
    },
    [isPersonaLibrary, setCharacterSelectedId, setPersonaSelectedId],
  );

  useEffect(() => {
    if (selectedId && sortedCards.some((card) => card.id === selectedId)) return;
    setSelectedId(sortedCards[0]?.id ?? null);
  }, [selectedId, setSelectedId, sortedCards]);

  const selectedCard = useMemo(
    () => sortedCards.find((card) => card.id === selectedId) ?? null,
    [selectedId, sortedCards],
  );

  const getActiveLibraryScrollNode = useCallback(() => {
    const candidates = [libraryRootScrollRef.current, libraryListScrollRef.current];
    return (
      candidates.find((node) => {
        if (!node || node.scrollHeight <= node.clientHeight) return false;
        const overflowY = window.getComputedStyle(node).overflowY;
        return overflowY === "auto" || overflowY === "scroll";
      }) ??
      libraryRootScrollRef.current ??
      libraryListScrollRef.current
    );
  }, []);

  const saveScrollTop = useCallback(
    (scrollTop: number) => {
      if (isPersonaLibrary) setPersonaScrollTop(scrollTop);
      else setCharacterScrollTop(scrollTop);
    },
    [isPersonaLibrary, setCharacterScrollTop, setPersonaScrollTop],
  );

  const rememberLibraryScroll = useCallback(() => {
    const node = getActiveLibraryScrollNode();
    if (!node) return;
    pendingLibraryScrollTopRef.current = node.scrollTop;
    saveScrollTop(node.scrollTop);
  }, [getActiveLibraryScrollNode, saveScrollTop]);

  const handleLibraryScroll = useCallback(
    (event: UIEvent<HTMLElement>) => {
      if (event.currentTarget !== event.target) return;
      pendingLibraryScrollTopRef.current = event.currentTarget.scrollTop;
      if (libraryScrollFrameRef.current !== null) return;
      libraryScrollFrameRef.current = window.requestAnimationFrame(() => {
        libraryScrollFrameRef.current = null;
        saveScrollTop(pendingLibraryScrollTopRef.current);
      });
    },
    [saveScrollTop],
  );

  useLayoutEffect(() => {
    if (isLoading) return;
    const restoreScroll = () => {
      const state = useUIStore.getState();
      const scrollTop = isPersonaLibrary ? state.personaLibraryScrollTop : state.characterLibraryScrollTop;
      for (const node of [libraryRootScrollRef.current, libraryListScrollRef.current]) {
        if (!node) continue;
        const maxScrollTop = Math.max(0, node.scrollHeight - node.clientHeight);
        node.scrollTop = Math.min(scrollTop, maxScrollTop);
      }
    };
    restoreScroll();
    const frame = window.requestAnimationFrame(restoreScroll);
    return () => window.cancelAnimationFrame(frame);
  }, [isLoading, isPersonaLibrary, sortedCards.length]);

  useLayoutEffect(
    () => () => {
      if (libraryScrollFrameRef.current !== null) window.cancelAnimationFrame(libraryScrollFrameRef.current);
    },
    [],
  );

  const openDetailFromLibrary = (id: string) => {
    rememberLibraryScroll();
    setSelectedId(id);
    if (isPersonaLibrary) openPersonaDetail(id, { preservePersonaLibrary: true });
    else openCharacterDetail(id, { preserveCharacterLibrary: true });
  };

  const openCharacterChat = useCallback(
    (card: LibraryCard) => {
      if (isPersonaLibrary) return;
      openModal("start-character-chat", {
        characterId: card.id,
        characterName: card.name,
      });
    },
    [isPersonaLibrary, openModal],
  );

  const checkedCards = useMemo(() => sortedCards.filter((card) => checkedIds.has(card.id)), [checkedIds, sortedCards]);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setCheckedIds(new Set());
  }, []);

  const toggleChecked = useCallback((id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleCheckAll = useCallback(() => {
    setCheckedIds((prev) => (prev.size === sortedCards.length ? new Set() : new Set(sortedCards.map((c) => c.id))));
  }, [sortedCards]);

  const handleExportSelected = useCallback(async () => {
    if (checkedIds.size === 0) return;
    setExportingSelected(true);
    try {
      await api.downloadPost(
        isPersonaLibrary ? "/characters/personas/export-bulk" : "/characters/export-bulk",
        { ids: [...checkedIds], format: "native" },
        isPersonaLibrary ? "marinara-personas.zip" : "marinara-characters.zip",
      );
      toast.success(localize(`Exported ${checkedIds.size} ${copy.plural}`));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : localize("Export failed"));
    } finally {
      setExportingSelected(false);
    }
  }, [checkedIds, copy.plural, isPersonaLibrary, localize]);

  const handleDeleteSelected = useCallback(async () => {
    const ids = [...checkedIds];
    if (ids.length === 0) return;
    const confirmed = await showConfirmDialog({
      title: localize(`Delete ${copy.plural}`),
      message: localize(`Delete ${ids.length} ${ids.length === 1 ? copy.singular : copy.plural}?`),
      confirmLabel: localize("Delete"),
      tone: "destructive",
    });
    if (!confirmed) return;

    const results = await Promise.allSettled(
      ids.map((id) => (isPersonaLibrary ? deletePersona.mutateAsync(id) : deleteCharacter.mutateAsync(id))),
    );
    const failedIds = ids.filter((_, index) => results[index]?.status === "rejected");
    if (ids.length > failedIds.length) toast.success(localize(`Deleted ${ids.length - failedIds.length}`));
    if (failedIds.length > 0) {
      // Keep the failures selected so a retry does not have to re-pick them out of the grid.
      setCheckedIds(new Set(failedIds));
      toast.error(localize(`Failed to delete ${failedIds.length}`));
      return;
    }
    exitSelectionMode();
  }, [checkedIds, copy, deleteCharacter, deletePersona, exitSelectionMode, isPersonaLibrary, localize]);

  const handleSortChange = (value: string) => {
    if (isPersonaLibrary) setPersonaSort(value as ResourcePanelSort);
    else setCharacterSort(value as CharacterLibrarySort);
  };

  const fetchNextPage = () => {
    if (isPersonaLibrary) void personaPages.fetchNextPage();
    else void characterPages.fetchNextPage();
  };

  const placeholderClass = isPersonaLibrary ? "mari-avatar-placeholder--persona" : "mari-avatar-placeholder--character";
  const newCardButtonClass = cn(
    "mari-panel-gradient-button h-10 min-h-10 min-w-0 px-3 text-[0.75rem]",
    isPersonaLibrary ? "mari-panel-gradient--personas" : "mari-panel-gradient--characters",
  );

  return (
    <div
      ref={libraryRootScrollRef}
      data-component="CharacterLibraryView"
      onScroll={handleLibraryScroll}
      className="mari-chrome-token-scope flex h-full min-h-0 flex-col overflow-y-auto overflow-x-hidden bg-[radial-gradient(circle_at_top_left,_color-mix(in_srgb,var(--marinara-chat-chrome-accent)_14%,transparent),_transparent_30%),radial-gradient(circle_at_top_right,_color-mix(in_srgb,var(--marinara-chat-chrome-text)_10%,transparent),_transparent_26%),var(--background)] text-[var(--marinara-chat-chrome-panel-text)] lg:overflow-hidden"
    >
      <div className="sticky top-0 z-10 border-b border-[var(--marinara-chat-chrome-panel-divider)] bg-[var(--card)]/85 backdrop-blur-xl">
        <div className="flex flex-col gap-2 px-3 py-2 md:px-6 md:py-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={closeLibrary}
              className="mari-chrome-control h-9 w-9 rounded-2xl p-0 md:h-10 md:w-10"
              title={localizeUi("ui.characters.characterlibraryview.closeLibrary")}
            >
              <ArrowLeft size="0.95rem" />
            </button>
            <div className="min-w-0">
              <p className="text-[0.625rem] font-semibold uppercase tracking-[0.28em] text-[var(--marinara-chat-chrome-panel-muted)]">
                {copy.title}
              </p>
              <h1 className="truncate text-base font-semibold text-[var(--marinara-chat-chrome-panel-title)] md:text-2xl">
                {copy.heading}
              </h1>
              <p className="text-xs text-[var(--marinara-chat-chrome-panel-muted)] md:text-sm">
                {filteredCards.length} {localizeUi("ui.characters.characterlibraryview.outOf")} {cards.length}{" "}
                {localizeUi("ui.characters.characterlibraryview.card")}
                {cards.length === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s")}
              </p>
            </div>
          </div>

          <div className="grid w-full grid-cols-2 gap-1.5 sm:ml-auto sm:w-72 lg:w-80">
            <div className="col-span-2 flex gap-1.5 [&>*]:min-w-0 [&>*]:flex-1">
            <button
              onClick={() => openModal(isPersonaLibrary ? "create-persona" : "create-character")}
              className={newCardButtonClass}
              title={localizeUi("ui.characters.characterlibraryview.newValue1", { value1: copy.singular })}
              aria-label={localizeUi("ui.characters.characterlibraryview.newValue1", { value1: copy.singular })}
            >
              <Plus size="0.75rem" />
            </button>
            <button
              onClick={() => openModal(isPersonaLibrary ? "import-persona" : "import-character")}
              className={libraryToolbarButtonClass}
              title={localizeUi("ui.characters.characterlibraryview.importValue1", { value1: copy.singular })}
              aria-label={localizeUi("ui.characters.characterlibraryview.importValue1", { value1: copy.singular })}
            >
              <Download size="0.75rem" />
            </button>

            <button
              onClick={() => (selectionMode ? exitSelectionMode() : setSelectionMode(true))}
              className={cn(libraryToolbarButtonClass, selectionMode && "mari-chrome-control--selected")}
              title={localize(selectionMode ? "Cancel selection" : "Select multiple")}
              aria-pressed={selectionMode}
            >
              <ListChecks size="0.75rem" />
            </button>
            <button
              onClick={() => setViewMode((mode) => (mode === "grid" ? "table" : "grid"))}
              className={libraryToolbarButtonClass}
              title={localize(viewMode === "grid" ? "Switch to table view" : "Switch to grid view")}
            >
              {viewMode === "grid" ? <Rows3 size="0.75rem" /> : <LayoutGrid size="0.75rem" />}
            </button>
            {!isPersonaLibrary && (
              <button
                onClick={() => setTagManagerOpen(true)}
                className={libraryToolbarButtonClass}
                title={localize("Tag manager")}
                aria-label={localize("Tag manager")}
              >
                <Tags size="0.75rem" />
              </button>
            )}
            </div>

            <div className="relative min-w-0">
              <Search
                size="0.75rem"
                className="mari-chrome-field-icon pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={
                  isPersonaLibrary
                    ? localize("Search personas")
                    : t("search.panels.charactersWithExcludedTag", { query: '-tag:"tag name"' })
                }
                className={cn(libraryToolbarFieldClass, "pl-7 pr-2.5")}
              />
            </div>

            <div className="relative min-w-0">
              <select
                value={sort}
                onChange={(event) => handleSortChange(event.target.value)}
                className={cn(
                  libraryToolbarFieldClass,
                  "mari-chrome-sort-field mari-accent-animated appearance-none pl-2.5 pr-7",
                )}
              >
                <option value="name-asc">{localizeUi("ui.characters.characterlibraryview.nameAZ")}</option>
                <option value="name-desc">{localizeUi("ui.characters.characterlibraryview.nameZA")}</option>
                <option value="newest">{localizeUi("ui.characters.characterlibraryview.newest")}</option>
                <option value="oldest">{localizeUi("ui.characters.characterlibraryview.oldest")}</option>
                {!isPersonaLibrary && (
                  <option value="favorites">{localizeUi("ui.characters.characterlibraryview.favoritesFirst")}</option>
                )}
              </select>
              <ArrowUpDown
                size="0.6875rem"
                className="mari-chrome-field-icon mari-chrome-sort-icon mari-accent-animated pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-0 xl:grid-cols-[minmax(0,1.1fr)_28rem]">
        <section
          ref={libraryListScrollRef}
          onScroll={handleLibraryScroll}
          className="min-h-0 overflow-visible px-4 py-4 md:px-6 lg:overflow-y-auto"
        >
          {isLoading && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((item) => (
                <div key={item} className="shimmer aspect-square rounded-[1.75rem]" />
              ))}
            </div>
          )}

          {!isLoading && sortedCards.length === 0 && (
            <div className="flex min-h-[18rem] flex-col items-center justify-center gap-3 rounded-[2rem] border border-dashed border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--card)]/50 p-6 text-center">
              <div
                className={cn(
                  "mari-avatar-placeholder flex h-14 w-14 items-center justify-center rounded-3xl",
                  placeholderClass,
                )}
              >
                <User size="1.5rem" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
                  {localizeUi("ui.characters.characterlibraryview.noMatching")} {copy.plural}
                </h2>
                <p className="mt-1 max-w-md text-sm text-[var(--marinara-chat-chrome-panel-muted)]">
                  {localizeUi("ui.characters.characterlibraryview.tryADifferentSearchAdjustSortingOrImportA")}
                </p>
              </div>
            </div>
          )}

          {!isLoading && sortedCards.length > 0 && viewMode === "table" && (
            <LibraryTable
              cards={sortedCards}
              selectedId={selectedId}
              selectionMode={selectionMode}
              checkedIds={checkedIds}
              onToggleChecked={toggleChecked}
              onToggleCheckAll={toggleCheckAll}
              onSelect={setSelectedId}
              onEdit={openDetailFromLibrary}
            />
          )}

          {!isLoading && sortedCards.length > 0 && viewMode === "grid" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3 xl:grid-cols-3 2xl:grid-cols-4">
              {sortedCards.map((card) => {
                const cardSummary = truncateText(card.summary, 180);
                const isSelected = selectedId === card.id;
                const isChecked = checkedIds.has(card.id);
                return (
                  <Fragment key={card.id}>
                    <button
                      type="button"
                      aria-pressed={selectionMode ? isChecked : undefined}
                      onClick={() => (selectionMode ? toggleChecked(card.id) : setSelectedId(card.id))}
                      className={cn(
                        "group relative flex h-full items-stretch overflow-hidden rounded-[1.25rem] border bg-[var(--card)]/70 text-left shadow-[0_20px_50px_-32px_rgba(15,23,42,0.75)] transition-all hover:border-[var(--marinara-chat-chrome-button-border-hover)] hover:shadow-[0_24px_60px_-32px_color-mix(in_srgb,var(--marinara-chat-chrome-accent)_35%,transparent)] sm:flex-col sm:rounded-[1.75rem] sm:hover:-translate-y-0.5",
                        (selectionMode ? isChecked : isSelected)
                          ? "border-[var(--marinara-chat-chrome-button-border-active)] ring-1 ring-[var(--marinara-chat-chrome-focus-ring)]"
                          : "border-[var(--marinara-chat-chrome-panel-border)]",
                      )}
                    >
                      {selectionMode && (
                        <span
                          aria-hidden="true"
                          className={cn(
                            "absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-lg border sm:left-3 sm:top-3",
                            isChecked
                              ? "mari-chrome-accent-surface border-transparent"
                              : "border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)]/80",
                          )}
                        >
                          {isChecked && <Check size="0.75rem" />}
                        </span>
                      )}
                      <div
                        className={cn(
                          "mari-avatar-placeholder relative h-24 w-24 shrink-0 overflow-hidden sm:h-auto sm:w-full sm:aspect-square",
                          placeholderClass,
                        )}
                      >
                        {card.avatarPath ? (
                          <img
                            src={card.avatarPath}
                            alt={card.name}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                            style={getAvatarCropStyle(card.avatarCrop)}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[var(--marinara-chat-chrome-panel-title)]">
                            <User size="1.5rem" className="sm:h-8 sm:w-8" />
                          </div>
                        )}
                        {card.favorite && (
                          <div
                            data-character-favorite-indicator="card"
                            className="mari-chrome-accent-surface mari-accent-animated absolute right-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[0.5625rem] font-medium backdrop-blur-sm sm:right-3 sm:top-3 sm:text-[0.625rem]"
                          >
                            <Star size="0.625rem" className="fill-current sm:h-[0.6875rem] sm:w-[0.6875rem]" />{" "}
                            {localizeUi("ui.characters.cardlibrarydetailcard.favorite")}
                          </div>
                        )}
                        {card.active && (
                          <div className="mari-chrome-accent-surface absolute right-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[0.5625rem] font-medium backdrop-blur-sm sm:right-3 sm:top-3 sm:text-[0.625rem]">
                            <Check size="0.625rem" /> {localizeUi("ui.characters.lorebooktab.active")}
                          </div>
                        )}
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3 sm:gap-3 sm:p-4">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-[var(--marinara-chat-chrome-panel-title)] sm:text-base">
                            {card.name}
                          </div>
                          {card.title && (
                            <div className="mt-0.5 truncate text-[0.625rem] italic text-[var(--marinara-chat-chrome-panel-muted)] sm:mt-1 sm:text-[0.6875rem]">
                              {card.title}
                            </div>
                          )}
                          {card.meta && (
                            <div className="mt-0.5 truncate text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-[var(--marinara-chat-chrome-panel-muted)] sm:mt-1 sm:text-[0.625rem] sm:tracking-[0.18em]">
                              {card.meta}
                            </div>
                          )}
                        </div>
                        <p className="line-clamp-3 text-[0.6875rem] leading-4 text-[var(--marinara-chat-chrome-panel-muted)] sm:line-clamp-4 sm:text-xs sm:leading-5">
                          {cardSummary}
                        </p>
                        <div className="mt-auto flex flex-wrap gap-1 sm:gap-1.5">
                          <span
                            className="mari-chrome-muted-badge gap-1 px-1.5 py-0.5 text-[0.5625rem] sm:px-2 sm:py-1 sm:text-[0.625rem]"
                            title={localizeUi(
                              "ui.characters.cardlibrarydetailcard.estimatedFromValue1CardTextFieldsActualTokenizerCounts",
                              { value1: copy.singular },
                            )}
                          >
                            <Hash size="0.5625rem" /> {formatEstimatedTokens(card.tokenEstimate)}
                          </span>
                          {card.tags.slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-[var(--marinara-chat-chrome-highlight-bg)] px-1.5 py-0.5 text-[0.5625rem] font-medium text-[var(--marinara-chat-chrome-panel-text)] sm:px-2 sm:py-1 sm:text-[0.625rem]"
                            >
                              {tag}
                            </span>
                          ))}
                          {card.tags.length > 2 && (
                            <span className="rounded-full bg-[var(--marinara-chat-chrome-button-bg)] px-1.5 py-0.5 text-[0.5625rem] text-[var(--marinara-chat-chrome-panel-muted)] sm:px-2 sm:py-1 sm:text-[0.625rem]">
                              +{card.tags.length - 2}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>

                    {!selectionMode && isSelected && (
                      <div className="col-span-full lg:hidden">
                        <CardLibraryDetailCard
                          card={card}
                          kind={kind}
                          onEdit={openDetailFromLibrary}
                          onChat={isPersonaLibrary ? undefined : openCharacterChat}
                        />
                      </div>
                    )}
                  </Fragment>
                );
              })}
            </div>
          )}

          {!isLoading && hasNextPage && (
            <div className="sticky bottom-0 z-20 -mx-4 mt-4 flex justify-center border-t border-[var(--marinara-chat-chrome-panel-divider)] bg-[var(--background)]/92 px-4 py-3 backdrop-blur-md md:-mx-6 md:px-6">
              <button
                type="button"
                onClick={fetchNextPage}
                disabled={isFetchingNextPage}
                className="mari-chrome-control mari-chrome-control--primary px-5 py-2 text-sm"
              >
                {isFetchingNextPage
                  ? localizeUi("ui.characters.characterlibraryview.loading")
                  : localizeUi("ui.characters.characterlibraryview.loadMoreValue1Loaded", { value1: cards.length })}
              </button>
            </div>
          )}
        </section>

        <aside className="hidden min-h-0 overflow-visible border-t border-[var(--marinara-chat-chrome-panel-divider)] bg-[var(--card)]/65 backdrop-blur-xl lg:block lg:overflow-y-auto lg:border-l lg:border-t-0">
          <div className="space-y-4 p-4 md:p-6">
            {selectedCard ? (
              <CardLibraryDetailCard
                card={selectedCard}
                kind={kind}
                onEdit={openDetailFromLibrary}
                onChat={isPersonaLibrary ? undefined : openCharacterChat}
              />
            ) : (
              <div className="flex min-h-[18rem] flex-col items-center justify-center gap-3 rounded-[2rem] border border-dashed border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)]/65 p-6 text-center">
                <div
                  className={cn(
                    "mari-avatar-placeholder flex h-14 w-14 items-center justify-center rounded-3xl",
                    placeholderClass,
                  )}
                >
                  <User size="1.5rem" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
                    {localizeUi("ui.characters.characterlibraryview.selectACard")}
                  </h2>
                  <p className="mt-1 text-sm text-[var(--marinara-chat-chrome-panel-muted)]">
                    {localizeUi("ui.characters.characterlibraryview.pickA")} {copy.singular}{" "}
                    {localizeUi("ui.characters.characterlibraryview.fromTheGridToSeeALargerOverviewBefore")}
                  </p>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {selectionMode && (
        <SelectionActionBar
          selectedCount={checkedIds.size}
          exporting={exportingSelected}
          extraAction={
            isPersonaLibrary ? undefined : (
              <button
                type="button"
                onClick={() => setBulkEditOpen(true)}
                disabled={checkedIds.size === 0}
                className="mari-chrome-control flex-1 px-3 py-2 text-xs"
              >
                <Pencil size="0.75rem" />
                {localize("Bulk edit")}
              </button>
            )
          }
          onExport={() => void handleExportSelected()}
          onDelete={() => void handleDeleteSelected()}
        />
      )}

      {bulkEditOpen && (
        <CharacterBulkEditModal
          open={bulkEditOpen}
          onClose={() => setBulkEditOpen(false)}
          selected={checkedCards.map((card) => card.summarySource)}
          onApplied={exitSelectionMode}
        />
      )}

      {tagManagerOpen && (
        <CharacterTagManagerModal open={tagManagerOpen} onClose={() => setTagManagerOpen(false)} />
      )}
    </div>
  );
}

function LibraryTable({
  cards,
  selectedId,
  selectionMode,
  checkedIds,
  onToggleChecked,
  onToggleCheckAll,
  onSelect,
  onEdit,
}: {
  cards: LibraryCard[];
  selectedId: string | null;
  selectionMode: boolean;
  checkedIds: Set<string>;
  onToggleChecked: (id: string) => void;
  onToggleCheckAll: () => void;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
}) {
  const localize = useLocalizedUiText();
  const headerClass =
    "px-3 py-2 text-left text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-[var(--marinara-chat-chrome-panel-muted)]";

  return (
    <div className="overflow-x-auto rounded-[1.25rem] border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--card)]/60">
      <table className="w-full min-w-[44rem] border-collapse text-sm">
        <thead className="border-b border-[var(--marinara-chat-chrome-panel-divider)]">
          <tr>
            {selectionMode && (
              <th scope="col" className={cn(headerClass, "w-10")}>
                <button type="button" onClick={onToggleCheckAll} title={localize("Select all")}>
                  <CheckSquare size="0.875rem" />
                </button>
              </th>
            )}
            <th scope="col" className={headerClass}>
              {localize("Name")}
            </th>
            <th scope="col" className={headerClass}>
              {localize("Summary")}
            </th>
            <th scope="col" className={headerClass}>
              {localize("Tags")}
            </th>
            <th scope="col" className={cn(headerClass, "w-24 text-right")}>
              {localize("Tokens")}
            </th>
            <th scope="col" className={cn(headerClass, "w-16")}>
              <span className="sr-only">{localize("Actions")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {cards.map((card) => {
            const isChecked = checkedIds.has(card.id);
            return (
              <tr
                key={card.id}
                onClick={() => (selectionMode ? onToggleChecked(card.id) : onSelect(card.id))}
                className={cn(
                  "cursor-pointer border-b border-[var(--marinara-chat-chrome-panel-divider)] last:border-b-0 hover:bg-[var(--marinara-chat-chrome-highlight-bg)]",
                  (selectionMode ? isChecked : selectedId === card.id) &&
                    "bg-[var(--marinara-chat-chrome-highlight-bg)]",
                )}
              >
                {selectionMode && (
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded border",
                        isChecked
                          ? "mari-chrome-accent-surface border-transparent"
                          : "border-[var(--marinara-chat-chrome-panel-border)]",
                      )}
                    >
                      {isChecked && <Check size="0.625rem" />}
                    </span>
                  </td>
                )}
                <td className="max-w-[14rem] px-3 py-2">
                  <div className="flex items-center gap-2">
                    {card.favorite && (
                      <Star size="0.75rem" className="shrink-0 fill-current text-[var(--marinara-chat-chrome-accent)]" />
                    )}
                    <span className="truncate font-medium text-[var(--marinara-chat-chrome-panel-title)]">
                      {card.name}
                    </span>
                  </div>
                  {card.meta && (
                    <div className="truncate text-[0.625rem] uppercase tracking-[0.14em] text-[var(--marinara-chat-chrome-panel-muted)]">
                      {card.meta}
                    </div>
                  )}
                </td>
                <td className="max-w-[24rem] px-3 py-2 text-[var(--marinara-chat-chrome-panel-muted)]">
                  <span className="line-clamp-2 text-xs">{truncateText(card.summary, 220)}</span>
                  {card.hasStoredSummary && (
                    <span className="text-[0.5625rem] uppercase tracking-[0.18em] text-[var(--marinara-chat-chrome-accent)]">
                      {localize("saved")}
                    </span>
                  )}
                </td>
                <td className="max-w-[12rem] px-3 py-2">
                  <span className="line-clamp-2 text-[0.6875rem] text-[var(--marinara-chat-chrome-panel-muted)]">
                    {card.tags.join(", ")}
                  </span>
                </td>
                <td className="px-3 py-2 text-right text-xs tabular-nums text-[var(--marinara-chat-chrome-panel-muted)]">
                  {formatEstimatedTokens(card.tokenEstimate)}
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onEdit(card.id);
                    }}
                    className="mari-chrome-control h-8 w-8 rounded-lg p-0"
                    title={localize("Edit")}
                  >
                    <Pencil size="0.75rem" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
