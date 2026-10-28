// Static demo: release notes from the Engine's CHANGELOG.md, parsed at build time into changelog.json.
import "./demo-docs.css";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { applyInlineMarkdown, renderMarkdownBlocks } from "../lib/markdown";
import { cn } from "../lib/utils";
import { CHANGELOG_SEEN_KEY, DemoBrandMark, WHATS_NEW } from "./DemoSiteTabs";

interface Release {
  version: string;
  date: string;
  body: string;
}

const RELEASES_URL = "https://github.com/Pasta-Devs/Marinara-Engine/releases";
const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]";
const LINK = `inline-flex min-h-11 w-fit items-center gap-1.5 text-sm font-semibold text-[var(--primary)] hover:underline ${FOCUS}`;

const loadChangelog = () =>
  fetch(`${import.meta.env.BASE_URL}changelog.json`).then((response) => {
    if (!response.ok) throw new Error("Changelog unavailable");
    return response.json() as Promise<Release[]>;
  });

/** `#/changelog` and `#/changelog/<version>`: the newest release open, older ones closed until asked for. */
export function DemoChangelog({ version }: { version: string }) {
  const { t } = useTranslation();
  const releases = useQuery({ queryKey: ["demo-changelog"], queryFn: loadChangelog, staleTime: Infinity });
  // Visitor toggles; a release nobody toggled is open when it is the linked one, or the newest without a link.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const latest = releases.data?.[0]?.version;
  const current = version || latest;
  const isOpen = (release: Release) => toggled[release.version] ?? release.version === current;

  useEffect(() => {
    try {
      if (WHATS_NEW) localStorage.setItem(CHANGELOG_SEEN_KEY, WHATS_NEW.version);
    } catch {
      // Private mode: the tab keeps its dot.
    }
  }, []);

  useEffect(() => {
    if (!version || !releases.data) return;
    setToggled((state) => ({ ...state, [version]: true }));
    document.getElementById(`release-${version}`)?.scrollIntoView({ block: "start" });
  }, [version, releases.data]);

  return (
    <div className="mx-auto flex max-w-[75rem] flex-col gap-8 px-5 pb-16 pt-6 sm:px-8 sm:pt-10">
      <header className="flex items-start gap-4">
        <DemoBrandMark />
        <div>
          <h1 className="text-balance text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
            {t("demo.changelog.title")}
          </h1>
          <p className="mt-2 max-w-[60ch] text-pretty text-sm text-[var(--muted-foreground)] sm:text-base">
            {t("demo.changelog.subtitle")}
          </p>
        </div>
      </header>

      {releases.isLoading ? (
        <p role="status" className="text-sm text-[var(--muted-foreground)]">
          {t("demo.changelog.loading")}
        </p>
      ) : !releases.data?.length ? (
        <div role="status" className="flex flex-col gap-2">
          <p className="text-sm text-[var(--muted-foreground)]">{t("demo.changelog.unavailable")}</p>
          <a href={`${RELEASES_URL}/latest`} target="_blank" rel="noreferrer" className={LINK}>
            {t("demo.changelog.latestOnGithub")}
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      ) : (
        <div className="lg:grid lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-10">
          <nav aria-label={t("demo.changelog.versions")} className="hidden lg:block">
            <ol className="sticky top-4 flex max-h-[calc(100dvh-2rem)] flex-col overflow-y-auto pr-1">
              {releases.data.map((release) => (
                <li key={release.version}>
                  <a
                    href={`#/changelog/${release.version}`}
                    aria-current={release.version === current ? "location" : undefined}
                    className={cn(
                      "flex min-h-9 items-center justify-between gap-2 rounded-lg px-3 text-sm tabular-nums text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
                      release.version === current && "bg-[var(--secondary)] font-semibold text-[var(--foreground)]",
                      FOCUS,
                    )}
                  >
                    v{release.version}
                    {release.version === latest ? (
                      <span className="text-xs font-normal">{t("demo.changelog.latest")}</span>
                    ) : null}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <ol className="flex min-w-0 flex-col gap-3">
            {releases.data.map((release) => (
              <li key={release.version} id={`release-${release.version}`} className="scroll-mt-4">
                <details
                  open={isOpen(release)}
                  onToggle={(event) => {
                    const open = event.currentTarget.open;
                    setToggled((state) => ({ ...state, [release.version]: open }));
                  }}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--card)]"
                >
                  <summary
                    className={cn(
                      "flex min-h-11 cursor-pointer flex-wrap items-baseline gap-x-3 gap-y-1 rounded-2xl px-4 py-3 sm:px-6",
                      FOCUS,
                    )}
                  >
                    <h2 className="text-xl font-bold tabular-nums text-[var(--foreground)]">v{release.version}</h2>
                    {release.date ? (
                      <time dateTime={release.date} className="text-sm text-[var(--muted-foreground)]">
                        {release.date}
                      </time>
                    ) : null}
                    {release.version === latest ? (
                      <span className="rounded-full border border-[var(--border)] bg-[var(--secondary)] px-2 py-0.5 text-xs font-semibold text-[var(--foreground)]">
                        {t("demo.changelog.latest")}
                      </span>
                    ) : null}
                  </summary>
                  {/* Older notes are long: render a release only once it is open. */}
                  {isOpen(release) ? (
                    <div className="border-t border-[var(--border)] px-4 pb-5 pt-4 sm:px-6">
                      <div className="mari-message-content docs-reader-content demo-docs-reader break-words">
                        {renderMarkdownBlocks(release.body, applyInlineMarkdown, `changelog-${release.version}`)}
                      </div>
                      <a
                        href={`${RELEASES_URL}/tag/v${release.version}`}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(LINK, "mt-4")}
                      >
                        {t("demo.changelog.viewRelease")}
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      </a>
                    </div>
                  ) : null}
                </details>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
