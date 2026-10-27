import { lazy, Suspense, useState, useSyncExternalStore, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { HomeBrowserHub } from "../components/chat/HomeBrowserHub";
import { HomeCreditsModal } from "../components/chat/HomeCreditsModal";
import { usePageActivity } from "../hooks/use-page-activity";
import { DemoDownload } from "./DemoWelcome";
import { DemoFeatures } from "./DemoFeatures";
import { DemoLanding, DemoLandingHero } from "./DemoLanding";
import { DemoSiteFooter, DemoSiteLinks, DemoSiteTabs } from "./DemoSiteTabs";

const DemoDocs = lazy(() => import("./DemoDocs").then((module) => ({ default: module.DemoDocs })));

// Short links people guess, mapped to the guide they mean.
const DOC_ALIASES = new Map([
  ["getting-started", "home/welcome.md"],
  ["welcome", "home/welcome.md"],
  ["install", "INSTALLATION.md"],
  ["installation", "INSTALLATION.md"],
  ["faq", "FAQ.md"],
  ["troubleshooting", "TROUBLESHOOTING.md"],
]);

const subscribe = (notify: () => void) => {
  window.addEventListener("hashchange", notify);
  return () => window.removeEventListener("hashchange", notify);
};

const goHome = () => {
  if (window.location.hash !== "#/") window.location.hash = "#/";
};

// Professor Mari needs a live model, so her card offers the guided tours instead.
const openTours = () => window.dispatchEvent(new Event("marinara-demo-lessons"));

// The website is the Engine's own Home: its hero and story wrap the real widgets, and its pages are more Home tabs.
export function DemoHome() {
  const { t } = useTranslation();
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  const pageActive = usePageActivity();
  const [creditsOpen, setCreditsOpen] = useState(false);

  const [route = "", query = ""] = hash.split("?");
  let tab: string | null = null;
  let page: ReactNode = null;
  if (route.startsWith("#/features")) {
    tab = "features";
    page = <DemoFeatures category={new URLSearchParams(query).get("c") ?? ""} />;
  } else if (route === "#/download") {
    tab = "download";
    page = <DemoDownload />;
  } else if (route === "#/docs" || route.startsWith("#/docs/")) {
    tab = "docs";
    const rawPath = route.slice("#/docs".length).replace(/^\//, "");
    let path: string;
    try {
      path = decodeURIComponent(rawPath);
    } catch {
      path = rawPath;
    }
    path = DOC_ALIASES.get(path.toLowerCase()) ?? path;
    page = (
      <Suspense
        fallback={
          <p role="status" className="p-6 text-sm">
            {t("demo.docs.loading")}
          </p>
        }
      >
        <DemoDocs path={path} section={new URLSearchParams(query).get("section") ?? ""} />
      </Suspense>
    );
  }

  return (
    <div className="min-h-0 flex-1">
      <HomeCreditsModal open={creditsOpen} onClose={() => setCreditsOpen(false)} />
      <HomeBrowserHub
        pageActive={pageActive}
        onOpenCredits={() => setCreditsOpen(true)}
        hideProfessor
        website={{
          tab,
          tabs: <DemoSiteTabs tab={tab} />,
          links: <DemoSiteLinks />,
          hero: <DemoLandingHero />,
          story: (
            <>
              <DemoLanding />
              <DemoSiteFooter />
            </>
          ),
          page: (
            <div data-demo-page="">
              {page}
              {/* Keyed per page: a shared footer that moves up on a shorter page counts as layout shift. */}
              {tab !== "docs" && <DemoSiteFooter key={hash} />}
            </div>
          ),
          onHome: goHome,
          onProfessor: openTours,
        }}
      />
    </div>
  );
}
