import { useId, useMemo, useState } from "react";
import { Sparkles, Star, StarOff, Tag, X } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "../ui/Modal";
import { api } from "../../lib/api-client";
import { useBulkUpdateCharacters, type BulkCharacterChanges } from "../../hooks/use-characters";
import { useConnections } from "../../hooks/use-connections";
import { cn } from "../../lib/utils";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { useTranslation as useUiTranslation } from "react-i18next";

/**
 * Card fields the summariser is allowed to see. Keeping this explicit stops a huge
 * card (greetings, embedded lorebook) from blowing the connection's context window.
 */
export type BulkSummarySource = {
  id: string;
  name: string;
  description: string;
  personality: string;
  scenario: string;
  tags: string[];
};

const SUMMARY_SYSTEM_PROMPT =
  "You write one-line library blurbs for roleplay character cards. " +
  "Reply with a single sentence of at most 200 characters describing who the character is and the " +
  "premise of their scenario. No preamble, no quotes, no markdown, no trailing period-less fragments.";

const fieldClass = "mari-chrome-field h-10 w-full text-sm";

function TagList({ tags, onRemove, tone }: { tags: string[]; onRemove: (tag: string) => void; tone: "add" | "remove" }) {
  const { t: localizeUi } = useUiTranslation();
  if (tags.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag}
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[0.6875rem] font-medium",
            tone === "add"
              ? "bg-[var(--marinara-chat-chrome-highlight-bg)] text-[var(--marinara-chat-chrome-panel-text)]"
              : "bg-[var(--marinara-chat-chrome-button-bg)] text-[var(--marinara-chat-chrome-panel-muted)] line-through",
          )}
        >
          {tag}
          <button type="button" onClick={() => onRemove(tag)} aria-label={localizeUi("ui.characters.statstab.removeValue1", { value1: tag })}>
            <X size="0.625rem" />
          </button>
        </span>
      ))}
    </div>
  );
}

