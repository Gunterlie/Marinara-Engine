import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Link as LinkIcon, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDocContent, useDocsIndex, useDocsSearch } from "../hooks/use-docs";
import { renderMarkdownBlocks, applyInlineMarkdown } from "../lib/markdown";
import { useCodeBlockCopy } from "../hooks/use-code-block-copy";
import { copyToClipboard } from "../lib/utils";
import { docHref, headingSlug, prepareDemoDoc } from "./docs";

const linkClass =
  "inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent)] focus-visible:outline-2 focus-visible:outline-[var(--ring)]";

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
    for (const anchor of reader.querySelectorAll<HTMLAnchorElement>('a[href^="#/docs"]'))
      anchor.removeAttribute("target");
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
      headingRef.current?.focus({ preventScroll: true });
    }
  }, [reader, rendered, section, path, doc.data, t]);

  const searching = searchTerm.length >= 2;
  const docs = searching ? search.data?.results : index.data?.docs;
  const isError = index.isError || (searching && search.isError);

  return (
    <section
      data-testid="demo-docs"
      className="min-h-0 flex-1 overflow-y-auto bg-[var(--background)] text-[var(--foreground)]"
    >
      <div className="mx-auto max-w-6xl px-5 py-5 sm:px-8 sm:py-8">
        <nav
          aria-label={t("demo.docs.navigation")}
          className="mb-7 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-3"
        >
          <a href="#/" className={linkClass}>
            <ArrowLeft size={16} />
            {t("demo.docs.home")}
          </a>
          <a href="#/demo" className={linkClass}>
            {t("demo.docs.tryDemo")}
            <ArrowRight size={16} />
          </a>
        </nav>
        <div className="flex items-start gap-3">
          <BookOpen className="mt-1 shrink-0 text-[var(--muted-foreground)]" size={24} />
          <div>
            <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-bold tracking-tight">
              {t("demo.docs.title")}
            </h1>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">{t("demo.docs.subtitle")}</p>
          </div>
        </div>
        <div className="mt-8 grid min-w-0 gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <aside
            aria-label={t("demo.docs.guides")}
            className={path ? "hidden max-h-[70dvh] overflow-y-auto lg:block" : "max-h-[70dvh] overflow-y-auto"}
          >
            <label className="mb-2 block text-sm font-medium" htmlFor="demo-docs-search">
              {t("demo.docs.search")}
            </label>
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute start-3 top-3.5 text-[var(--muted-foreground)]"
              />
              <input
                id="demo-docs-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] ps-9 pe-3 text-sm focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
              />
            </div>
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
            {docs?.length === 0 ? (
              <p role="status" className="py-4 text-sm text-[var(--muted-foreground)]">
                {t("demo.docs.noResults")}
              </p>
            ) : null}
            <ul className="mt-4 space-y-1">
              {docs?.map((entry) => (
                <li key={entry.path}>
                  <a
                    href={docHref(entry.path)}
                    aria-current={path === entry.path ? "page" : undefined}
                    className={`block min-h-11 rounded-lg px-3 py-2.5 text-sm hover:bg-[var(--accent)] focus-visible:outline-2 focus-visible:outline-[var(--ring)] ${path === entry.path ? "bg-[var(--accent)] font-semibold" : ""}`}
                  >
                    <span className="block">{entry.title}</span>
                    <span className="block break-all text-xs text-[var(--muted-foreground)]">
                      {entry.dir || t("demo.docs.general")}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </aside>
          <div className="min-w-0">
            {path ? (
              <>
                <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
                  <a href={docHref()} className={linkClass}>
                    <ArrowLeft size={16} />
                    {t("demo.docs.allGuides")}
                  </a>
                  {doc.data ? (
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
                      <LinkIcon size={16} />
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
                    <h2 className="text-xl font-semibold">{t("demo.docs.notFound")}</h2>
                    <p className="mt-2 text-sm text-[var(--muted-foreground)]">{t("demo.docs.notFoundHint")}</p>
                    <button type="button" onClick={() => void doc.refetch()} className={linkClass}>
                      {t("demo.docs.retry")}
                    </button>
                  </div>
                ) : null}
                {doc.data ? (
                  <>
                    {contents.length > 1 ? (
                      <details className="mb-6 border-y border-[var(--border)] py-3">
                        <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">
                          {t("demo.docs.onThisPage")}
                        </summary>
                        <ul className="pb-3">
                          {contents.map((item) => (
                            <li key={item.id}>
                              <a href={docHref(path, item.id)} className={linkClass}>
                                {item.title}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                    <article
                      key={`${doc.data.path}:${doc.data.updatedAt}`}
                      ref={setReader}
                      data-testid="demo-doc-article"
                      className="mari-message-content docs-reader-content break-words text-sm leading-relaxed [&_pre]:whitespace-pre-wrap! [&_pre]:break-words [&_.mari-md-codeblock]:whitespace-pre-wrap! [&_.mari-md-codeblock]:[overflow-wrap:anywhere]! [&_.mari-md-codeblock]:pb-12! [&_.mari-md-heading]:scroll-mt-6"
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
                  </>
                ) : null}
              </>
            ) : (
              <div className="border-t border-[var(--border)] py-8 lg:border-t-0 lg:pt-0">
                <h2 className="text-2xl font-semibold">{t("demo.docs.startTitle")}</h2>
                <p className="mt-3 max-w-lg text-[var(--muted-foreground)]">{t("demo.docs.startBody")}</p>
                <a href={docHref("home/welcome.md")} className={linkClass}>
                  {t("demo.docs.start")}
                  <ArrowRight size={16} />
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
