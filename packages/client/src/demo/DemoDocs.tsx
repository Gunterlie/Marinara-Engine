import "./demo-docs.css";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Clock,
  CornerDownLeft,
  Link as LinkIcon,
  Menu,
  Pencil,
  Search,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { renderMarkdownBlocks, applyInlineMarkdown } from "../lib/markdown";
import { useCodeBlockCopy } from "../hooks/use-code-block-copy";
import { cn, copyToClipboard } from "../lib/utils";
import { isApplePlatform } from "../lib/command-center";
import { dirLabel } from "../components/modals/DocsViewerModal";
import {
  DOC_CATEGORIES,
  docHref,
  headingSlug,
  loadDemoDocs,
  loadDemoGuide,
  loadDemoIndex,
  prepareDemoDoc,
  searchDemoDocs,
  type DemoDocSummary,
  type DemoSearchHit,
} from "./docs";

const EDIT_ROOT = "https://github.com/Pasta-Devs/Marinara-Engine/edit/staging/docs/";
const GROUPS_KEY = "marinara-demo:docs-open-groups";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]";
const linkClass = `inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent)] ${FOCUS}`;
const CARD =
  "rounded-2xl border border-[color-mix(in_srgb,var(--primary)_18%,var(--border))] bg-[color-mix(in_srgb,var(--primary)_4%,var(--card))]";
const PILL = `inline-flex min-h-11 items-center rounded-full border border-[var(--border)] bg-[var(--background)] px-4 text-sm font-medium hover:bg-[var(--accent)] ${FOCUS}`;
const KBD =
  "rounded border border-[var(--border)] bg-[var(--secondary)] px-1.5 py-0.5 font-mono text-[0.6875rem] text-[var(--muted-foreground)]";

// Start here: the introduction, every install guide, then three popular features.
const START_INTRO = "home/welcome.md";
const START_INSTALL = [
  "installation/windows.md",
  "installation/macos-linux.md",
  "installation/android-termux.md",
  "installation/ios-pwa.md",
  "installation/containers.md",
];
const START_FEATURES = ["agents/agents-overview.md", "lorebooks/overview.md", "game/getting-started.md"];
const SUGGESTED = [
  START_INTRO,
  ...START_INSTALL.slice(0, 2),
  "connections/connecting-to-a-provider.md",
  ...START_FEATURES,
];

const categoryRank = (dir: string) => {
  const rank = (DOC_CATEGORIES as readonly string[]).indexOf(dir);
  return rank === -1 ? DOC_CATEGORIES.length : rank;
};