export function CharacterBulkEditModal({
  open,
  onClose,
  selected,
  onApplied,
  knownTags = [],
}: {
  open: boolean;
  onClose: () => void;
  selected: BulkSummarySource[];
  onApplied: () => void;
  /** Tags already in the library. Offered as autocomplete so bulk edits stop minting near-duplicates. */
  knownTags?: string[];
}) {
  const localize = useLocalizedUiText();
  const bulkUpdate = useBulkUpdateCharacters();
  const { data: connections } = useConnections();
  const knownTagsDatalistId = useId();

  const [addTagDraft, setAddTagDraft] = useState("");
  const [removeTagDraft, setRemoveTagDraft] = useState("");
  const [addTags, setAddTags] = useState<string[]>([]);
  const [removeTags, setRemoveTags] = useState<string[]>([]);
  const [favorite, setFavorite] = useState<boolean | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [connectionId, setConnectionId] = useState("");
  const [generating, setGenerating] = useState(false);

  const connectionOptions = useMemo(
    () =>
      (Array.isArray(connections) ? connections : [])
        .map((conn) => conn as { id?: unknown; name?: unknown })
        .filter((conn): conn is { id: string; name: string } => typeof conn.id === "string")
        .map((conn) => ({ id: conn.id, name: typeof conn.name === "string" ? conn.name : conn.id })),
    [connections],
  );
  const activeConnectionId = connectionId || connectionOptions[0]?.id || "";

  const reset = () => {
    setAddTagDraft("");
    setRemoveTagDraft("");
    setAddTags([]);
    setRemoveTags([]);
    setFavorite(null);
    setSummary(null);
  };

  const commitTag = (raw: string, target: "add" | "remove") => {
    const tag = raw.trim();
    if (!tag) return;
    const setter = target === "add" ? setAddTags : setRemoveTags;
    setter((prev) => (prev.some((existing) => existing.toLowerCase() === tag.toLowerCase()) ? prev : [...prev, tag]));
    if (target === "add") setAddTagDraft("");
    else setRemoveTagDraft("");
  };

  const hasChanges = addTags.length > 0 || removeTags.length > 0 || favorite !== null || summary !== null;

  const handleApply = async () => {
    const changes: BulkCharacterChanges = {};
    if (addTags.length > 0) changes.addTags = addTags;
    if (removeTags.length > 0) changes.removeTags = removeTags;
    if (favorite !== null) changes.favorite = favorite;
    if (summary !== null) changes.summary = summary;

    try {
      const result = await bulkUpdate.mutateAsync({ characterIds: selected.map((card) => card.id), changes });
      toast.success(localize(`Updated ${result.updated} of ${selected.length} characters`));
      reset();
      onApplied();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : localize("Bulk edit failed"));
    }
  };

  /**
   * Summaries are generated one card at a time and written straight to that card, because
   * a shared summary across a multi-card selection would be meaningless.
   * ponytail: sequential requests, batch them if summarising hundreds of cards gets slow.
   */
  const handleGenerateSummaries = async () => {
    if (!activeConnectionId) {
      toast.error(localize("Configure a connection first"));
      return;
    }
    setGenerating(true);
    let succeeded = 0;
    try {
      for (const card of selected) {
        const profile = [
          `Name: ${card.name}`,
          card.tags.length > 0 ? `Tags: ${card.tags.join(", ")}` : "",
          card.description ? `Description: ${card.description.slice(0, 4000)}` : "",
          card.personality ? `Personality: ${card.personality.slice(0, 2000)}` : "",
          card.scenario ? `Scenario: ${card.scenario.slice(0, 2000)}` : "",
        ]
          .filter(Boolean)
          .join("\n");

        try {
          const result = await api.post<{ content?: string }>("/generate/raw", {
            connectionId: activeConnectionId,
            streaming: false,
            messages: [
              { role: "system", content: SUMMARY_SYSTEM_PROMPT },
              { role: "user", content: profile },
            ],
            parameters: { temperature: 0.4, maxTokens: 120 },
          });
          const generated = (result.content ?? "").trim().replace(/^["']|["']$/g, "");
          if (!generated) continue;
          await bulkUpdate.mutateAsync({ characterIds: [card.id], changes: { summary: generated } });
          succeeded++;
        } catch (error) {
          console.warn("[bulk-summary] failed for", card.name, error);
        }
      }

      if (succeeded === 0) toast.error(localize("Could not generate any summaries"));
      else toast.success(localize(`Wrote ${succeeded} of ${selected.length} summaries`));
      onApplied();
    } finally {
      setGenerating(false);
    }
  };

  const busy = bulkUpdate.isPending || generating;

  return (
    <Modal open={open} onClose={onClose} title={localize("Bulk edit characters")} width="max-w-lg">
      <div className="space-y-5 p-5">
        <p className="text-sm text-[var(--marinara-chat-chrome-panel-muted)]">
          {selected.length} {selected.length === 1 ? localize("character selected") : localize("characters selected")}
        </p>

        <datalist id={knownTagsDatalistId}>
          {knownTags.map((tag) => (
            <option key={tag} value={tag} />
          ))}
        </datalist>

        <section>
          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--marinara-chat-chrome-panel-muted)]">
            {localize("Add tags")}
          </label>
          <input
            value={addTagDraft}
            onChange={(event) => setAddTagDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== ",") return;
              event.preventDefault();
              commitTag(addTagDraft, "add");
            }}
            onBlur={() => commitTag(addTagDraft, "add")}
            list={knownTagsDatalistId}
            placeholder={localize("Type a tag and press Enter")}
            className={cn(fieldClass, "mt-2")}
          />
          <TagList tags={addTags} tone="add" onRemove={(tag) => setAddTags((prev) => prev.filter((t) => t !== tag))} />
        </section>

        <section>
          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--marinara-chat-chrome-panel-muted)]">
            {localize("Remove tags")}
          </label>
          <input
            value={removeTagDraft}
            onChange={(event) => setRemoveTagDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== ",") return;
              event.preventDefault();
              commitTag(removeTagDraft, "remove");
            }}
            onBlur={() => commitTag(removeTagDraft, "remove")}
            list={knownTagsDatalistId}
            placeholder={localize("Type a tag and press Enter")}
            className={cn(fieldClass, "mt-2")}
          />
          <TagList
            tags={removeTags}
            tone="remove"
            onRemove={(tag) => setRemoveTags((prev) => prev.filter((t) => t !== tag))}
          />
        </section>

        <section>
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--marinara-chat-chrome-panel-muted)]">
            {localize("Favorite")}
          </span>
          <div className="mt-2 flex gap-2">
            {(
              [
                { value: null, label: localize("Leave as is"), icon: null },
                { value: true, label: localize("Favorite"), icon: <Star size="0.75rem" /> },
                { value: false, label: localize("Unfavorite"), icon: <StarOff size="0.75rem" /> },
              ] as const
            ).map((option) => (
              <button
                key={String(option.value)}
                type="button"
                onClick={() => setFavorite(option.value)}
                className={cn(
                  "mari-chrome-control flex-1 px-3 py-2 text-xs",
                  favorite === option.value && "mari-chrome-control--selected",
                )}
              >
                {option.icon}
                {option.label}
              </button>
            ))}
          </div>
        </section>

        <section>
          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--marinara-chat-chrome-panel-muted)]">
            {localize("Summary")}
          </label>
          <p className="mt-1 text-[0.6875rem] text-[var(--marinara-chat-chrome-panel-muted)]">
            {localize(
              "Shown on the card tile. Applies the same text to every selected character; leave empty and apply to clear it and fall back to the derived summary.",
            )}
          </p>
          <textarea
            value={summary ?? ""}
            onChange={(event) => setSummary(event.target.value)}
            rows={3}
            placeholder={localize("Leave untouched to keep existing summaries")}
            className="mari-chrome-field mt-2 w-full resize-y p-2.5 text-sm"
          />
          {summary !== null && (
            <button
              type="button"
              onClick={() => setSummary(null)}
              className="mt-1 text-[0.6875rem] text-[var(--marinara-chat-chrome-panel-muted)] underline"
            >
              {localize("Don't touch summaries")}
            </button>
          )}
        </section>

        <section className="rounded-2xl border border-[var(--marinara-chat-chrome-panel-border)] p-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--marinara-chat-chrome-panel-muted)]">
            <Sparkles size="0.75rem" /> {localize("Write summaries with AI")}
          </div>
          <p className="mt-1 text-[0.6875rem] text-[var(--marinara-chat-chrome-panel-muted)]">
            {localize("Generates and saves a separate one-line summary per selected character. Runs immediately.")}
          </p>
          <div className="mt-2 flex gap-2">
            <select
              value={activeConnectionId}
              onChange={(event) => setConnectionId(event.target.value)}
              className={cn(fieldClass, "flex-1")}
            >
              {connectionOptions.length === 0 && <option value="">{localize("No connections")}</option>}
              {connectionOptions.map((conn) => (
                <option key={conn.id} value={conn.id}>
                  {conn.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void handleGenerateSummaries()}
              disabled={busy || !activeConnectionId}
              className="mari-chrome-control mari-chrome-control--primary px-3 py-2 text-xs"
            >
              <Sparkles size="0.75rem" />
              {generating ? localize("Writing...") : localize("Generate")}
            </button>
          </div>
        </section>

        <div className="flex gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="mari-chrome-control flex-1 px-3 py-2 text-sm">
            {localize("Cancel")}
          </button>
          <button
            type="button"
            onClick={() => void handleApply()}
            disabled={busy || !hasChanges}
            className="mari-chrome-control mari-chrome-control--primary flex-1 px-3 py-2 text-sm"
          >
            <Tag size="0.875rem" />
            {bulkUpdate.isPending ? localize("Applying...") : localize("Apply to selected")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
