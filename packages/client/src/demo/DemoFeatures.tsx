// ──────────────────────────────────────────────
// Static demo: #/features, every documented feature by category
// ──────────────────────────────────────────────
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, Download, LayoutGrid, Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../lib/utils";
import { docHref } from "./docs";
import { FEATURE_CATEGORIES, FEATURE_COUNT, type FeatureCategory } from "./features";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]";
const TEXT_LINK = `inline-flex min-h-11 w-fit items-center gap-1.5 text-sm font-semibold text-[var(--primary)] hover:underline ${FOCUS}`;
const EYEBROW = "text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]";
const PRIMARY = `inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-6 text-sm font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 motion-reduce:transition-none ${FOCUS}`;
const SECONDARY = `inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-6 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--accent)] motion-reduce:transition-none ${FOCUS}`;
const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`;

function CategorySection({ category, index }: { category: FeatureCategory; index: number }) {
  const { t } = useTranslation();
  const Icon = category.icon;
  const highlights = category.items.filter((item) => item.highlight);
  const more = category.items.filter((item) => !item.highlight);
  const portrait = category.image && category.image.height > category.image.width;
  return (
    <section
      id={`features-${category.key}`}
      aria-labelledby={`features-${category.key}-title`}
      style={{ "--feature-accent": category.accent } as CSSProperties}
      className="flex scroll-mt-32 flex-col gap-6"
    >
      <div
        className={cn(
          "grid items-center gap-6",
          category.image &&
            (portrait ? "md:grid-cols-[minmax(0,1fr)_14rem]" : "lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"),
        )}
      >
        <div className={cn("flex flex-col gap-3", category.image && !portrait && index % 2 === 1 && "lg:order-2")}>
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--feature-accent)_18%,transparent)] text-[var(--feature-accent)]">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <h2
            id={`features-${category.key}-title`}
            className="text-balance text-2xl font-bold leading-tight text-[var(--foreground)] sm:text-3xl"
          >
            {t(`demo.features.categories.${category.key}.title`)}
          </h2>
          <p className="max-w-[55ch] text-pretty leading-relaxed text-[var(--muted-foreground)]">
            {t(`demo.features.categories.${category.key}.body`)}
          </p>
        </div>
        {category.image ? (
          <img
            src={asset(category.image.src)}
            alt=""
            width={category.image.width}
            height={category.image.height}
            loading="lazy"
            decoding="async"
            className={cn(
              "rounded-2xl border border-[var(--border)] shadow-xl shadow-black/25",
              portrait ? "mx-auto h-80 w-auto" : "w-full",
            )}
          />
        ) : null}
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {highlights.map((item) => (
          <li
            key={item.key}
            className="flex flex-col gap-2 rounded-2xl border border-[var(--border)] border-t-[color-mix(in_srgb,var(--feature-accent)_70%,var(--border))] bg-[color-mix(in_srgb,var(--feature-accent)_5%,var(--card))] p-5"
          >
            <h3 className="text-base font-semibold text-[var(--foreground)]">
              {t(`demo.features.items.${item.key}.title`)}
            </h3>
            <p className="flex-1 text-sm leading-relaxed text-[var(--muted-foreground)]">
              {t(`demo.features.items.${item.key}.body`)}
            </p>
            <div className="flex flex-wrap gap-x-4">
              <a href={docHref(item.doc, item.section)} className={TEXT_LINK}>
                {t("demo.features.guide")}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">: {t(`demo.features.items.${item.key}.title`)}</span>
              </a>
              {item.demo ? (
                <a href={item.demo} className={`${TEXT_LINK} text-[var(--foreground)]`}>
                  <Play className="h-4 w-4" aria-hidden="true" />
                  {t("demo.features.try")}
                </a>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {more.length ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">
            {t("demo.features.more", { category: t(`demo.features.categories.${category.key}.title`) })}
          </h3>
          <ul className="flex flex-wrap gap-2">
            {more.map((item) => (
              <li key={item.key}>
                <a
                  href={docHref(item.doc, item.section)}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--background)] px-4 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--feature-accent)] motion-reduce:transition-none ${FOCUS}`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--feature-accent)]" aria-hidden="true" />
                  {t(`demo.features.items.${item.key}.title`)}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export function DemoFeatures({ category }: { category: string }) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState(() =>
    FEATURE_CATEGORIES.some((item) => item.key === category) ? category : "all",
  );
  const topRef = useRef<HTMLDivElement>(null);
  const shown = filter === "all" ? FEATURE_CATEGORIES : FEATURE_CATEGORIES.filter((item) => item.key === filter);

  useEffect(() => {
    topRef.current?.scrollIntoView({ block: "start" });
    document.title = `${t("demo.features.title")} · Marinara Engine`;
    return () => {
      document.title = "Marinara Engine";
    };
  }, [t]);

  const choose = (key: string) => {
    setFilter(key);
    // replaceState keeps the address shareable without a hashchange, so the page does not remount.
    window.history.replaceState(null, "", key === "all" ? "#/features" : `#/features?c=${key}`);
  };

  const chip = (key: string, label: string, Icon: FeatureCategory["icon"], accent?: string) => (
    <button
      key={key}
      type="button"
      aria-pressed={filter === key}
      onClick={() => choose(key)}
      style={accent ? ({ "--feature-accent": accent } as CSSProperties) : undefined}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors motion-reduce:transition-none",
        FOCUS,
        filter === key
          ? "border-[color-mix(in_srgb,var(--feature-accent,var(--primary))_60%,var(--border))] bg-[color-mix(in_srgb,var(--feature-accent,var(--primary))_16%,var(--card))] text-[var(--foreground)]"
          : "border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
      )}
    >
      <Icon className="h-4 w-4 text-[var(--feature-accent,var(--primary))]" aria-hidden="true" />
      {label}
    </button>
  );

  return (
    <div
      ref={topRef}
      data-testid="demo-features"
      data-demo-page=""
      className="mx-auto flex w-full max-w-[75rem] scroll-mt-12 flex-col gap-14 px-4 pb-20 pt-6 sm:px-8 sm:pt-16"
    >
      <header className="flex flex-col gap-4">
        <a href="#/" className={`${TEXT_LINK} text-[var(--muted-foreground)]`}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t("demo.download.home")}
        </a>
        <span className={EYEBROW}>{t("demo.features.eyebrow", { count: FEATURE_COUNT })}</span>
        <h1 className="text-balance text-[2.125rem] font-bold leading-[1.08] tracking-tight text-[var(--foreground)] sm:text-5xl">
          {t("demo.features.title")}
        </h1>
        <p className="max-w-[60ch] text-pretty text-base leading-relaxed text-[var(--muted-foreground)] sm:text-lg">
          {t("demo.features.body")}
        </p>
      </header>

      <div className="sticky top-2 z-10 -my-6 rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_88%,transparent)] px-2 pt-2 pb-1 backdrop-blur-md [[data-demo-site]_&]:top-14">
        <div
          role="group"
          aria-label={t("demo.features.filter")}
          className="demo-fade-x flex gap-2 overflow-x-auto [scrollbar-width:none]"
        >
          {chip("all", t("demo.features.all"), LayoutGrid)}
          {FEATURE_CATEGORIES.map((item) =>
            chip(item.key, t(`demo.features.categories.${item.key}.title`), item.icon, item.accent),
          )}
        </div>
      </div>

      {shown.map((item, index) => (
        <CategorySection key={item.key} category={item} index={index} />
      ))}

      <section
        aria-labelledby="demo-features-checklist"
        className="flex flex-col gap-6 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-8"
      >
        <div className="flex flex-col gap-2">
          <h2 id="demo-features-checklist" className="text-2xl font-bold text-[var(--foreground)]">
            {t("demo.features.checklistTitle", { count: FEATURE_COUNT })}
          </h2>
          <p className="max-w-[60ch] text-sm leading-relaxed text-[var(--muted-foreground)]">
            {t("demo.features.checklistBody")}
          </p>
        </div>
        <ul className="gap-8 sm:columns-2 lg:columns-3">
          {FEATURE_CATEGORIES.map((item) => (
            <li
              key={item.key}
              style={{ "--feature-accent": item.accent } as CSSProperties}
              className="mb-6 break-inside-avoid"
            >
              <h3 className="mb-1 text-sm font-semibold text-[var(--foreground)]">
                {t(`demo.features.categories.${item.key}.title`)}
              </h3>
              <ul>
                {item.items.map((feature) => (
                  <li key={feature.key}>
                    <a
                      href={docHref(feature.doc, feature.section)}
                      className={`flex min-h-9 items-start gap-2 rounded-md py-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:underline ${FOCUS}`}
                    >
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--feature-accent)]" aria-hidden="true" />
                      {t(`demo.features.items.${feature.key}.title`)}
                    </a>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <a href="#/demo" className={PRIMARY}>
          <Play className="h-4 w-4" aria-hidden="true" />
          {t("demo.product.tryChat")}
        </a>
        <a href="#/download" className={SECONDARY}>
          <Download className="h-4 w-4" aria-hidden="true" />
          {t("demo.landing.install")}
        </a>
        <a href="#/docs" className={TEXT_LINK}>
          <BookOpen className="h-4 w-4" aria-hidden="true" />
          {t("demo.landing.readDocs")}
        </a>
      </div>
    </div>
  );
}
