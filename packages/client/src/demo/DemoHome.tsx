import { lazy, Suspense, useState, useSyncExternalStore, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { BookOpen, Code, Download } from "lucide-react";
import { HomeBrowserHub, MarinaraWordmark } from "../components/chat/HomeBrowserHub";
import { HomeCreditsModal } from "../components/chat/HomeCreditsModal";
import { usePageActivity } from "../hooks/use-page-activity";
import { useUIStore } from "../stores/ui.store";
import { DemoBanner } from "./DemoBanner";
import { DemoDownload } from "./DemoWelcome";
import { DemoLanding, DISCORD_URL, GITHUB_URL, asset } from "./DemoLanding";

const DemoDocs = lazy(() => import("./DemoDocs").then((module) => ({ default: module.DemoDocs })));

const subscribe = (notify: () => void) => {
  window.addEventListener("hashchange", notify);
  return () => window.removeEventListener("hashchange", notify);
};

const NAV_LINK =
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-app-accent-solid)] sm:px-2.5";

// One slim header for the website pages, in the Home browser chrome style.
function DemoSiteHeader() {
  const { t } = useTranslation();
  const link = (href: string, icon: ReactNode, label: string, className = "") => (
    <a
      href={href}
      className={`${NAV_LINK} ${className}`}
      {...(href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}
    >
      {icon}
      <span className="max-sm:sr-only">{label}</span>
    </a>
  );
  return (
    <header
      data-testid="demo-site-header"
      className="mari-chrome-token-scope mari-home-browser-chrome relative z-40 flex h-14 shrink-0 items-center gap-1 border-b border-[var(--marinara-topbar-border)] px-2 shadow-[0_8px_28px_-26px_rgba(0,0,0,0.8)] backdrop-blur-sm sm:gap-2 sm:px-4"
    >
      <a href="#/" className={`${NAV_LINK} !px-1`} aria-label={t("demo.docs.home")}>
        <img src={asset("logo.png")} alt="" width={32} height={32} className="h-8 w-8 object-contain" />
        <MarinaraWordmark className="hidden text-xs leading-none lg:block" />
      </a>
      <nav aria-label={t("demo.site.navigation")} className="ml-auto flex items-center gap-0.5">
        {link("#/docs", <BookOpen className="h-4 w-4" aria-hidden="true" />, t("demo.site.docs"))}
        {link("#/download", <Download className="h-4 w-4" aria-hidden="true" />, t("demo.site.download"))}
        {link(
          DISCORD_URL,
          <img src={asset("home/tab-icons/discord.svg")} alt="" className="h-4 w-4" />,
          t("demo.landing.community.discord"),
          "max-lg:hidden",
        )}
        {link(
          GITHUB_URL,
          <Code className="h-4 w-4" aria-hidden="true" />,
          t("demo.landing.community.github"),
          "max-lg:hidden",
        )}
      </nav>
      <DemoBanner />
      <a
        href="#/demo"
        data-testid="demo-site-try"
        className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-[var(--primary)] px-3.5 text-xs font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-app-accent-solid)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
      >
        {t("demo.site.try")}
      </a>
    </header>
  );
}

export function DemoHome() {
  const { t } = useTranslation();
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  const pageActive = usePageActivity();
  const [creditsOpen, setCreditsOpen] = useState(false);
  // An editor or panel opened over the hidden Home belongs to the Engine workspace and its TopBar.
  const website = useUIStore((s) => !s.hasAnyDetailOpen() && !s.rightPanelOpen);
  const loading = (
    <p role="status" className="p-6 text-sm">
      {t("demo.docs.loading")}
    </p>
  );

  let page: ReactNode;
  if (hash === "#/download") {
    page = (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <DemoDownload />
      </div>
    );
  } else if (hash === "#/about") {
    page = (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <DemoLanding />
      </div>
    );
  } else if (hash === "#/docs" || hash.startsWith("#/docs/") || hash.startsWith("#/docs?")) {
    const [rawPath = "", query = ""] = hash.slice("#/docs".length).replace(/^\//, "").split("?");
    let path: string;
    try {
      path = decodeURIComponent(rawPath);
    } catch {
      path = rawPath;
    }
    page = (
      <Suspense fallback={loading}>
        <DemoDocs path={path} section={new URLSearchParams(query).get("section") ?? ""} />
      </Suspense>
    );
  } else {
    page = (
      <div className="min-h-0 flex-1">
        <HomeCreditsModal open={creditsOpen} onClose={() => setCreditsOpen(false)} />
        <HomeBrowserHub
          pageActive={pageActive}
          onOpenCredits={() => setCreditsOpen(true)}
          websiteContent={<DemoLanding />}
          hideProfessor
        />
      </div>
    );
  }

  return (
    <>
      {website && <DemoSiteHeader />}
      {page}
    </>
  );
}
