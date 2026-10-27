import { lazy, Suspense, useState, useSyncExternalStore, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { HomeBrowserHub } from "../components/chat/HomeBrowserHub";
import { HomeCreditsModal } from "../components/chat/HomeCreditsModal";
import { usePageActivity } from "../hooks/use-page-activity";
import { DemoDownload } from "./DemoWelcome";
import { DemoLanding } from "./DemoLanding";
import { DemoSiteFooter, DemoSiteHeader } from "./DemoSiteHeader";

const DemoDocs = lazy(() => import("./DemoDocs").then((module) => ({ default: module.DemoDocs })));

const subscribe = (notify: () => void) => {
  window.addEventListener("hashchange", notify);
  return () => window.removeEventListener("hashchange", notify);
};

// Every website page is the Engine's own Home page: same shell, same bar, the site header scrolls with the page.
export function DemoHome() {
  const { t } = useTranslation();
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  const pageActive = usePageActivity();
  const [creditsOpen, setCreditsOpen] = useState(false);

  let page: ReactNode = <DemoLanding />;
  let footer = true;
  if (hash === "#/download") {
    page = <DemoDownload />;
  } else if (hash === "#/docs" || hash.startsWith("#/docs/") || hash.startsWith("#/docs?")) {
    const [rawPath = "", query = ""] = hash.slice("#/docs".length).replace(/^\//, "").split("?");
    let path: string;
    try {
      path = decodeURIComponent(rawPath);
    } catch {
      path = rawPath;
    }
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
    footer = false;
  }

  return (
    <div className="min-h-0 flex-1">
      <HomeCreditsModal open={creditsOpen} onClose={() => setCreditsOpen(false)} />
      <HomeBrowserHub
        pageActive={pageActive}
        onOpenCredits={() => setCreditsOpen(true)}
        hideProfessor
        websiteContent={
          <div data-demo-page="">
            <DemoSiteHeader />
            {page}
            {footer && <DemoSiteFooter />}
          </div>
        }
      />
    </div>
  );
}
