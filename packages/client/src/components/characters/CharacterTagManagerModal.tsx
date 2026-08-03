import { useEffect, useMemo, useState } from "react";
import { Check, Merge, Pencil, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { findTagVariantGroups, type TagUsage } from "@marinara-engine/shared";
import { Modal } from "../ui/Modal";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { fetchAllCharacterPages, useBulkUpdateCharacters } from "../../hooks/use-characters";
import { cn } from "../../lib/utils";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";

type TagIndex = { usage: TagUsage[]; idsByTag: Map<string, string[]> };

const EMPTY_INDEX: TagIndex = { usage: [], idsByTag: new Map() };

function readTags(raw: unknown): string[] {
  if (!raw || typeof raw !== "object") return [];
  const data = (raw as { data?: unknown }).data;
  try {
    const parsed = typeof data === "string" ? JSON.parse(data) : data;
    const tags = (parsed as { tags?: unknown } | null)?.tags;
    return Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === "string" && !!tag.trim()) : [];
  } catch {
    return [];
  }
}

/**
 * Builds the tag index from every character, not just the pages the library has scrolled into
 * view — a tag manager that reported "3 cards" because only 3 were loaded would make renames
 * and deletes silently miss the rest of the library.
 */
function buildTagIndex(characters: Record<string, unknown>[]): TagIndex {
  const idsByTag = new Map<string, string[]>();
  for (const character of characters) {
    const id = typeof character.id === "string" ? character.id : null;
    if (!id) continue;
    for (const tag of readTags(character)) {
      const existing = idsByTag.get(tag);
      if (existing) existing.push(id);
      else idsByTag.set(tag, [id]);
    }
  }

  const usage = [...idsByTag.entries()]
    .map(([tag, ids]) => ({ tag, count: ids.length }))
    .sort((left, right) => right.count - left.count || left.tag.localeCompare(right.tag));
  return { usage, idsByTag };
}

