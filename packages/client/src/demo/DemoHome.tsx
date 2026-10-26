import { lazy, Suspense, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { HomeBrowserHub } from "../components/chat/HomeBrowserHub";
import { HomeCreditsModal } from "../components/chat/HomeCreditsModal";
import { usePageActivity } from "../hooks/use-page-activity";
import { DemoDownload } from "./DemoWelcome";
import { DemoLanding } from "./DemoLanding";

const DemoDocs = lazy(() => import("./DemoDocs").then((module) => ({ default: module.DemoDocs })));

const subscribe = (notify: () => void) => {
  window.addEventListener("hashchange", notify);
  return () => window.removeEventListener("hashchange", notify);
};

export function DemoHome() {
  const { t } = useTranslation();
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  const pageActive = usePageActivity();
  const [creditsOpen, setCreditsOpen] = useState(false);
  const loading = (
    <p role="status" className="p-6 text-sm">
      {t("demo.docs.loading")}
    </p>
  );

  if (hash === "#/download") {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <DemoDownload />
      </div>
    );
  }
  if (hash === "#/about") {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <DemoLanding />
      </div>
    );
  }
  if (hash === "#/docs" || hash.startsWith("#/docs/") || hash.startsWith("#/docs?")) {
    const [rawPath = "", query = ""] = hash.slice("#/docs".length).replace(/^\//, "").split("?");
    let path: string;
    try {
      path = decodeURIComponent(rawPath);
    } catch {
      path = rawPath;
    }
    return (
      <Suspense fallback={loading}>
        <DemoDocs path={path} section={new URLSearchParams(query).get("section") ?? ""} />
      </Suspense>
    );
  }
  return (
    <>
      <HomeCreditsModal open={creditsOpen} onClose={() => setCreditsOpen(false)} />
      <HomeBrowserHub
        pageActive={pageActive}
        onOpenCredits={() => setCreditsOpen(true)}
        websiteContent={<DemoLanding />}
        hideProfessor
      />
    </>
  );
}
