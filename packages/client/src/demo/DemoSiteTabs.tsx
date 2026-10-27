// ──────────────────────────────────────────────
// Static demo: the website's tabs in the Engine's own Home tab row, and the page footer.
// ──────────────────────────────────────────────
import { Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MarinaraWordmark } from "../components/chat/HomeBrowserHub";
import { cn } from "../lib/utils";
import { docHref } from "./docs";
import "./demo-landing.css";

export const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`;

export const GITHUB_URL = "https://github.com/Pasta-Devs/Marinara-Engine";

export const DISCORD_URL = "https://discord.com/invite/KdAkTg94ME";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-app-accent-solid)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]";

const external = (href: string) => (href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {});

// The Engine's Home tab look, so the website pages read as more Home tabs.
const TAB =
  "relative flex min-h-9 min-w-0 items-center justify-center rounded-t-lg border border-b-0 text-[0.65rem] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)] sm:min-w-[6.5rem] sm:w-auto sm:flex-none sm:gap-1.5 sm:px-3 sm:text-xs";
const TAB_ICON = "h-[1.125rem] w-[1.125rem] object-contain";
const ICON_LINK = `flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] ${FOCUS}`;

const TABS = [
  { id: "features", key: "demo.site.features", icon: "home/tab-icons/widgets.svg" },
  { id: "docs", key: "demo.site.docs", icon: "home/tab-icons/documentation.png" },
  { id: "download", key: "demo.site.download", icon: null },
] as const;

/** GitHub mark (Simple Icons, CC0). */
export function GithubIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

export function DiscordIcon({ className }: { className: string }) {
  return (
    <img src={asset("home/tab-icons/discord.svg")} alt="" className={`${className} [[data-theme=light]_&]:invert`} />
  );
}

/** Features, Docs and Download as Home tabs; `tab` is the selected one, null on Home. */
export function DemoSiteTabs({ tab }: { tab: string | null }) {
  const { t } = useTranslation();
  return TABS.map((item) => {
    const active = tab === item.id;
    return (
      <button
        key={item.id}
        type="button"
        role="tab"
        data-testid={`demo-tab-${item.id}`}
        aria-selected={active}
        aria-label={t(item.key)}
        onClick={() => (window.location.hash = `#/${item.id}`)}
        className={cn(
          TAB,
          active ? "flex-1 gap-1 px-2" : "w-9 flex-none gap-0 px-0",
          active
            ? "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]"
            : "border-transparent text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
        )}
      >
        {item.icon ? (
          <img src={asset(item.icon)} alt="" className={TAB_ICON} />
        ) : (
          <Download className={cn(TAB_ICON, "text-[var(--primary)]")} aria-hidden="true" />
        )}
        <span className={cn("min-w-0 truncate", active ? "block" : "hidden sm:block")}>{t(item.key)}</span>
      </button>
    );
  });
}

/** After the tab list: the guided tour, then GitHub and Discord. Phones reach them through the Demo menu. */
export function DemoSiteLinks() {
  const { t } = useTranslation();
  return (
    <div className="ml-auto flex shrink-0 items-center gap-0.5 self-center pl-1 max-sm:hidden">
      <button
        type="button"
        data-testid="demo-tab-tour"
        aria-label={t("demo.site.tours")}
        title={t("demo.site.tours")}
        onClick={() => window.dispatchEvent(new Event("marinara-demo-lessons"))}
        className={cn(ICON_LINK, "sm:w-auto sm:gap-1.5 sm:px-3 sm:text-xs sm:font-semibold")}
      >
        <img src={asset("home/tab-icons/tutorial.png")} alt="" className={TAB_ICON} />
        <span className="hidden sm:inline">{t("demo.site.tours")}</span>
      </button>
      <a
        href={GITHUB_URL}
        {...external(GITHUB_URL)}
        aria-label={t("demo.landing.community.github")}
        title={t("demo.landing.community.github")}
        className={ICON_LINK}
      >
        <GithubIcon className="h-4 w-4" />
      </a>
      <a
        href={DISCORD_URL}
        {...external(DISCORD_URL)}
        aria-label={t("demo.landing.community.discord")}
        title={t("demo.landing.community.discord")}
        className={ICON_LINK}
      >
        <DiscordIcon className="h-4 w-4" />
      </a>
    </div>
  );
}

// Footer columns: the same pages as the header, grouped the way visitors look for them.
const FOOTER = [
  {
    key: "product",
    links: [
      { label: "demo.site.features", href: "#/features" },
      { label: "demo.site.download", href: "#/download" },
      { label: "demo.site.try", href: "#/demo" },
      { label: "demo.landing.guides.mari.title", href: "#/docs/home/professor-mari.md" },
    ],
  },
  {
    key: "docs",
    links: [
      { label: "demo.landing.footer.gettingStarted", href: "#/docs/home/welcome.md" },
      { label: "demo.landing.footer.installation", href: docHref("INSTALLATION.md") },
      { label: "demo.landing.footer.faq", href: docHref("FAQ.md") },
      { label: "demo.landing.footer.troubleshooting", href: docHref("TROUBLESHOOTING.md") },
    ],
  },
  {
    key: "community",
    links: [
      { label: "demo.landing.community.github", href: GITHUB_URL },
      { label: "demo.landing.community.discord", href: DISCORD_URL },
      { label: "demo.landing.footer.issues", href: `${GITHUB_URL}/issues` },
    ],
  },
  {
    key: "legal",
    links: [
      { label: "demo.landing.footer.license", href: `${GITHUB_URL}/blob/main/LICENSE` },
      { label: "demo.banner.source", href: GITHUB_URL },
    ],
  },
] as const;

export function DemoSiteFooter() {
  const { t } = useTranslation();
  return (
    <footer className="mx-auto grid w-full max-w-[75rem] grid-cols-2 gap-x-6 gap-y-8 px-5 pb-28 sm:px-8 md:pb-16 lg:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,1fr))]">
      <div className="col-span-2 flex flex-col gap-3 border-t border-[var(--border)] pt-10 lg:col-span-1">
        <a href="#/" className={`flex w-fit items-center gap-2 rounded-md ${FOCUS}`}>
          <img src={asset("logo.png")} alt="" width={32} height={32} className="h-8 w-8 object-contain" />
          <MarinaraWordmark className="text-base" />
        </a>
        <p className="max-w-[34ch] text-sm leading-relaxed text-[var(--muted-foreground)]">
          {t("demo.landing.footer.tagline")}
        </p>
      </div>
      {FOOTER.map((column) => (
        <nav
          key={column.key}
          aria-labelledby={`demo-footer-${column.key}`}
          className="flex flex-col gap-1 lg:border-t lg:border-[var(--border)] lg:pt-10"
        >
          <h2
            id={`demo-footer-${column.key}`}
            className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]"
          >
            {t(`demo.landing.footer.${column.key}`)}
          </h2>
          <ul className="flex flex-col">
            {column.links.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  {...external(link.href)}
                  className={`inline-flex min-h-11 items-center text-sm text-[var(--foreground)] transition-colors hover:text-[var(--primary)] ${FOCUS}`}
                >
                  {t(link.label)}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ))}
    </footer>
  );
}