function readOpenGroups(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(GROUPS_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function writeOpenGroups(groups: string[]) {
  try {
    localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
  } catch {
    // Storage can be denied. The sidebar then forgets its groups on reload.
  }
}

function formatDate(iso: string | undefined) {
  const date = new Date(iso ?? "");
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric" });
}

function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length) return <>{text}</>;
  const pattern = new RegExp(`(${terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return <>{text.split(pattern).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part))}</>;
}

type Group = { dir: string; label: string; docs: DemoDocSummary[] };

function GuideNav({
  groups,
  path,
  openGroups,
  onToggle,
}: {
  groups: Group[];
  path: string;
  openGroups: string[];
  onToggle: (dir: string, open: boolean) => void;
}) {
  const current = path.includes("/") ? path.split("/")[0] : "";
  return (
    <ul className="space-y-1">
      {groups.map((group) => (
        <li key={group.dir || "root"}>
          <details
            open={group.dir === current || openGroups.includes(group.dir)}
            onToggle={(event) => onToggle(group.dir, event.currentTarget.open)}
            className="group/nav"
          >
            <summary
              className={`flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-lg px-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] hover:bg-[var(--accent)] [&::-webkit-details-marker]:hidden ${FOCUS}`}
            >
              <ChevronRight
                size={14}
                aria-hidden="true"
                className="shrink-0 transition-transform group-open/nav:rotate-90 motion-reduce:transition-none"
              />
              <span className="flex-1">{group.label}</span>
              <span className="font-normal tabular-nums">{group.docs.length}</span>
            </summary>
            <ul className="mb-2 ml-[1.1rem] mt-1 space-y-0.5 border-l border-[var(--border)] pl-2">
              {group.docs.map((entry) => (
                <li key={entry.path}>
                  <a
                    href={docHref(entry.path)}
                    aria-current={entry.path === path ? "page" : undefined}
                    className={cn(
                      "block rounded-md px-3 py-2 text-sm leading-snug text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
                      FOCUS,
                      entry.path === path &&
                        "bg-[color-mix(in_srgb,var(--primary)_14%,transparent)] font-semibold text-[var(--foreground)]",
                    )}
                  >
                    {entry.title}
                  </a>
                </li>
              ))}
            </ul>
          </details>
        </li>
      ))}
    </ul>
  );
}

function DocsPalette({ index, onPick }: { index: DemoDocSummary[]; onPick: (href: string) => void }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const deferred = useDeferredValue(query.trim());
  const fullText = deferred.length >= 2;
  const corpus = useQuery({
    queryKey: ["demo-docs", "corpus"],
    queryFn: loadDemoDocs,
    staleTime: Infinity,
    enabled: fullText,
  });
  const terms = useMemo(() => deferred.toLowerCase().split(/\s+/).filter(Boolean), [deferred]);
  const results = useMemo<DemoSearchHit[]>(() => {
    if (fullText && corpus.data) return searchDemoDocs(corpus.data, deferred);
    const lower = deferred.toLowerCase();
    const list = lower
      ? index.filter((entry) => entry.title.toLowerCase().includes(lower))
      : SUGGESTED.flatMap((item) => index.filter((entry) => entry.path === item));
    return list.slice(0, 12).map((entry) => ({ ...entry, section: "", snippet: "" }));
  }, [corpus.data, deferred, fullText, index]);
  const selected = Math.min(active, results.length - 1);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    listRef.current?.querySelector(`#demo-docs-result-${selected}`)?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const status = corpus.isError
    ? t("demo.docs.error")
    : fullText && corpus.isFetching
      ? t("demo.docs.searching")
      : deferred && !results.length
        ? t("demo.docs.noResults")
        : deferred
          ? t("demo.docs.resultCount", { count: results.length })
          : t("demo.docs.suggested");

  return (
    <div className="flex max-h-[min(40rem,80dvh)] flex-col">
      <div className="flex items-center gap-3 border-b border-[var(--border)] px-4">
        <Search size={18} className="shrink-0 text-[var(--muted-foreground)]" aria-hidden="true" />
        <input
          autoFocus
          type="search"
          role="combobox"
          aria-label={t("demo.docs.search")}
          aria-expanded="true"
          aria-controls="demo-docs-results"
          aria-autocomplete="list"
          aria-activedescendant={results.length ? `demo-docs-result-${selected}` : undefined}
          placeholder={t("demo.docs.searchPlaceholder")}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              const step = event.key === "ArrowDown" ? 1 : -1;
              setActive((selected + step + results.length) % Math.max(results.length, 1));
            } else if (event.key === "Enter" && results[selected]) {
              event.preventDefault();
              onPick(docHref(results[selected].path, results[selected].section));
            }
          }}
          className="min-h-14 min-w-0 flex-1 bg-transparent text-base text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)] [&::-webkit-search-cancel-button]:hidden"
        />
        <button
          type="button"
          onClick={() => onPick("")}
          aria-label={t("demo.docs.closeSearch")}
          className={`grid h-9 w-9 place-items-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--accent)] ${FOCUS}`}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <p role="status" className="px-5 pb-1 pt-3 text-xs font-medium text-[var(--muted-foreground)]">
        {status}
      </p>
      <ul
        ref={listRef}
        id="demo-docs-results"
        role="listbox"
        aria-label={t("demo.docs.results")}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2"
      >
        {results.map((hit, i) => (
          <li
            key={`${hit.path}#${hit.section}`}
            id={`demo-docs-result-${i}`}
            role="option"
            aria-selected={i === selected}
            onMouseMove={() => setActive(i)}
            onClick={() => onPick(docHref(hit.path, hit.section))}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5",
              i === selected && "bg-[color-mix(in_srgb,var(--primary)_12%,var(--accent))]",
            )}
          >
            <BookOpen size={16} className="mt-0.5 shrink-0 text-[var(--primary)]" aria-hidden="true" />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-xs text-[var(--muted-foreground)]">{dirLabel(hit.dir, "en")}</span>
              <span className="text-sm font-semibold text-[var(--foreground)]">
                <Highlight text={hit.title} terms={terms} />
              </span>
              {hit.snippet ? (
                <span className="line-clamp-2 text-xs leading-relaxed text-[var(--muted-foreground)]">
                  <Highlight text={hit.snippet} terms={terms} />
                </span>
              ) : null}
            </span>
            {i === selected ? (
              <CornerDownLeft size={14} className="mt-1 shrink-0 text-[var(--muted-foreground)]" aria-hidden="true" />
            ) : null}
          </li>
        ))}
      </ul>
      <p
        aria-hidden="true"
        className="hidden items-center gap-4 border-t border-[var(--border)] px-4 py-2.5 text-xs text-[var(--muted-foreground)] sm:flex"
      >
        <span>
          <kbd className={KBD}>↑</kbd> <kbd className={KBD}>↓</kbd> {t("demo.docs.keyMove")}
        </span>
        <span>
          <kbd className={KBD}>Enter</kbd> {t("demo.docs.keyOpen")}
        </span>
        <span>
          <kbd className={KBD}>Esc</kbd> {t("demo.docs.keyClose")}
        </span>
      </p>
    </div>
  );
}

