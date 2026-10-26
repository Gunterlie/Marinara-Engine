// ──────────────────────────────────────────────
// Static demo: Home lead row and the download view
// ──────────────────────────────────────────────
import { ArrowLeft, ArrowRight, BookOpen, Download } from "lucide-react";
import { useTranslation } from "react-i18next";

const APK_URL = "https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]";
const PRIMARY = `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 ${FOCUS}`;
const SECONDARY = `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--accent)] ${FOCUS}`;
const TEXT_LINK = `inline-flex min-h-11 w-fit items-center gap-1.5 text-sm font-semibold text-[var(--primary)] hover:underline ${FOCUS}`;

const PLATFORMS = [
  { key: "windows", href: "#/docs/installation/windows.md" },
  { key: "macosLinux", href: "#/docs/installation/macos-linux.md" },
  { key: "containers", href: "#/docs/installation/containers.md" },
  { key: "android", href: "#/docs/installation/android-termux.md" },
  { key: "ios", href: "#/docs/installation/ios-pwa.md" },
] as const;

const MODEL_OPTIONS = [
  { key: "provider", href: "#/docs/connections/connecting-to-a-provider.md" },
  { key: "local", href: "#/docs/connections/local-model.md" },
] as const;

/** `#/download`: platform choice and what you need before you install. */
export function DemoDownload() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 pb-12 pt-6 sm:px-8 sm:pt-10">
      <a href="#/" className={`${TEXT_LINK} text-[var(--muted-foreground)]`}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t("demo.download.home")}
      </a>

      <section aria-labelledby="demo-download-title" className="flex flex-col gap-3">
        <h1 id="demo-download-title" className="text-balance text-3xl font-bold text-[var(--foreground)]">
          {t("demo.download.title")}
        </h1>
        <p className="max-w-[60ch] text-pretty text-sm leading-relaxed text-[var(--muted-foreground)] sm:text-base">
          {t("demo.landing.platforms.body")}
        </p>
      </section>

      <section aria-labelledby="demo-download-platforms" className="flex flex-col gap-3">
        <h2 id="demo-download-platforms" className="text-lg font-bold text-[var(--foreground)]">
          {t("demo.download.platforms")}
        </h2>
        <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
          {PLATFORMS.map((platform) => (
            <li key={platform.key} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--card-foreground)]">
                  {t(`demo.landing.platforms.${platform.key}`)}
                </p>
                <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
                  {t(`demo.download.notes.${platform.key}`)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {platform.key === "android" && (
                  <a href={APK_URL} className={PRIMARY}>
                    <Download className="h-4 w-4" aria-hidden="true" />
                    {t("demo.download.apk")}
                  </a>
                )}
                <a href={platform.href} className={SECONDARY}>
                  {t("demo.download.guide")}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
              </div>
            </li>
          ))}
        </ul>
        <a href="#/docs/INSTALLATION.md" className={TEXT_LINK}>
          <BookOpen className="h-4 w-4" aria-hidden="true" />
          {t("demo.download.compare")}
        </a>
      </section>

      <section aria-labelledby="demo-download-models" className="flex flex-col gap-3">
        <h2 id="demo-download-models" className="text-lg font-bold text-[var(--foreground)]">
          {t("demo.landing.models.title")}
        </h2>
        <p className="max-w-[65ch] text-sm leading-relaxed text-[var(--muted-foreground)]">
          {t("demo.landing.models.body")} {t("demo.landing.models.app.body")}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {MODEL_OPTIONS.map((item) => (
            <div key={item.key} className="flex flex-col gap-1 border-t border-[var(--border)] pt-3">
              <h3 className="text-sm font-bold text-[var(--foreground)]">
                {t(`demo.landing.models.${item.key}.title`)}
              </h3>
              <p className="flex-1 text-sm leading-relaxed text-[var(--muted-foreground)]">
                {t(`demo.landing.models.${item.key}.body`)}
              </p>
              <a href={item.href} className={TEXT_LINK}>
                {t(`demo.landing.models.${item.key}.link`)}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
          ))}
        </div>
      </section>

      <a href="#/about" className={TEXT_LINK}>
        {t("demo.download.about")}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </a>
    </div>
  );
}