export function CharacterTagManagerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const localize = useLocalizedUiText();
  const bulkUpdate = useBulkUpdateCharacters();

  const [index, setIndex] = useState<TagIndex>(EMPTY_INDEX);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [busyTag, setBusyTag] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      setIndex(buildTagIndex(await fetchAllCharacterPages()));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : localize("Could not load tags"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const variantGroups = useMemo(() => findTagVariantGroups(index.usage), [index.usage]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return index.usage;
    return index.usage.filter((entry) => entry.tag.toLowerCase().includes(query));
  }, [index.usage, search]);

  /** Rename doubles as merge: if the target tag already exists, the two collapse into one. */
  const applyRename = async (from: string, to: string) => {
    const target = to.trim();
    if (!target || target === from) {
      setEditingTag(null);
      return;
    }
    const ids = index.idsByTag.get(from) ?? [];
    if (ids.length === 0) return;

    const mergeTarget = index.usage.find(
      (entry) => entry.tag !== from && entry.tag.toLowerCase() === target.toLowerCase(),
    );
    if (mergeTarget) {
      const confirmed = await showConfirmDialog({
        title: localize("Merge tags"),
        message: localize(
          `"${from}" (${ids.length}) will be merged into the existing tag "${mergeTarget.tag}" (${mergeTarget.count}). This cannot be undone.`,
        ),
        confirmLabel: localize("Merge"),
        tone: "destructive",
      });
      if (!confirmed) return;
    }

    setBusyTag(from);
    try {
      await bulkUpdate.mutateAsync({
        characterIds: ids,
        changes: { addTags: [mergeTarget?.tag ?? target], removeTags: [from] },
      });
      toast.success(
        mergeTarget
          ? localize(`Merged "${from}" into "${mergeTarget.tag}"`)
          : localize(`Renamed "${from}" to "${target}" on ${ids.length} characters`),
      );
      setEditingTag(null);
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : localize("Rename failed"));
    } finally {
      setBusyTag(null);
    }
  };

  const applyDelete = async (tag: string) => {
    const ids = index.idsByTag.get(tag) ?? [];
    const confirmed = await showConfirmDialog({
      title: localize("Delete tag"),
      message: localize(`Remove "${tag}" from ${ids.length} characters? This cannot be undone.`),
      confirmLabel: localize("Delete"),
      tone: "destructive",
    });
    if (!confirmed) return;

    setBusyTag(tag);
    try {
      await bulkUpdate.mutateAsync({ characterIds: ids, changes: { removeTags: [tag] } });
      toast.success(localize(`Removed "${tag}" from ${ids.length} characters`));
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : localize("Delete failed"));
    } finally {
      setBusyTag(null);
    }
  };

  /** Collapses every spelling in a variant group onto the most-used one. */
  const applyMergeGroup = async (group: TagUsage[]) => {
    const [winner, ...losers] = group;
    const confirmed = await showConfirmDialog({
      title: localize("Merge tag spellings"),
      message: localize(
        `Merge ${losers.map((entry) => `"${entry.tag}"`).join(", ")} into "${winner.tag}"? This cannot be undone.`,
      ),
      confirmLabel: localize("Merge"),
      tone: "destructive",
    });
    if (!confirmed) return;

    setBusyTag(winner.tag);
    try {
      // One call per spelling, but failures are collected instead of thrown: a mid-loop failure
      // used to abort the merge and report nothing about which spellings had already collapsed.
      const failed: string[] = [];
      let merged = 0;
      for (const loser of losers) {
        const ids = index.idsByTag.get(loser.tag) ?? [];
        if (ids.length === 0) continue;
        try {
          await bulkUpdate.mutateAsync({
            characterIds: ids,
            changes: { addTags: [winner.tag], removeTags: [loser.tag] },
          });
          merged++;
        } catch {
          failed.push(loser.tag);
        }
      }

      if (merged > 0) toast.success(localize(`Merged ${merged} spellings into "${winner.tag}"`));
      if (failed.length > 0) {
        toast.error(localize(`Could not merge: ${failed.map((tag) => `"${tag}"`).join(", ")}`));
      }
      await reload();
    } finally {
      setBusyTag(null);
    }
  };

  const busy = busyTag !== null || loading;

  return (
    <Modal open={open} onClose={onClose} title={localize("Tag manager")} width="max-w-xl">
      <div className="space-y-4 p-5">
        <p className="text-sm text-[var(--marinara-chat-chrome-panel-muted)]">
          {loading
            ? localize("Loading tags...")
            : localize(`${index.usage.length} tags across your character library`)}
        </p>

        {variantGroups.length > 0 && (
          <section className="rounded-2xl border border-[var(--marinara-chat-chrome-panel-border)] p-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--marinara-chat-chrome-panel-muted)]">
              {localize("Possible duplicates")}
            </h3>
            <p className="mt-1 text-[0.6875rem] text-[var(--marinara-chat-chrome-panel-muted)]">
              {localize("These tags differ only in casing, spacing or hyphens.")}
            </p>
            <div className="mt-2 space-y-2">
              {variantGroups.map((group) => (
                <div key={group[0].tag} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-xs text-[var(--marinara-chat-chrome-panel-text)]">
                    {group.map((entry) => `${entry.tag} (${entry.count})`).join("  ·  ")}
                  </span>
                  <button
                    type="button"
                    onClick={() => void applyMergeGroup(group)}
                    disabled={busy}
                    className="mari-chrome-control mari-chrome-control--primary shrink-0 px-2.5 py-1.5 text-[0.6875rem]"
                    title={localize(`Merge into "${group[0].tag}"`)}
                  >
                    <Merge size="0.6875rem" />
                    {localize("Merge")}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="relative">
          <Search
            size="0.75rem"
            className="mari-chrome-field-icon pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={localize("Search tags")}
            className="mari-chrome-field h-10 w-full pl-7 pr-2.5 text-sm"
          />
        </div>

        <div className="max-h-[22rem] overflow-y-auto rounded-2xl border border-[var(--marinara-chat-chrome-panel-border)]">
          {!loading && filtered.length === 0 && (
            <p className="p-4 text-center text-sm text-[var(--marinara-chat-chrome-panel-muted)]">
              {index.usage.length === 0 ? localize("No tags yet") : localize("No tags match your search")}
            </p>
          )}
          {filtered.map((entry) => {
            const isEditing = editingTag === entry.tag;
            const willMerge =
              isEditing &&
              !!renameDraft.trim() &&
              index.usage.some(
                (other) => other.tag !== entry.tag && other.tag.toLowerCase() === renameDraft.trim().toLowerCase(),
              );

            return (
              <div
                key={entry.tag}
                className="flex items-center gap-2 border-b border-[var(--marinara-chat-chrome-panel-divider)] px-3 py-2 last:border-b-0"
              >
                {isEditing ? (
                  <>
                    <input
                      autoFocus
                      value={renameDraft}
                      onChange={(event) => setRenameDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void applyRename(entry.tag, renameDraft);
                        if (event.key === "Escape") setEditingTag(null);
                      }}
                      className="mari-chrome-field h-9 min-w-0 flex-1 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => void applyRename(entry.tag, renameDraft)}
                      disabled={busy}
                      className="mari-chrome-control mari-chrome-control--primary h-9 w-9 rounded-lg p-0"
                      title={willMerge ? localize("Merge") : localize("Rename")}
                    >
                      {willMerge ? <Merge size="0.75rem" /> : <Check size="0.75rem" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingTag(null)}
                      className="mari-chrome-control h-9 w-9 rounded-lg p-0"
                      title={localize("Cancel")}
                    >
                      <X size="0.75rem" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate text-sm text-[var(--marinara-chat-chrome-panel-text)]">
                      {entry.tag}
                    </span>
                    <span
                      className={cn(
                        "mari-chrome-muted-badge shrink-0 px-2 py-0.5 text-[0.625rem] tabular-nums",
                        busyTag === entry.tag && "opacity-50",
                      )}
                    >
                      {entry.count}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTag(entry.tag);
                        setRenameDraft(entry.tag);
                      }}
                      disabled={busy}
                      className="mari-chrome-control h-8 w-8 shrink-0 rounded-lg p-0"
                      title={localize("Rename or merge")}
                    >
                      <Pencil size="0.6875rem" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void applyDelete(entry.tag)}
                      disabled={busy}
                      className="mari-chrome-control mari-chrome-control--danger h-8 w-8 shrink-0 rounded-lg p-0"
                      title={localize("Delete from every character")}
                    >
                      <Trash2 size="0.6875rem" />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-[0.6875rem] text-[var(--marinara-chat-chrome-panel-muted)]">
          {localize("Renaming a tag to one that already exists merges them.")}
        </p>
      </div>
    </Modal>
  );
}