function SearchTrigger({ onOpen, large = false }: { onOpen: () => void; large?: boolean }) {
  const { t } = useTranslation();
  const shortcut = isApplePlatform() ? "⌘K" : "Ctrl K";
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-keyshortcuts="Control+K Meta+K /"
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] text-left text-[var(--muted-foreground)] shadow-sm transition-colors hover:border-[color-mix(in_srgb,var(--primary)_45%,var(--border))] motion-reduce:transition-none",
        FOCUS,
        large ? "min-h-14 px-4 text-base" : "min-h-11 px-3 text-sm",
      )}
    >
      <Search size={large ? 18 : 16} aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{t(large ? "demo.docs.search" : "demo.docs.searchShort")}</span>
      <kbd className={KBD}>{shortcut}</kbd>
    </button>
  );
}

export function DemoDocs({ path, section }: { path: string; section: string }) {
  const { t } = useTranslation();
  const index = useQuery({ queryKey: ["demo-docs", "index"], queryFn: loadDemoIndex, staleTime: Infinity });
  const current = path ? index.data?.find((entry) => entry.path === path) : undefined;
  const guide = useQuery({
    queryKey: ["demo-docs", "guide", path],
    queryFn: () => loadDemoGuide(path),
    staleTime: Infinity,
    enabled: !!current,
  });
  const [copyStatus, setCopyStatus] = useState("");
  const [reader, setReader] = useState<HTMLElement | null>(null);
  const [contents, setContents] = useState<{ id: string; title: string; level: number }[]>([]);
  const [activeId, setActiveId] = useState("");
  const [openGroups, setOpenGroups] = useState(readOpenGroups);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const paletteRef = useRef<HTMLDialogElement>(null);
  const drawerRef = useRef<HTMLDialogElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const tocRef = useRef<HTMLDetailsElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const rendered = useMemo(
    () =>
      guide.data && current
        ? renderMarkdownBlocks(prepareDemoDoc(guide.data, current.path), applyInlineMarkdown, "demo-docs")
        : null,
    [guide.data, current],
  );
  useCodeBlockCopy(reader, rendered);

  const openPalette = useCallback(() => {
    setPaletteOpen(true);
    const dialog = paletteRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  const pick = useCallback((href: string) => {
    paletteRef.current?.close();
    if (href) window.location.hash = href;
  }, []);
  const toggleGroup = useCallback((dir: string, open: boolean) => {
    setOpenGroups((groups) => {
      if (open === groups.includes(dir)) return groups;
      const next = open ? [...groups, dir] : groups.filter((item) => item !== dir);
      writeOpenGroups(next);
      return next;
    });
  }, []);

  // Ctrl/Cmd+K and "/" open the docs search while this page is on screen. Capture runs before the app omnibar.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing = (event.target as HTMLElement | null)?.closest?.(
        "input, textarea, select, [contenteditable='true']",
      );
      const modK = (event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "k";
      const slash = event.key === "/" && !typing && !event.metaKey && !event.ctrlKey && !event.altKey;
      if (!modK && !slash) return;
      event.preventDefault();
      event.stopPropagation();
      openPalette();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [openPalette]);

  // Headings get stable ids, h2/h3 get a copy-link anchor, and Note/Tip/Warning quotes become callouts.
  useEffect(() => {
    if (!reader || !rendered) return;
    const counts = new Map<string, number>();
    const items = [...reader.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6")].map((heading) => {
      heading.querySelector(".demo-docs-anchor")?.remove();
      const title = heading.textContent?.trim() ?? "";
      const slug = headingSlug(title);
      const n = counts.get(slug) ?? 0;
      counts.set(slug, n + 1);
      const id = slug + (n ? `-${n}` : "");
      const level = Number(heading.tagName[1]);
      heading.id = id;
      heading.tabIndex = -1;
      if (level === 2 || level === 3) {
        const anchor = document.createElement("a");
        anchor.href = docHref(path, id);
        anchor.className = "demo-docs-anchor";
        anchor.textContent = "#";
        anchor.setAttribute("aria-label", t("demo.docs.sectionLink", { title }));
        heading.append(anchor);
      }
      return { id, title, level };
    });
    setContents(items.filter((item) => item.level === 2 || item.level === 3));
    for (const anchor of reader.querySelectorAll<HTMLAnchorElement>('a[href^="#/docs/"]')) {
      anchor.removeAttribute("target");
    }
    for (const quote of reader.querySelectorAll<HTMLElement>("blockquote")) {
      const kind = quote.textContent
        ?.trim()
        .match(/^\[?!?(note|tip|info|warning|caution|important)\b/i)?.[1]
        ?.toLowerCase();
      if (kind) quote.dataset.callout = kind;
    }
  }, [reader, rendered, path, t]);

  useEffect(
    () => () => {
      document.title = "Marinara Engine";
    },
    [],
  );

  useEffect(() => {
    document.title = `${current ? current.title : t("demo.docs.title")} · Marinara Engine`;
    if (!reader || !rendered) return;
    const target = section
      ? [...reader.querySelectorAll<HTMLElement>("[id]")].find((node) => node.id === section)
      : null;
    if (target) {
      target.scrollIntoView({ block: "start" });
      target.focus({ preventScroll: true });
    } else {
      reader.closest('[data-testid="demo-docs"]')?.scrollTo({ top: 0 });
      (headingRef.current ?? reader.querySelector<HTMLElement>("h1"))?.focus({ preventScroll: true });
    }
  }, [reader, rendered, section, current, t]);

  // Scrollspy: the table of contents marks the last heading that passed the top of the page.
  useEffect(() => {
    if (!reader || contents.length < 2) return;
    const root = reader.closest<HTMLElement>('[data-testid="demo-docs"]');
    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries.find((entry) => entry.isIntersecting);
        if (hit) setActiveId(hit.target.id);
      },
      { root, rootMargin: "0px 0px -70% 0px" },
    );
    for (const item of contents) {
      const node = reader.querySelector(`[id="${CSS.escape(item.id)}"]`);
      if (node) observer.observe(node);
    }
    return () => observer.disconnect();
  }, [reader, contents]);

  // Keep the current guide visible in a long sidebar.
  useEffect(() => {
    const nav = sidebarRef.current;
    const link = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (nav && link) nav.scrollTop = link.offsetTop - nav.clientHeight / 3;
  }, [path, index.data]);

  // Guides grouped by category, in the order of the product areas.
  const groups = useMemo<Group[]>(() => {
    const byDir = new Map<string, DemoDocSummary[]>();
    for (const entry of index.data ?? []) byDir.set(entry.dir, [...(byDir.get(entry.dir) ?? []), entry]);
    return [...byDir]
      .sort(([a], [b]) => categoryRank(a) - categoryRank(b))
      .map(([dir, docs]) => ({ dir, label: dirLabel(dir, "en"), docs }));
  }, [index.data]);
  const ordered = useMemo(() => groups.flatMap((group) => group.docs), [groups]);
  const byPath = useMemo(() => new Map(ordered.map((entry) => [entry.path, entry])), [ordered]);
  const position = ordered.findIndex((entry) => entry.path === path);
  const previous = position > 0 ? ordered[position - 1] : null;
  const next = position >= 0 ? (ordered[position + 1] ?? null) : null;
  const related = useMemo(() => {
    const docs = groups.find((group) => group.dir === current?.dir)?.docs ?? [];
    const at = docs.findIndex((entry) => entry.path === path);
    return [...docs.slice(at + 1), ...docs.slice(0, at)]
      .filter((entry) => entry.path !== path && entry.path !== next?.path)
      .slice(0, 3);
  }, [groups, current, path, next]);

  const status =
    index.isLoading || guide.isLoading ? (
      <p role="status" className="py-4 text-sm">
        {t("demo.docs.loading")}
      </p>
    ) : index.isError || guide.isError ? (
      <div role="alert" className="py-4 text-sm">
        <p>{t("demo.docs.error")}</p>
        <button
          type="button"
          className={linkClass}
          onClick={() => {
            void index.refetch();
            if (current) void guide.refetch();
          }}
        >
          {t("demo.docs.retry")}
        </button>
      </div>
    ) : null;

  const toc = (onPick?: () => void) => (
    <ul className="space-y-0.5" onClick={onPick}>
      {contents.map((item) => (
        <li key={item.id}>
          <a
            href={docHref(path, item.id)}
            aria-current={item.id === activeId ? "location" : undefined}
            className={cn(
              "block rounded-md border-l-2 border-transparent py-1.5 pr-2 text-sm leading-snug text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
              FOCUS,
              item.level === 3 ? "pl-6" : "pl-3",
              item.id === activeId && "border-[var(--primary)] font-medium text-[var(--foreground)]",
            )}
          >
            {item.title}
          </a>
        </li>
      ))}
    </ul>
  );

  const guideLink = (entry: DemoDocSummary) => (
    <a
      href={docHref(entry.path)}
      className={`block min-h-11 rounded-lg px-3 py-2.5 text-sm hover:bg-[var(--accent)] ${FOCUS}`}
    >
      {entry.title}
    </a>
  );

  const updated = formatDate(current?.updatedAt);

  return (
    <section
      data-testid="demo-docs"
      className="min-h-0 flex-1 overflow-y-auto bg-[var(--background)] text-[var(--foreground)] [[data-demo-site]_&]:pt-12"
    >
      <dialog
        ref={paletteRef}
        aria-label={t("demo.docs.search")}
        onClose={() => setPaletteOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) paletteRef.current?.close();
        }}
        className="demo-docs-palette mx-auto mt-[8vh] w-[min(42rem,calc(100vw-1.5rem))] max-w-none overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] p-0 text-[var(--foreground)] shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
      >
        {paletteOpen ? <DocsPalette index={index.data ?? []} onPick={pick} /> : null}
      </dialog>

      <dialog
        ref={drawerRef}
        aria-label={t("demo.docs.navigation")}
        onClick={(event) => {
          const target = event.target as HTMLElement;
          if (target === event.currentTarget || target.closest("a")) drawerRef.current?.close();
        }}
        className="demo-docs-drawer m-0 h-dvh max-h-dvh w-[min(20rem,88vw)] max-w-none overflow-y-auto border-r border-[var(--border)] bg-[var(--background)] p-0 text-[var(--foreground)] backdrop:bg-black/50"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--background)] px-3 py-2">
          <span className="px-2 text-sm font-semibold">{t("demo.docs.guides")}</span>
          <button
            type="button"
            onClick={() => drawerRef.current?.close()}
            aria-label={t("demo.docs.closeMenu")}
            className={`grid h-11 w-11 place-items-center rounded-lg hover:bg-[var(--accent)] ${FOCUS}`}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <nav aria-label={t("demo.docs.navigation")} className="p-3">
          <a href="#/docs" className={`${linkClass} mb-2 w-full`}>
            <BookOpen size={16} aria-hidden="true" />
            {t("demo.docs.home")}
          </a>
          <GuideNav groups={groups} path={path} openGroups={openGroups} onToggle={toggleGroup} />
        </nav>
      </dialog>

      <div className="mx-auto max-w-[75rem] px-4 pb-16 pt-6 sm:px-8">
        {!path ? (
          <>
            <header className="relative flex flex-col gap-6 overflow-hidden rounded-3xl border border-[var(--border)] bg-[radial-gradient(70%_90%_at_10%_0%,color-mix(in_srgb,var(--primary)_16%,transparent),transparent_70%),var(--card)] p-6 sm:p-10">
              <div className="flex items-start gap-3">
                <BookOpen className="mt-1.5 shrink-0 text-[var(--primary)]" size={28} aria-hidden="true" />
                <div>
                  <h1
                    ref={headingRef}
                    tabIndex={-1}
                    className="text-balance text-3xl font-bold tracking-tight outline-none sm:text-4xl"
                  >
                    {t("demo.docs.title")}
                  </h1>
                  <p className="mt-2 max-w-[60ch] text-pretty text-sm text-[var(--muted-foreground)] sm:text-base">
                    {t("demo.docs.subtitle")}
                  </p>
                </div>
              </div>
              <div className="max-w-xl">
                <SearchTrigger onOpen={openPalette} large />
              </div>
            </header>
            {status}
            {index.data ? (
              <>
                <section aria-labelledby="demo-docs-start" className={`${CARD} mt-8 p-5 sm:p-7`}>
                  <h2 id="demo-docs-start" className="text-xl font-bold sm:text-2xl">
                    {t("demo.docs.startTitle")}
                  </h2>
                  <p className="mt-2 max-w-[60ch] text-sm text-[var(--muted-foreground)]">{t("demo.docs.startBody")}</p>
                  <a
                    href={docHref(START_INTRO)}
                    className={`mt-5 flex min-h-11 items-center justify-between gap-3 rounded-xl bg-[var(--primary)] px-4 py-3 font-semibold text-[var(--primary-foreground)] hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]`}
                  >
                    {byPath.get(START_INTRO)?.title ?? t("demo.docs.start")}
                    <ArrowRight size={16} aria-hidden="true" />
                  </a>
                  <h3 className="mt-6 text-sm font-semibold">{t("demo.docs.startInstall")}</h3>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {START_INSTALL.filter((item) => byPath.has(item)).map((item) => (
                      <li key={item}>
                        <a href={docHref(item)} className={PILL}>
                          {byPath.get(item)?.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                  <h3 className="mt-6 text-sm font-semibold">{t("demo.docs.startFeatures")}</h3>
                  <ul className="mt-2 grid gap-2 sm:grid-cols-3">
                    {START_FEATURES.filter((item) => byPath.has(item)).map((item) => (
                      <li key={item}>
                        <a
                          href={docHref(item)}
                          className={`flex min-h-11 h-full flex-col justify-center rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 hover:bg-[var(--accent)] ${FOCUS}`}
                        >
                          <span className="text-xs text-[var(--muted-foreground)]">
                            {dirLabel(byPath.get(item)?.dir ?? "", "en")}
                          </span>
                          <span className="text-sm font-semibold">{byPath.get(item)?.title}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
                <h2 className="mt-10 text-xl font-bold">{t("demo.docs.allGuides")}</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {groups.map((group) => (
                    <section key={group.dir || "root"} aria-label={group.label} className={`${CARD} flex flex-col p-3`}>
                      <h3 className="flex items-baseline justify-between gap-2 px-3 pb-1 pt-2 text-base font-semibold">
                        {group.label}
                        <span className="text-xs font-normal text-[var(--muted-foreground)]">
                          {t("demo.docs.guideCount", { count: group.docs.length })}
                        </span>
                      </h3>
                      <ul>
                        {group.docs.map((entry) => (
                          <li key={entry.path}>{guideLink(entry)}</li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              </>
            ) : null}
          </>
        ) : (
          <div className="grid min-w-0 gap-8 lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)_13rem]">
            <aside
              ref={sidebarRef}
              aria-label={t("demo.docs.guides")}
              className="relative hidden lg:sticky lg:top-0 lg:block lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto lg:overscroll-contain [[data-demo-site]_&]:lg:max-h-[calc(100dvh-5rem)]"
            >
              <div className="sticky top-0 z-10 bg-[var(--background)] pb-3">
                <SearchTrigger onOpen={openPalette} />
              </div>
              <nav aria-label={t("demo.docs.navigation")}>
                <a href="#/docs" className={`${linkClass} mb-1 w-full`}>
                  <BookOpen size={16} aria-hidden="true" />
                  {t("demo.docs.home")}
                </a>
                <GuideNav groups={groups} path={path} openGroups={openGroups} onToggle={toggleGroup} />
              </nav>
            </aside>

            <div className="min-w-0">
              <a
                href={docHref(path)}
                onClick={(event) => {
                  event.preventDefault();
                  reader?.querySelector<HTMLElement>("h1")?.focus();
                }}
                className="sr-only focus:not-sr-only focus:mb-2 focus:inline-flex focus:rounded-lg focus:bg-[var(--card)] focus:px-3 focus:py-2 focus:text-sm focus:font-semibold"
              >
                {t("demo.docs.skip")}
              </a>

              <div className="sticky top-0 z-20 -mx-4 mb-4 flex min-h-14 items-center gap-1 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_90%,transparent)] px-2 backdrop-blur-md sm:-mx-6 sm:px-4 lg:-mx-0 lg:rounded-xl lg:border xl:hidden">
                <button
                  type="button"
                  onClick={() => drawerRef.current?.showModal()}
                  aria-label={t("demo.docs.openMenu")}
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg hover:bg-[var(--accent)] lg:hidden ${FOCUS}`}
                >
                  <Menu size={18} aria-hidden="true" />
                </button>
                <span className="min-w-0 flex-1 truncate px-1 text-sm font-semibold">{current?.title}</span>
                {contents.length > 1 ? (
                  <details ref={tocRef} data-testid="demo-docs-toc">
                    <summary
                      className={`flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-lg px-3 text-sm font-medium hover:bg-[var(--accent)] [&::-webkit-details-marker]:hidden ${FOCUS}`}
                    >
                      {t("demo.docs.onThisPage")}
                      <ChevronDown size={14} aria-hidden="true" />
                    </summary>
                    <div className="absolute inset-x-2 top-full mt-2 max-h-[60dvh] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--background)] p-2 shadow-xl sm:left-auto sm:w-80">
                      {toc(() => tocRef.current?.removeAttribute("open"))}
                    </div>
                  </details>
                ) : null}
                <button
                  type="button"
                  onClick={openPalette}
                  aria-label={t("demo.docs.search")}
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg hover:bg-[var(--accent)] lg:hidden ${FOCUS}`}
                >
                  <Search size={18} aria-hidden="true" />
                </button>
              </div>

              <div className="mx-auto max-w-[72ch]">
                <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
                  <nav aria-label={t("demo.docs.breadcrumb")}>
                    <ol className="flex flex-wrap items-center gap-1 text-sm text-[var(--muted-foreground)]">
                      <li>
                        <a href="#/docs" className={`${linkClass} -ml-3 text-[var(--muted-foreground)]`}>
                          <ArrowLeft size={16} aria-hidden="true" />
                          {t("demo.docs.allGuides")}
                        </a>
                      </li>
                      {current ? (
                        <>
                          <li aria-hidden="true">/</li>
                          <li>{dirLabel(current.dir, "en")}</li>
                        </>
                      ) : null}
                    </ol>
                  </nav>
                  {current ? (
                    <a
                      href={docHref(path, section)}
                      className={linkClass}
                      onClick={async (event) => {
                        event.preventDefault();
                        const copied = await copyToClipboard(
                          new URL(docHref(path, section), window.location.href).href,
                        );
                        setCopyStatus(t(copied ? "demo.docs.copied" : "demo.docs.copyFailed"));
                      }}
                    >
                      <LinkIcon size={16} aria-hidden="true" />
                      {t("demo.docs.copyLink")}
                    </a>
                  ) : null}
                </div>
                <p role="status" className="text-sm text-[var(--muted-foreground)] empty:hidden">
                  {copyStatus}
                </p>
                {status}
                {index.data && !current ? (
                  <div role="alert" className="py-4">
                    <h1 ref={headingRef} tabIndex={-1} className="text-xl font-semibold outline-none">
                      {t("demo.docs.notFound")}
                    </h1>
                    <p className="mt-2 text-sm text-[var(--muted-foreground)]">{t("demo.docs.notFoundHint")}</p>
                    <a href="#/docs" className={`${linkClass} -ml-3 mt-2`}>
                      <ArrowLeft size={16} aria-hidden="true" />
                      {t("demo.docs.allGuides")}
                    </a>
                  </div>
                ) : null}
                {current && rendered ? (
                  <>
                    <p className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--muted-foreground)]">
                      {current.minutes ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Clock size={14} aria-hidden="true" />
                          {t("demo.docs.minutes", { count: current.minutes })}
                        </span>
                      ) : null}
                      {updated ? <span>{t("demo.docs.updated", { date: updated })}</span> : null}
                      <a
                        href={EDIT_ROOT + current.path}
                        target="_blank"
                        rel="noreferrer"
                        className={`inline-flex min-h-8 items-center gap-1.5 rounded hover:text-[var(--foreground)] hover:underline ${FOCUS}`}
                      >
                        <Pencil size={14} aria-hidden="true" />
                        {t("demo.docs.edit")}
                      </a>
                    </p>
                    <article
                      key={`${current.path}:${current.updatedAt}`}
                      ref={setReader}
                      data-testid="demo-doc-article"
                      className="mari-message-content docs-reader-content demo-docs-reader break-words"
                      onClick={(event) => {
                        const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#/docs/"]');
                        if (
                          !anchor ||
                          event.ctrlKey ||
                          event.metaKey ||
                          event.shiftKey ||
                          event.altKey ||
                          event.button !== 0
                        )
                          return;
                        event.preventDefault();
                        const href = anchor.getAttribute("href")!;
                        if (anchor.classList.contains("demo-docs-anchor")) {
                          void copyToClipboard(new URL(href, window.location.href).href).then((copied) =>
                            setCopyStatus(t(copied ? "demo.docs.copied" : "demo.docs.copyFailed")),
                          );
                        }
                        window.location.hash = href;
                      }}
                    >
                      {rendered}
                    </article>

                    {related.length ? (
                      <section aria-labelledby="demo-docs-related" className="mt-12">
                        <h2 id="demo-docs-related" className="text-sm font-semibold">
                          {t("demo.docs.related")}
                        </h2>
                        <ul className="mt-3 grid gap-2 sm:grid-cols-3">
                          {related.map((entry) => (
                            <li key={entry.path}>
                              <a
                                href={docHref(entry.path)}
                                className={`${CARD} flex h-full min-h-11 flex-col gap-1 p-3 hover:bg-[var(--accent)] ${FOCUS}`}
                              >
                                <span className="text-sm font-semibold">{entry.title}</span>
                                {entry.minutes ? (
                                  <span className="text-xs text-[var(--muted-foreground)]">
                                    {t("demo.docs.minutes", { count: entry.minutes })}
                                  </span>
                                ) : null}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ) : null}

                    <nav
                      aria-label={t("demo.docs.pager")}
                      className="mt-10 grid gap-3 border-t border-[var(--border)] pt-6 sm:grid-cols-2"
                    >
                      {previous ? (
                        <a
                          href={docHref(previous.path)}
                          className={`${CARD} flex min-h-11 flex-col px-4 py-3 hover:bg-[var(--accent)] ${FOCUS}`}
                        >
                          <span className="flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
                            <ArrowLeft size={14} aria-hidden="true" />
                            {t("demo.docs.previous")}
                          </span>
                          <span className="text-sm font-semibold">{previous.title}</span>
                        </a>
                      ) : (
                        <span />
                      )}
                      {next ? (
                        <a
                          href={docHref(next.path)}
                          className={`${CARD} flex min-h-11 flex-col items-end px-4 py-3 text-end hover:bg-[var(--accent)] ${FOCUS}`}
                        >
                          <span className="flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
                            {t("demo.docs.next")}
                            <ArrowRight size={14} aria-hidden="true" />
                          </span>
                          <span className="text-sm font-semibold">{next.title}</span>
                        </a>
                      ) : null}
                    </nav>
                  </>
                ) : null}
              </div>
            </div>

            {contents.length > 1 ? (
              <aside
                aria-label={t("demo.docs.onThisPage")}
                className="hidden xl:sticky xl:top-0 xl:block xl:max-h-[calc(100dvh-2rem)] xl:overflow-y-auto [[data-demo-site]_&]:xl:max-h-[calc(100dvh-5rem)]"
              >
                <h2 className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                  {t("demo.docs.onThisPage")}
                </h2>
                {toc()}
              </aside>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
