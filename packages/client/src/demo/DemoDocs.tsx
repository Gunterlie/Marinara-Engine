import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Link as LinkIcon, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDocContent, useDocsIndex, useDocsSearch, type DocSummary } from "../hooks/use-docs";
import { renderMarkdownBlocks, applyInlineMarkdown } from "../lib/markdown";
import { useCodeBlockCopy } from "../hooks/use-code-block-copy";
import { copyToClipboard } from "../lib/utils";
import { dirLabel } from "../components/modals/DocsViewerModal";
import { DOC_CATEGORIES, docHref, headingSlug, prepareDemoDoc } from "./docs";

const linkClass =
  "inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent)] focus-visible:outline-2 focus-visible:outline-[var(--ring)]";
const CARD =
  "rounded-2xl border border-[color-mix(in_srgb,var(--primary)_18%,var(--border))] bg-[color-mix(in_srgb,var(--primary)_4%,var(--card))]";
const PILL =
  "inline-flex min-h-11 items-center rounded-full border border-[var(--border)] bg-[var(--background)] px-4 text-sm font-medium hover:bg-[var(--accent)] focus-visible:outline-2 focus-visible:outline-[var(--ring)]";

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

const categoryRank = (dir: string) => {
  const rank = (DOC_CATEGORIES as readonly string[]).indexOf(dir);
  return rank === -1 ? DOC_CATEGORIES.length : rank;
};

function SearchBox({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useTranslation();
  return (
    <div>
      <label className="mb-2 block text-sm font-medium" htmlFor="demo-docs-search">
        {t("demo.docs.search")}
      </label>
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute start-3 top-3.5 text-[var(--muted-foreground)]"
          aria-hidden="true"
        />
        <input
          id="demo-docs-search"
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] ps-9 pe-3 text-sm focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
        />
      </div>
    </div>
  );
}

