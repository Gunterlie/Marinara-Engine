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
import { CharacterBulkEditModal } from "./CharacterBulkEditModal";
import { CharacterTagManagerModal } from "./CharacterTagManagerModal";
import {
  formatCardLibraryMeta,
  getCardLibrarySummary,
  parseCardLibrarySearchQuery,
} from "../../lib/card-library-search";
import {
  collectLibraryTags,
  filterLibraryCards,
  getLibraryTagState,
  sortLibraryCards,
  toggleLibraryTagFilter,
} from "../../lib/card-library-filter";
import {
  getText,
  parseCharacterRow,
  toCharacterLibraryCard,
  type CharacterRow,
  type LibraryCard,
  type LibrarySection,
} from "../../lib/character-library-card";
import { formatEstimatedTokens } from "../../lib/character-token-count";
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
  const { t: localizeUi } = useUiTranslation();
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
      title={localizeUi("ui.characters.tagchip.filterByValue1AltClickOrRightClickTo", { value1: tag })}
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

function getPersonaSummary(persona: PersonaRow) {
  return getCardLibrarySummary([persona.creatorNotes, persona.description, persona.personality, persona.backstory]);
}

function truncateText(content: string, maxLength: number) {
  if (content.length <= maxLength) return content;
  return `${content.slice(0, maxLength - 3).trimEnd()}...`;
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

  const filteredCards = useMemo(
    () =>
      filterLibraryCards(cards, {
        search,
        includedTags,
        excludedTags,
        untaggedOnly,
        // Characters filter favorites server-side; personas have no such query, so the chip
        // has to be honoured client-side for them.
        favorite: isPersonaLibrary ? favoriteFilter : "all",
      }),
    [cards, excludedTags, favoriteFilter, includedTags, isPersonaLibrary, search, untaggedOnly],
  );

  const allTags = useMemo(() => collectLibraryTags(cards), [cards]);

  const tagState = useCallback(
    (tag: string) => getLibraryTagState(tag, includedTags, excludedTags),
    [excludedTags, includedTags],
  );

  const toggleTagFilter = useCallback(
    (tag: string, exclude: boolean) => {
      const next = toggleLibraryTagFilter(tag, exclude, includedTags, excludedTags);
      setIncludedTags(next.included);
      setExcludedTags(next.excluded);
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

  const sortedCards = useMemo(
    () => sortLibraryCards(filteredCards, sort, includedTags),
    [filteredCards, includedTags, sort],
  );

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
  const hasSelection = checkedIds.size > 0;

  const clearSelection = useCallback(() => {
    setCheckedIds(new Set());
    selectionAnchorRef.current = null;
  }, []);

  const toggleChecked = useCallback((id: string) => {
    selectionAnchorRef.current = id;
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

  /** Shift-click: check everything between the anchor and the clicked card, inclusive. */
  const checkRangeTo = useCallback(
    (id: string) => {
      const anchor = selectionAnchorRef.current;
      const end = sortedCards.findIndex((card) => card.id === id);
      const start = anchor ? sortedCards.findIndex((card) => card.id === anchor) : -1;
      if (end < 0 || start < 0) {
        toggleChecked(id);
        return;
      }
      const [from, to] = start <= end ? [start, end] : [end, start];
      setCheckedIds((prev) => {
        const next = new Set(prev);
        for (let index = from; index <= to; index++) next.add(sortedCards[index].id);
        return next;
      });
    },
    [sortedCards, toggleChecked],
  );

  /**
   * Plain click previews. Ctrl/Cmd toggles one card, Shift extends a range — the file-manager
   * contract, so bulk selection no longer needs a mode to be armed first.
   */
  const handleCardActivate = useCallback(
    (card: LibraryCard, event: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }) => {
      if (event.shiftKey) checkRangeTo(card.id);
      else if (event.ctrlKey || event.metaKey) toggleChecked(card.id);
      else setSelectedId(card.id);
    },
    [checkRangeTo, setSelectedId, toggleChecked],
  );

  const stepSelection = useCallback(
    (delta: number) => {
      if (sortedCards.length === 0) return;
      const current = sortedCards.findIndex((card) => card.id === selectedId);
      const next = Math.min(sortedCards.length - 1, Math.max(0, (current < 0 ? 0 : current) + delta));
      setSelectedId(sortedCards[next].id);
      gridRef.current?.querySelector<HTMLElement>(`[data-card-index="${next}"]`)?.focus();
    },
    [selectedId, setSelectedId, sortedCards],
  );

  const applyFavorite = useCallback(
    async (ids: string[], favorite: boolean) => {
      if (isPersonaLibrary || ids.length === 0) return;
      try {
        await bulkUpdate.mutateAsync({ characterIds: ids, changes: { favorite } });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : localize("Could not update favorites"));
      }
    },
    [bulkUpdate, isPersonaLibrary, localize],
  );

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
    clearSelection();
  }, [checkedIds, clearSelection, copy, deleteCharacter, deletePersona, isPersonaLibrary, localize]);

  const handleSortChange = (value: string) => {
    if (isPersonaLibrary) setPersonaSort(value as ResourcePanelSort);
    else setCharacterSort(value as CharacterLibrarySort);
  };

  const fetchNextPage = useCallback(() => {
    if (isPersonaLibrary) void personaPages.fetchNextPage();
    else void characterPages.fetchNextPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPersonaLibrary, characterPages.fetchNextPage, personaPages.fetchNextPage]);

  // Auto-load the next page when the footer scrolls into view. The button below stays as the
  // manual fallback for browsers where the observer never fires (or the list never scrolls).
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !hasNextPage || isFetchingNextPage || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) fetchNextPage();
      },
      { rootMargin: "300px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, sortedCards.length]);

  /**
   * Library-wide shortcuts. Deliberately inert while a field has focus, so typing "j" into the
   * search box does not step the preview.
   */
  useEffect(() => {
    const handler = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

      if (event.key === "/" && !typing && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (event.key === "Escape") {
        if (typing && target === searchInputRef.current) {
          setSearch("");
          searchInputRef.current?.blur();
          return;
        }
        if (hasSelection) clearSelection();
        return;
      }
      if (typing || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "j") {
        event.preventDefault();
        stepSelection(1);
      } else if (event.key === "k") {
        event.preventDefault();
        stepSelection(-1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [clearSelection, hasSelection, stepSelection]);

  /** Arrow-key roving focus inside the grid. Column count is read off the live grid template. */
  const handleGridKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const indexAttr = (event.target as HTMLElement).closest<HTMLElement>("[data-card-index]")?.dataset.cardIndex;
      if (indexAttr === undefined) return;
      const index = Number(indexAttr);
      const grid = gridRef.current;
      const columns = grid ? window.getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length : 1;

      const moves: Record<string, number> = {
        ArrowRight: 1,
        ArrowLeft: -1,
        ArrowDown: Math.max(1, columns),
        ArrowUp: -Math.max(1, columns),
      };
      const card = sortedCards[index];
      if (!card) return;

      if (event.key in moves) {
        event.preventDefault();
        const next = Math.min(sortedCards.length - 1, Math.max(0, index + moves[event.key]));
        setSelectedId(sortedCards[next].id);
        grid?.querySelector<HTMLElement>(`[data-card-index="${next}"]`)?.focus();
      } else if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        const next = event.key === "Home" ? 0 : sortedCards.length - 1;
        setSelectedId(sortedCards[next].id);
        grid?.querySelector<HTMLElement>(`[data-card-index="${next}"]`)?.focus();
      } else if (event.key === "Enter") {
        event.preventDefault();
        openDetailFromLibrary(card.id);
      } else if (event.key === " ") {
        event.preventDefault();
        if (event.shiftKey) checkRangeTo(card.id);
        else toggleChecked(card.id);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [checkRangeTo, setSelectedId, sortedCards, toggleChecked],
  );

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

          <div className="flex w-full flex-wrap items-center gap-1.5 sm:ml-auto lg:w-auto lg:flex-nowrap">
            <div className="relative order-1 min-w-0 flex-1 basis-full sm:basis-auto lg:w-64">
              <Search
                size="0.75rem"
                className="mari-chrome-field-icon pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
              />
              <input
                ref={searchInputRef}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={
                  isPersonaLibrary
                    ? localize("Search personas  ( / )")
                    : t("search.panels.charactersWithExcludedTag", { query: '-tag:"tag name"' })
                }
                className={cn(libraryToolbarFieldClass, "pl-7 pr-2.5")}
              />
            </div>

            <div className="relative order-2 min-w-0 flex-1 sm:w-32 sm:flex-none">
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

            {/* Segmented control: both states are visible, so it never reads as a coin flip. */}
            <div
              role="radiogroup"
              aria-label={localize("View mode")}
              className="order-3 hidden shrink-0 gap-0.5 rounded-2xl border border-[var(--marinara-chat-chrome-panel-border)] p-0.5 sm:flex"
            >
              {(
                [
                  { mode: "grid" as const, icon: <LayoutGrid size="0.75rem" />, label: localize("Grid") },
                  { mode: "table" as const, icon: <Rows3 size="0.75rem" />, label: localize("Table") },
                ]
              ).map((option) => (
                <button
                  key={option.mode}
                  type="button"
                  role="radio"
                  aria-checked={viewMode === option.mode}
                  onClick={() => setViewMode(option.mode)}
                  title={option.label}
                  aria-label={option.label}
                  className={cn(
                    "mari-chrome-control h-9 w-9 rounded-xl p-0",
                    viewMode === option.mode && "mari-chrome-control--selected",
                  )}
                >
                  {option.icon}
                </button>
              ))}
            </div>

            <button
              onClick={() => openModal(isPersonaLibrary ? "create-persona" : "create-character")}
              className={cn(newCardButtonClass, "order-4 shrink-0")}
              title={localizeUi("ui.characters.characterlibraryview.newValue1", { value1: copy.singular })}
            >
              <Plus size="0.75rem" />
              <span className="hidden sm:inline">{localize("New")}</span>
            </button>
            <button
              onClick={() => openModal(isPersonaLibrary ? "import-persona" : "import-character")}
              className={cn(libraryToolbarButtonClass, "order-5 shrink-0")}
              title={localizeUi("ui.characters.characterlibraryview.importValue1", { value1: copy.singular })}
            >
              <Download size="0.75rem" />
              <span className="hidden md:inline">{localize("Import")}</span>
            </button>
            <button
              onClick={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                setOverflowMenu({ x: rect.right - 200, y: rect.bottom + 4 });
              }}
              className={cn(libraryToolbarButtonClass, "order-6 shrink-0")}
              title={localize("More library tools")}
              aria-label={localize("More library tools")}
              aria-haspopup="menu"
            >
              <MoreHorizontal size="0.75rem" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1 px-3 pb-2 md:px-6 md:pb-3">
          {(
            [
              { value: "all" as const, label: localize("All") },
              { value: "favorites" as const, label: localize("Favorites") },
              { value: "non-favorites" as const, label: localize("Not favorited") },
            ]
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFavoriteFilter(option.value)}
              aria-pressed={favoriteFilter === option.value}
              className={cn(
                "mari-chrome-control mari-chrome-control--compact",
                favoriteFilter === option.value && "mari-chrome-control--selected",
              )}
            >
              {option.value === "favorites" && <Star size="0.625rem" />}
              {option.value === "non-favorites" && <StarOff size="0.625rem" />}
              {option.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setUntaggedOnly((value) => !value)}
            aria-pressed={untaggedOnly}
            className={cn(
              "mari-chrome-control mari-chrome-control--compact",
              untaggedOnly && "mari-chrome-control--selected",
            )}
            title={localize("Show only cards with no tags")}
          >
            <Tag size="0.625rem" />
            {localize("Untagged")}
          </button>

          {[...includedTags, ...excludedTags].map((tag) => (
            <button
              key={`${tagState(tag)}-${tag}`}
              type="button"
              onClick={() => toggleTagFilter(tag, tagState(tag) === "excluded")}
              className={cn(
                "mari-chrome-control mari-chrome-control--compact",
                tagState(tag) === "excluded" ? "mari-chrome-control--danger" : "mari-chrome-control--selected",
              )}
              title={localize(`Remove the "${tag}" filter`)}
            >
              {tagState(tag) === "excluded" ? "-" : ""}
              {tag}
              <X size="0.5rem" />
            </button>
          ))}

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="mari-chrome-control mari-chrome-control--compact mari-chrome-control--danger"
            >
              <X size="0.5rem" /> {localize("Clear filters")}
            </button>
          )}
        </div>
      </div>

      {overflowMenu && (
        <ActionDropdown
          x={overflowMenu.x}
          y={overflowMenu.y}
          onClose={() => setOverflowMenu(null)}
          items={[
            ...(isPersonaLibrary
              ? []
              : [
                  {
                    label: localize("Tag manager"),
                    icon: <Tag size="0.75rem" />,
                    onSelect: () => setTagManagerOpen(true),
                  },
                ]),
            {
              label: hasSelection ? localize("Clear selection") : localize("Select all"),
              icon: <Check size="0.75rem" />,
              onSelect: () => (hasSelection ? clearSelection() : toggleCheckAll()),
              disabled: sortedCards.length === 0,
            },
            {
              label: localize("Clear filters"),
              icon: <X size="0.75rem" />,
              onSelect: clearFilters,
              disabled: !hasActiveFilters,
            },
            ...DENSITY_ORDER.map((option) => ({
              label: `${density === option ? "• " : "   "}${localize(DENSITY_CONFIG[option].label)}`,
              icon: <LayoutGrid size="0.75rem" />,
              onSelect: () => {
                setDensity(option);
                setViewMode("grid");
              },
            })),
          ]}
        />
      )}

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
              <div className="flex flex-wrap justify-center gap-2">
                {hasActiveFilters && (
                  <button type="button" onClick={clearFilters} className={libraryToolbarButtonClass}>
                    <X size="0.75rem" /> {localize("Clear filters")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openModal(isPersonaLibrary ? "import-persona" : "import-character")}
                  className={libraryToolbarButtonClass}
                >
                  <Download size="0.75rem" /> {localize("Import")}
                </button>
                <button
                  type="button"
                  onClick={() => openModal(isPersonaLibrary ? "create-persona" : "create-character")}
                  className={newCardButtonClass}
                >
                  <Plus size="0.75rem" /> {localize("New")}
                </button>
              </div>
            </div>
          )}

          {!isLoading && sortedCards.length > 0 && viewMode === "table" && (
            <LibraryTable
              cards={sortedCards}
              selectedId={selectedId}
              checkedIds={checkedIds}
              sort={sort}
              onSortChange={handleSortChange}
              onToggleChecked={toggleChecked}
              onCheckRangeTo={checkRangeTo}
              onToggleCheckAll={toggleCheckAll}
              onSelect={setSelectedId}
              onEdit={openDetailFromLibrary}
              onToggleTag={toggleTagFilter}
              tagState={tagState}
            />
          )}

          {!isLoading && sortedCards.length > 0 && viewMode === "grid" && (
            <div
              ref={gridRef}
              role="listbox"
              aria-label={copy.title}
              aria-multiselectable="true"
              onKeyDown={handleGridKeyDown}
              className={cn("grid", DENSITY_CONFIG[density].grid)}
            >
              {sortedCards.map((card, index) => {
                const isSelected = selectedId === card.id;
                const isChecked = checkedIds.has(card.id);
                const isCover = density === "cover";
                const summaryLines = DENSITY_CONFIG[density].summaryLines;
                return (
                  <Fragment key={card.id}>
                    <div
                      role="option"
                      tabIndex={isSelected || (index === 0 && !selectedId) ? 0 : -1}
                      aria-selected={isSelected}
                      data-card-index={index}
                      data-checked={isChecked || undefined}
                      onClick={(event: ReactMouseEvent) => handleCardActivate(card, event)}
                      onDoubleClick={() => openDetailFromLibrary(card.id)}
                      className={cn(
                        "group relative flex h-full cursor-pointer items-stretch overflow-hidden rounded-[1.25rem] border bg-[var(--card)]/70 text-left shadow-[0_20px_50px_-32px_rgba(15,23,42,0.75)] transition-all hover:border-[var(--marinara-chat-chrome-button-border-hover)] hover:shadow-[0_24px_60px_-32px_color-mix(in_srgb,var(--marinara-chat-chrome-accent)_35%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)] sm:flex-col sm:rounded-[1.75rem] sm:hover:-translate-y-0.5",
                        isChecked
                          ? "border-[var(--marinara-chat-chrome-button-border-active)] ring-2 ring-[var(--marinara-chat-chrome-focus-ring)]"
                          : isSelected
                            ? "border-[var(--marinara-chat-chrome-button-border-active)] ring-1 ring-[var(--marinara-chat-chrome-focus-ring)]"
                            : "border-[var(--marinara-chat-chrome-panel-border)]",
                      )}
                    >
                      {/* Checkbox is always mounted so selection needs no mode; it just stays
                          invisible until the card is hovered, focused, or already checked. */}
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={isChecked}
                        aria-label={localize(`Select ${card.name}`)}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (event.shiftKey) checkRangeTo(card.id);
                          else toggleChecked(card.id);
                        }}
                        className={cn(
                          "absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-lg border transition-opacity sm:left-3 sm:top-3",
                          isChecked
                            ? "mari-chrome-accent-surface border-transparent opacity-100"
                            : cn(
                                "border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)]/80 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
                                hasSelection && "opacity-100",
                              ),
                        )}
                      >
                        {isChecked && <Check size="0.75rem" />}
                      </button>

                      {/* Hover quick-actions: star / chat / edit without leaving the grid. */}
                      <div className="absolute right-2 top-2 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 sm:right-3 sm:top-3">
                        {!isPersonaLibrary && (
                          <button
                            type="button"
                            aria-label={localize(card.favorite ? "Unfavorite" : "Favorite")}
                            title={localize(card.favorite ? "Unfavorite" : "Favorite")}
                            onClick={(event) => {
                              event.stopPropagation();
                              void applyFavorite([card.id], !card.favorite);
                            }}
                            className="mari-chrome-control h-7 w-7 rounded-lg p-0 backdrop-blur-sm"
                          >
                            <Star size="0.6875rem" className={cn(card.favorite && "fill-current")} />
                          </button>
                        )}
                        {!isPersonaLibrary && (
                          <button
                            type="button"
                            aria-label={localizeUi("ui.characters.characterlibraryview.chatNow")}
                            title={localizeUi("ui.characters.characterlibraryview.chatNow")}
                            onClick={(event) => {
                              event.stopPropagation();
                              openCharacterChat(card);
                            }}
                            className="mari-chrome-control h-7 w-7 rounded-lg p-0 backdrop-blur-sm"
                          >
                            <MessageCircle size="0.6875rem" />
                          </button>
                        )}
                        <button
                          type="button"
                          aria-label={localize("Edit")}
                          title={localize("Edit")}
                          onClick={(event) => {
                            event.stopPropagation();
                            openDetailFromLibrary(card.id);
                          }}
                          className="mari-chrome-control h-7 w-7 rounded-lg p-0 backdrop-blur-sm"
                        >
                          <Pencil size="0.6875rem" />
                        </button>
                      </div>

                      <div
                        className={cn(
                          "mari-avatar-placeholder relative shrink-0 overflow-hidden",
                          isCover
                            ? "aspect-[3/4] w-full"
                            : "h-24 w-24 sm:aspect-square sm:h-auto sm:w-full",
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
                            className="mari-chrome-accent-surface mari-accent-animated absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[0.5625rem] font-medium backdrop-blur-sm"
                          >
                            <Star size="0.625rem" className="fill-current" />
                          </div>
                        )}
                        {card.active && (
                          <div className="mari-chrome-accent-surface absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.5625rem] font-medium backdrop-blur-sm">
                            <Check size="0.625rem" /> {localizeUi("ui.characters.lorebooktab.active")}
                          </div>
                        )}
                        {isCover && (
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-2.5 pt-8">
                            <div className="truncate text-[0.8125rem] font-semibold text-white">{card.name}</div>
                            {card.title && (
                              <div className="truncate text-[0.625rem] italic text-white/70">{card.title}</div>
                            )}
                          </div>
                        )}
                      </div>

                      {!isCover && (
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
                            {card.meta && summaryLines > 0 && (
                              <div className="mt-0.5 truncate text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-[var(--marinara-chat-chrome-panel-muted)] sm:mt-1 sm:text-[0.625rem] sm:tracking-[0.18em]">
                                {card.meta}
                              </div>
                            )}
                          </div>
                          {summaryLines > 0 && (
                            <p className="line-clamp-3 text-[0.6875rem] leading-4 text-[var(--marinara-chat-chrome-panel-muted)] sm:line-clamp-4 sm:text-xs sm:leading-5">
                              {truncateText(card.summary, 180)}
                            </p>
                          )}
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
                              <TagChip key={tag} tag={tag} state={tagState(tag)} onToggle={toggleTagFilter} />
                            ))}
                            {card.tags.length > 2 && (
                              <span className="rounded-full bg-[var(--marinara-chat-chrome-button-bg)] px-1.5 py-0.5 text-[0.5625rem] text-[var(--marinara-chat-chrome-panel-muted)] sm:px-2 sm:py-1 sm:text-[0.625rem]">
                                +{card.tags.length - 2}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {isSelected && (
                      <div className="col-span-full lg:hidden">
                        <CardLibraryDetailCard
                          card={card}
                          kind={kind}
                          onEdit={openDetailFromLibrary}
                          onChat={isPersonaLibrary ? undefined : openCharacterChat}
                          onToggleFavorite={
                            isPersonaLibrary ? undefined : (target) => void applyFavorite([target.id], !target.favorite)
                          }
                          onToggleTag={toggleTagFilter}
                          tagState={tagState}
                          position={{ index: index + 1, total: sortedCards.length }}
                          onStep={stepSelection}
                        />
                      </div>
                    )}
                  </Fragment>
                );
              })}
            </div>
          )}

          {!isLoading && hasNextPage && (
            <div
              ref={loadMoreRef}
              className="sticky bottom-0 z-20 -mx-4 mt-4 flex justify-center border-t border-[var(--marinara-chat-chrome-panel-divider)] bg-[var(--background)]/92 px-4 py-3 backdrop-blur-md md:-mx-6 md:px-6"
            >
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
                onToggleFavorite={
                  isPersonaLibrary ? undefined : (target) => void applyFavorite([target.id], !target.favorite)
                }
                onToggleTag={toggleTagFilter}
                tagState={tagState}
                position={{
                  index: sortedCards.findIndex((card) => card.id === selectedCard.id) + 1,
                  total: sortedCards.length,
                }}
                onStep={stepSelection}
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

      {hasSelection && (
        <SelectionActionBar
          selectedCount={checkedIds.size}
          exporting={exportingSelected}
          extraAction={
            isPersonaLibrary ? undefined : (
              <>
                <button
                  type="button"
                  onClick={() => void applyFavorite([...checkedIds], true)}
                  className="mari-chrome-control flex-1 px-3 py-2 text-xs"
                  title={localize("Favorite selected")}
                >
                  <Star size="0.75rem" />
                  {localize("Favorite")}
                </button>
                <button
                  type="button"
                  onClick={() => setBulkEditOpen(true)}
                  className="mari-chrome-control flex-1 px-3 py-2 text-xs"
                >
                  <Pencil size="0.75rem" />
                  {localize("Bulk edit")}
                </button>
              </>
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
          knownTags={allTags}
          onApplied={clearSelection}
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
  checkedIds,
  sort,
  onSortChange,
  onToggleChecked,
  onCheckRangeTo,
  onToggleCheckAll,
  onSelect,
  onEdit,
  onToggleTag,
  tagState,
}: {
  cards: LibraryCard[];
  selectedId: string | null;
  checkedIds: Set<string>;
  sort: string;
  onSortChange: (value: string) => void;
  onToggleChecked: (id: string) => void;
  onCheckRangeTo: (id: string) => void;
  onToggleCheckAll: () => void;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onToggleTag: (tag: string, exclude: boolean) => void;
  tagState: (tag: string) => "off" | "included" | "excluded";
}) {
  const localize = useLocalizedUiText();
  const headerClass =
    "px-3 py-2 text-left text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-[var(--marinara-chat-chrome-panel-muted)]";
  const allChecked = cards.length > 0 && cards.every((card) => checkedIds.has(card.id));

  /**
   * Header sorting drives the same store value as the toolbar select, so the two controls can
   * never disagree about how the list is ordered.
   */
  const nameSortNext = sort === "name-asc" ? "name-desc" : "name-asc";
  const sortIndicator = (active: boolean, ascending: boolean) =>
    active ? <span aria-hidden="true">{ascending ? "▲" : "▼"}</span> : null;

  return (
    <div className="overflow-x-auto rounded-[1.25rem] border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--card)]/60">
      <table className="w-full min-w-[44rem] border-collapse text-sm">
        <thead className="border-b border-[var(--marinara-chat-chrome-panel-divider)]">
          <tr>
            <th scope="col" className={cn(headerClass, "w-10")}>
              <button
                type="button"
                role="checkbox"
                aria-checked={allChecked}
                onClick={onToggleCheckAll}
                title={localize(allChecked ? "Clear selection" : "Select all")}
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded border",
                  allChecked
                    ? "mari-chrome-accent-surface border-transparent"
                    : "border-[var(--marinara-chat-chrome-panel-border)]",
                )}
              >
                {allChecked && <Check size="0.625rem" />}
              </button>
            </th>
            <th
              scope="col"
              aria-sort={sort === "name-asc" ? "ascending" : sort === "name-desc" ? "descending" : "none"}
              className={headerClass}
            >
              <button
                type="button"
                onClick={() => onSortChange(nameSortNext)}
                className="flex items-center gap-1 uppercase tracking-[0.18em] hover:text-[var(--marinara-chat-chrome-panel-title)]"
              >
                {localize("Name")}
                {sortIndicator(sort === "name-asc" || sort === "name-desc", sort === "name-asc")}
              </button>
            </th>
            <th scope="col" className={headerClass}>
              {localize("Summary")}
            </th>
            <th scope="col" className={headerClass}>
              {localize("Tags")}
            </th>
            <th
              scope="col"
              aria-sort={sort === "newest" ? "descending" : sort === "oldest" ? "ascending" : "none"}
              className={cn(headerClass, "w-28")}
            >
              <button
                type="button"
                onClick={() => onSortChange(sort === "newest" ? "oldest" : "newest")}
                className="flex items-center gap-1 uppercase tracking-[0.18em] hover:text-[var(--marinara-chat-chrome-panel-title)]"
              >
                {localize("Created")}
                {sortIndicator(sort === "newest" || sort === "oldest", sort === "oldest")}
              </button>
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
                onClick={(event) => {
                  if (event.shiftKey) onCheckRangeTo(card.id);
                  else if (event.ctrlKey || event.metaKey) onToggleChecked(card.id);
                  else onSelect(card.id);
                }}
                className={cn(
                  "cursor-pointer border-b border-[var(--marinara-chat-chrome-panel-divider)] last:border-b-0 hover:bg-[var(--marinara-chat-chrome-highlight-bg)]",
                  (isChecked || selectedId === card.id) && "bg-[var(--marinara-chat-chrome-highlight-bg)]",
                )}
              >
                <td className="px-3 py-2">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={isChecked}
                    aria-label={localize(`Select ${card.name}`)}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (event.shiftKey) onCheckRangeTo(card.id);
                      else onToggleChecked(card.id);
                    }}
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded border",
                      isChecked
                        ? "mari-chrome-accent-surface border-transparent"
                        : "border-[var(--marinara-chat-chrome-panel-border)]",
                    )}
                  >
                    {isChecked && <Check size="0.625rem" />}
                  </button>
                </td>
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
                  <div className="flex flex-wrap gap-1">
                    {card.tags.slice(0, 4).map((tag) => (
                      <TagChip key={tag} tag={tag} state={tagState(tag)} onToggle={onToggleTag} />
                    ))}
                    {card.tags.length > 4 && (
                      <span className="text-[0.5625rem] text-[var(--marinara-chat-chrome-panel-muted)]">
                        +{card.tags.length - 4}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-[0.6875rem] tabular-nums text-[var(--marinara-chat-chrome-panel-muted)]">
                  {card.createdAt ? new Date(card.createdAt).toLocaleDateString() : "—"}
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
