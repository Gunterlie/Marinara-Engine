// ──────────────────────────────────────────────
// Static demo: Home lead row and the download view
// ──────────────────────────────────────────────
import { ArrowRight, BookOpen, Download } from "lucide-react";
import { useTranslation } from "react-i18next";

const APK_URL = "https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]";
const PRIMARY = `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 ${FOCUS}`;
const SECONDARY = `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--accent)] ${FOCUS}`;
const TEXT_LINK = `inline-flex min-h-11 w-fit items-center gap-1.5 text-sm font-semibold text-[var(--primary)] hover:underline ${FOCUS}`;

const RELEASES_URL = "https://github.com/Pasta-Devs/Marinara-Engine/releases/latest";
const CLONE = "git clone https://github.com/Pasta-Devs/Marinara-Engine.git\ncd Marinara-Engine";

// Steps and requirements follow the install guides in docs/installation.
const PLATFORMS: { key: string; href: string; steps: (string | null)[] }[] = [
  { key: "windows", href: "#/docs/installation/windows.md", steps: [null, null, null] },
  {
    key: "macosLinux",
    href: "#/docs/installation/macos-linux.md",
    steps: [CLONE, "chmod +x start.sh\n./start.sh", null],
  },
  { key: "containers", href: "#/docs/installation/containers.md", steps: [CLONE, "docker compose up -d", null] },
  { key: "android", href: "#/docs/installation/android-termux.md", steps: [null, null, null] },
  { key: "ios", href: "#/docs/installation/ios-pwa.md", steps: [null, "http://<host-ip>:7860", null] },
];

const MODEL_OPTIONS = [
  { key: "provider", href: "#/docs/connections/connecting-to-a-provider.md" },
  { key: "local", href: "#/docs/connections/local-model.md" },
] as const;

/** `#/download`: platform choice and what you need before you install. */
export function DemoDownload() {
  const { t } = useTranslation();
  return (
    <div data-demo-page="" className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 pb-20 pt-6 sm:px-8 sm:pt-16">
      <section aria-labelledby="demo-download-title" className="flex flex-col gap-3">
        <h1
          id="demo-download-title"
          className="text-balance text-[2.125rem] font-bold leading-[1.08] tracking-tight text-[var(--foreground)] sm:text-5xl"
        >
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
        <ol className="flex flex-col gap-4">
          {PLATFORMS.map((platform) => (
            <li
              key={platform.key}
              className="flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 basis-64">
                  <h3 className="text-base font-bold text-[var(--card-foreground)]">
                    {t(`demo.landing.platforms.${platform.key}`)}
                  </h3>
                  <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">
                    {t(`demo.download.notes.${platform.key}`)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {platform.key === "android" && (
                    <a href={APK_URL} className={PRIMARY}>
                      <Download className="mari-rgb-static-icon h-4 w-4" aria-hidden="true" />
                      {t("demo.download.apk")}
                    </a>
                  )}
                  {platform.key === "windows" && (
                    <a href={RELEASES_URL} target="_blank" rel="noreferrer" className={PRIMARY}>
                      <Download className="mari-rgb-static-icon h-4 w-4" aria-hidden="true" />
                      {t("demo.download.installer")}
                    </a>
                  )}
                  <a href={platform.href} className={SECONDARY}>
                    {t("demo.download.guide")}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </a>
                </div>
              </div>
              <p className="text-sm text-[var(--foreground)]">
                <span className="font-semibold">{t("demo.download.needsLabel")}</span>{" "}
                <span className="text-[var(--muted-foreground)]">{t(`demo.download.${platform.key}.needs`)}</span>
              </p>
              <ol className="flex flex-col gap-3">
                {platform.steps.map((code, i) => (
                  <li key={i} className="flex gap-3 text-sm leading-relaxed text-[var(--foreground)]">
                    <span
                      aria-hidden="true"
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--primary)_18%,transparent)] text-xs font-bold text-[var(--primary)]"
                    >
                      {i + 1}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <span>{t(`demo.download.${platform.key}.steps.${i + 1}`)}</span>
                      {code ? (
                        <pre className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 font-mono text-xs text-[var(--foreground)]">
                          <code>{code}</code>
                        </pre>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
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