export function DemoDocs({ path, section }: { path: string; section: string }) {
  const { t } = useTranslation();
  const index = useDocsIndex();
  const doc = useDocContent(path || null);
  const [query, setQuery] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const search = useDocsSearch(searchTerm);
  const [reader, setReader] = useState<HTMLElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [contents, setContents] = useState<{ id: string; title: string }[]>([]);
  const rendered = useMemo(
    () =>
      doc.data
        ? renderMarkdownBlocks(prepareDemoDoc(doc.data.content, doc.data.path), applyInlineMarkdown, "demo-docs")
        : null,
    [doc.data],
  );
  useCodeBlockCopy(reader, rendered);

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!reader || !rendered) return;
    const counts = new Map<string, number>();
    const items = [...reader.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6")].map((heading) => {
      const title = heading.textContent ?? "";
      const slug = headingSlug(title);
      const n = counts.get(slug) ?? 0;
      counts.set(slug, n + 1);
      const id = slug + (n ? `-${n}` : "");
      heading.id = id;
      heading.tabIndex = -1;
      return { id, title };
    });
    setContents(items);
    for (const anchor of reader.querySelectorAll<HTMLAnchorElement>('a[href^="#/docs/"]')) {
      anchor.removeAttribute("target");
    }
  }, [reader, rendered]);

  useEffect(
    () => () => {
      document.title = "Marinara Engine";
    },
    [],
  );

  useEffect(() => {
    document.title = `${doc.data ? doc.data.title : t("demo.docs.title")} · Marinara Engine`;
    if (!reader || !rendered) return;
    const target = section
      ? [...reader.querySelectorAll<HTMLElement>("[id]")].find((node) => node.id === section)
      : null;
    if (target) {
      target.scrollIntoView({ block: "start" });
      target.focus({ preventScroll: true });
    } else {
      reader.closest("[data-testid=demo-docs]")?.scrollTo({ top: 0 });
      (headingRef.current ?? reader.querySelector<HTMLElement>("h1"))?.focus({ preventScroll: true });
    }
  }, [reader, rendered, section, path, doc.data, t]);

  // Guides grouped by category, in the order of the product areas.
  const groups = useMemo(() => {
    const byDir = new Map<string, DocSummary[]>();
    for (const entry of index.data?.docs ?? []) byDir.set(entry.dir, [...(byDir.get(entry.dir) ?? []), entry]);
    return [...byDir]
      .sort(([a], [b]) => categoryRank(a) - categoryRank(b))
      .map(([dir, docs]) => ({ dir, label: dirLabel(dir, "en"), docs }));
  }, [index.data]);
  const ordered = useMemo(() => groups.flatMap((group) => group.docs), [groups]);
  const byPath = useMemo(() => new Map(ordered.map((entry) => [entry.path, entry])), [ordered]);
  const position = ordered.findIndex((entry) => entry.path === path);
  const previous = position > 0 ? ordered[position - 1] : null;
  const next = position >= 0 ? ordered[position + 1] : null;
  const current = byPath.get(path);

  const searching = searchTerm.length >= 2;
  const isError = index.isError || (searching && search.isError);
  const status = (
    <>
      {index.isLoading || (searching && search.isFetching) ? (
        <p role="status" className="py-4 text-sm">
          {t("demo.docs.loading")}
        </p>
      ) : null}
      {isError ? (
        <div role="alert" className="py-4 text-sm">
          <p>{t("demo.docs.error")}</p>
          <button
            type="button"
            className={linkClass}
            onClick={() => {
              void index.refetch();
              if (searching) void search.refetch();
            }}
          >
            {t("demo.docs.retry")}
          </button>
        </div>
      ) : null}
    </>
  );

  const guideLink = (entry: DocSummary, className = "") => (
    <a
      href={docHref(entry.path)}
      aria-current={entry.path === path ? "page" : undefined}
      className={`block min-h-11 rounded-lg px-3 py-2.5 text-sm hover:bg-[var(--accent)] focus-visible:outline-2 focus-visible:outline-[var(--ring)] ${
        entry.path === path ? "bg-[var(--accent)] font-semibold" : ""
      } ${className}`}
    >
      {entry.title}
    </a>
  );

  const searchResults = searching ? (
    search.data?.results.length === 0 ? (
      <p role="status" className="py-4 text-sm text-[var(--muted-foreground)]">
        {t("demo.docs.noResults")}
      </p>
    ) : (
      <ul className="mt-4 space-y-1">
        {search.data?.results.map((entry) => (
          <li key={entry.path}>
            <a
              href={docHref(entry.path)}
              className="block min-h-11 rounded-lg px-3 py-2.5 text-sm hover:bg-[var(--accent)] focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
            >
              <span className="block font-medium">{entry.title}</span>
              <span className="block text-xs text-[var(--muted-foreground)]">{dirLabel(entry.dir, "en")}</span>
            </a>
          </li>
        ))}
      </ul>
    )
  ) : null;

  const toc = (
    <ul className="space-y-0.5">
      {contents.map((item) => (
        <li key={item.id}>
          <a
            href={docHref(path, item.id)}
            className="block rounded-md px-2 py-1.5 text-sm text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
          >
            {item.title}
          </a>
        </li>
      ))}
    </ul>
  );

  return (
    <section
      data-testid="demo-docs"
      className="min-h-0 flex-1 overflow-y-auto bg-[var(--background)] text-[var(--foreground)]"
    >
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        {!path ? (
          <>
            <header className="flex flex-col gap-6 border-b border-[var(--border)] pb-8">
              <div className="flex items-start gap-3">
                <BookOpen className="mt-1 shrink-0 text-[var(--primary)]" size={28} aria-hidden="true" />
                <div>
                  <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-bold tracking-tight sm:text-4xl">
                    {t("demo.docs.title")}
                  </h1>
                  <p className="mt-2 max-w-[60ch] text-sm text-[var(--muted-foreground)] sm:text-base">
                    {t("demo.docs.subtitle")}
                  </p>
                </div>
              </div>
              <div className="max-w-xl">
                <SearchBox value={query} onChange={setQuery} />
              </div>
            </header>
            {status}
            {searching ? (
              searchResults
            ) : (
              <>
                <section aria-labelledby="demo-docs-start" className={`${CARD} mt-8 p-5 sm:p-7`}>
                  <h2 id="demo-docs-start" className="text-xl font-bold sm:text-2xl">
                    {t("demo.docs.startTitle")}
                  </h2>
                  <p className="mt-2 max-w-[60ch] text-sm text-[var(--muted-foreground)]">{t("demo.docs.startBody")}</p>
                  <a
                    href={docHref(START_INTRO)}
                    className="mt-5 flex min-h-11 items-center justify-between gap-3 rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-[var(--primary-foreground)] hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
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
                          className="flex min-h-11 h-full flex-col justify-center rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 hover:bg-[var(--accent)] focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
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
                    <section key={group.dir || "root"} aria-label={group.label} className={`${CARD} p-3`}>
                      <h3 className="px-3 pb-1 pt-2 text-base font-semibold">{group.label}</h3>
                      <ul>
                        {group.docs.map((entry) => (
                          <li key={entry.path}>{guideLink(entry)}</li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="grid min-w-0 gap-8 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)_13rem]">
            <aside
              aria-label={t("demo.docs.guides")}
              className="hidden lg:sticky lg:top-0 lg:block lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto"
            >
              <SearchBox value={query} onChange={setQuery} />
              {status}
              {searching ? (
                searchResults
              ) : (
                <nav aria-label={t("demo.docs.navigation")} className="mt-4 space-y-4">
                  {groups.map((group) => (
                    <div key={group.dir || "root"}>
                      <h2 className="px-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                        {group.label}
                      </h2>
                      <ul className="mt-1">
                        {group.docs.map((entry) => (
                          <li key={entry.path}>{guideLink(entry, "!min-h-9 !py-2")}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </nav>
              )}
            </aside>
            <div className="min-w-0">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
                <nav aria-label={t("demo.docs.navigation")} className="flex flex-wrap items-center gap-1 text-sm">
                  <a href={docHref()} className={linkClass}>
                    <ArrowLeft size={16} aria-hidden="true" />
                    {t("demo.docs.allGuides")}
                  </a>
                  {current ? (
                    <span className="text-[var(--muted-foreground)]">/ {dirLabel(current.dir, "en")}</span>
                  ) : null}
                </nav>
                {doc.data ? (
                  <a
                    href={docHref(path, section)}
                    className={linkClass}
                    onClick={async (event) => {
                      event.preventDefault();
                      const copied = await copyToClipboard(new URL(docHref(path, section), window.location.href).href);
                      setCopyStatus(t(copied ? "demo.docs.copied" : "demo.docs.copyFailed"));
                    }}
                  >
                    <LinkIcon size={16} aria-hidden="true" />
                    {t("demo.docs.copyLink")}
                  </a>
                ) : null}
              </div>
              <p role="status" className="text-sm text-[var(--muted-foreground)]">
                {copyStatus}
              </p>
              {doc.isLoading ? (
                <p role="status">{t("demo.docs.loading")}</p>
              ) : doc.isError ? (
                <div role="alert">
                  <h1 ref={headingRef} tabIndex={-1} className="text-xl font-semibold">
                    {t("demo.docs.notFound")}
                  </h1>
                  <p className="mt-2 text-sm text-[var(--muted-foreground)]">{t("demo.docs.notFoundHint")}</p>
                  <button type="button" onClick={() => void doc.refetch()} className={linkClass}>
                    {t("demo.docs.retry")}
                  </button>
                </div>
              ) : null}
              {doc.data ? (
                <>
                  {contents.length > 1 ? (
                    <details
                      data-testid="demo-docs-toc"
                      className="mb-6 border-y border-[var(--border)] py-3 xl:hidden"
                    >
                      <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">
                        {t("demo.docs.onThisPage")}
                      </summary>
                      <div className="pb-3">{toc}</div>
                    </details>
                  ) : null}
                  <article
                    key={`${doc.data.path}:${doc.data.updatedAt}`}
                    ref={setReader}
                    data-testid="demo-doc-article"
                    className="mari-message-content docs-reader-content mx-auto max-w-[72ch] break-words text-[0.9375rem] leading-relaxed [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_.mari-md-codeblock]:whitespace-pre-wrap [&_.mari-md-codeblock]:[overflow-wrap:anywhere] [&_.mari-md-codeblock]:pb-12 [&_.mari-md-heading]:scroll-mt-6 [&_[tabindex='-1']:focus]:outline-none"
                    onClick={(event) => {
                      const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#/docs"]');
                      if (
                        anchor &&
                        !event.ctrlKey &&
                        !event.metaKey &&
                        !event.shiftKey &&
                        !event.altKey &&
                        event.button === 0
                      ) {
                        event.preventDefault();
                        window.location.hash = anchor.getAttribute("href")!;
                      }
                    }}
                  >
                    {rendered}
                  </article>
                  <nav
                    aria-label={t("demo.docs.pager")}
                    className="mx-auto mt-10 grid max-w-[72ch] gap-3 border-t border-[var(--border)] pt-6 sm:grid-cols-2"
                  >
                    {previous ? (
                      <a
                        href={docHref(previous.path)}
                        className={`${CARD} flex min-h-11 flex-col px-4 py-3 hover:bg-[var(--accent)] focus-visible:outline-2 focus-visible:outline-[var(--ring)]`}
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
                        className={`${CARD} flex min-h-11 flex-col items-end px-4 py-3 text-end hover:bg-[var(--accent)] focus-visible:outline-2 focus-visible:outline-[var(--ring)]`}
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
            {contents.length > 1 ? (
              <aside
                aria-label={t("demo.docs.onThisPage")}
                className="hidden xl:sticky xl:top-0 xl:block xl:max-h-[calc(100dvh-8rem)] xl:overflow-y-auto"
              >
                <h2 className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                  {t("demo.docs.onThisPage")}
                </h2>
                {toc}
              </aside>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
