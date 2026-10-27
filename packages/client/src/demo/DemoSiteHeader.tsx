// ──────────────────────────────────────────────
// Static demo: the website's own header and footer. They sit inside the Engine's Home page and scroll with it.
// ──────────────────────────────────────────────
import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, GitBranch, Menu, Play, Star, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MarinaraWordmark } from "../components/chat/HomeBrowserHub";
import { docHref } from "./docs";
import "./demo-landing.css";

export const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`;

export const GITHUB_URL = "https://github.com/Pasta-Devs/Marinara-Engine";

export const DISCORD_URL = "https://discord.com/invite/KdAkTg94ME";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-app-accent-solid)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]";
const NAV_LINK = `relative isolate inline-flex h-8 items-center rounded-full px-3.5 text-[0.8125rem] font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] aria-[current=page]:text-[var(--foreground)] [@media(pointer:coarse)]:h-11 ${FOCUS}`;
const SHEET_LINK = `flex min-h-14 items-center justify-between gap-3 border-b border-[var(--border)] text-xl font-semibold text-[var(--foreground)] aria-[current=page]:text-[var(--primary)] ${FOCUS}`;
const ROUND_LINK = `inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] text-base font-medium text-[var(--foreground)] ${FOCUS}`;
const TRY_BUTTON = `inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-[var(--primary)] font-semibold text-[var(--primary-foreground)] shadow-[0_6px_18px_-8px_var(--primary)] transition-opacity hover:opacity-90 ${FOCUS}`;

const external = (href: string) => (href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {});

const subscribeHash = (notify: () => void) => {
  window.addEventListener("hashchange", notify);
  return () => window.removeEventListener("hashchange", notify);
};

const LINKS = [
  { href: "#/features", key: "demo.site.features", active: (hash: string) => hash.startsWith("#/features") },
  { href: "#/docs", key: "demo.site.docs", active: (hash: string) => hash.startsWith("#/docs") },
  { href: "#/download", key: "demo.site.download", active: (hash: string) => hash === "#/download" },
] as const;

function DiscordIcon({ className }: { className: string }) {
  return (
    <img src={asset("home/tab-icons/discord.svg")} alt="" className={`${className} [[data-theme=light]_&]:invert`} />
  );
}

/** One header row on every website page: logo, the three pages, GitHub, Discord and the demo. */
export function DemoSiteHeader() {
  const { t } = useTranslation();
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash);
  const reduceMotion = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (menuOpen) sheetRef.current?.querySelector<HTMLElement>("button")?.focus();
  }, [menuOpen]);

  const closeMenu = () => {
    setMenuOpen(false);
    menuButtonRef.current?.focus();
  };

  // The sheet keeps Tab inside itself and closes on Escape.
  const onSheetKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") return closeMenu();
    if (event.key !== "Tab") return;
    const items = event.currentTarget.querySelectorAll<HTMLElement>("a[href], button");
    const edge = event.shiftKey ? items[0] : items[items.length - 1];
    if (document.activeElement !== edge) return;
    event.preventDefault();
    (event.shiftKey ? items[items.length - 1] : items[0])?.focus();
  };

  return (
    <header
      data-testid="demo-site-header"
      className="relative mx-auto flex w-full max-w-[75rem] items-center gap-2 px-4 pt-3 sm:px-8 sm:pt-4"
    >
      <a
        href="#/"
        aria-label={t("demo.docs.home")}
        className={`flex min-h-11 shrink-0 items-center gap-2 rounded-md pr-1 ${FOCUS}`}
      >
        <img src={asset("logo.png")} alt="" width={32} height={32} className="h-7 w-7 object-contain" />
        <MarinaraWordmark className="text-[0.9375rem]" />
      </a>
      <nav
        aria-label={t("demo.site.navigation")}
        className="hidden items-center gap-0.5 rounded-full border border-[var(--border)] bg-[color-mix(in_srgb,var(--card)_55%,transparent)] p-1 md:ml-auto md:flex lg:absolute lg:left-1/2 lg:-translate-x-1/2"
      >
        {LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            aria-current={link.active(hash) ? "page" : undefined}
            className={NAV_LINK}
          >
            {link.active(hash) && (
              <motion.span
                layoutId="demo-site-nav-active"
                transition={reduceMotion ? { duration: 0 } : { type: "spring", bounce: 0.2, duration: 0.45 }}
                className="absolute inset-0 -z-10 rounded-full bg-[color-mix(in_srgb,var(--primary)_18%,var(--accent))]"
              />
            )}
            {t(link.key)}
          </a>
        ))}
      </nav>
      <div className="ml-auto flex shrink-0 items-center gap-1.5 md:ml-0 lg:ml-auto">
        <a
          href={DISCORD_URL}
          {...external(DISCORD_URL)}
          aria-label={t("demo.landing.community.discord")}
          title={t("demo.landing.community.discord")}
          className={`group hidden h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-[var(--accent)] md:inline-flex ${FOCUS}`}
        >
          <DiscordIcon className="h-4 w-4 opacity-60 transition-opacity group-hover:opacity-100" />
        </a>
        <a
          href={GITHUB_URL}
          {...external(GITHUB_URL)}
          aria-label={t("demo.site.star")}
          title={t("demo.site.star")}
          className={`hidden h-9 items-center gap-2 rounded-full border border-[var(--border)] px-3 text-[0.8125rem] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--accent)] lg:inline-flex ${FOCUS}`}
        >
          <GitBranch className="h-4 w-4" aria-hidden="true" />
          {t("demo.landing.community.github")}
          <span aria-hidden="true" className="h-4 w-px bg-[var(--border)]" />
          <Star className="h-3.5 w-3.5 text-[var(--primary)]" aria-hidden="true" />
        </a>
        <a
          href="#/demo"
          data-testid="demo-site-try"
          className={`${TRY_BUTTON} h-9 px-4 text-[0.8125rem] [@media(pointer:coarse)]:h-11`}
        >
          {t("demo.site.try")}
        </a>
        <button
          ref={menuButtonRef}
          type="button"
          data-testid="demo-site-menu"
          aria-label={t("demo.site.menu")}
          aria-expanded={menuOpen}
          aria-controls={menuOpen ? "demo-site-sheet" : undefined}
          onClick={() => setMenuOpen(true)}
          className={`inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] text-[var(--foreground)] md:hidden ${FOCUS}`}
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      {menuOpen &&
        createPortal(
          <div
            ref={sheetRef}
            id="demo-site-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={t("demo.site.menu")}
            onKeyDown={onSheetKeyDown}
            className="mari-chrome-token-scope demo-sheet fixed inset-0 z-[9990] flex flex-col overflow-y-auto bg-[var(--background)] px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-[env(safe-area-inset-top)]"
          >
            <div className="flex h-14 shrink-0 items-center justify-between">
              <MarinaraWordmark className="text-[0.9375rem]" />
              <button
                type="button"
                onClick={closeMenu}
                aria-label={t("demo.site.closeMenu")}
                className={`inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] text-[var(--foreground)] ${FOCUS}`}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <nav aria-label={t("demo.site.navigation")} className="mt-4 flex flex-col">
              {[
                { href: "#/", key: "demo.docs.home", active: (value: string) => value === "#/" || value === "" },
                ...LINKS,
              ].map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  aria-current={link.active(hash) ? "page" : undefined}
                  onClick={() => setMenuOpen(false)}
                  className={SHEET_LINK}
                >
                  {t(link.key)}
                  <ArrowRight className="h-5 w-5 text-[var(--muted-foreground)]" aria-hidden="true" />
                </a>
              ))}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <a href={GITHUB_URL} {...external(GITHUB_URL)} className={ROUND_LINK}>
                  <GitBranch className="h-4 w-4" aria-hidden="true" />
                  {t("demo.landing.community.github")}
                </a>
                <a href={DISCORD_URL} {...external(DISCORD_URL)} className={ROUND_LINK}>
                  <DiscordIcon className="h-4 w-4" />
                  {t("demo.landing.community.discord")}
                </a>
              </div>
            </nav>
            <a
              href="#/demo"
              onClick={() => setMenuOpen(false)}
              className={`${TRY_BUTTON} mt-auto min-h-12 rounded-xl text-base max-[30rem]:mt-8`}
            >
              <Play className="h-4 w-4" aria-hidden="true" />
              {t("demo.site.try")}
            </a>
          </div>,
          document.body,
        )}
    </header>
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
    <footer className="mx-auto grid w-full max-w-[75rem] grid-cols-2 gap-x-6 gap-y-8 px-4 pb-28 sm:px-8 md:pb-16 lg:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,1fr))]">
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
