// ──────────────────────────────────────────────
// Static demo: product page on the Home tab
// ──────────────────────────────────────────────
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import {
  ArrowRight,
  BookOpen,
  Boxes,
  Cloud,
  Code,
  Cpu,
  Dices,
  Download,
  Drama,
  ExternalLink,
  HardDrive,
  Laptop,
  MessageCircle,
  Monitor,
  Play,
  Smartphone,
  Tablet,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { HOME_CHAT_MODE_ACCENTS } from "../lib/home-chat-mode-style";
import { cn } from "../lib/utils";
import { FeedModule, HOME_MODULE_ACCENTS } from "../components/chat/HomeBrowserHub";
import { useMariAppearancePack } from "../hooks/use-mari-appearance-pack";
import { DEMO_ASSETS } from "./seed";

export const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`;

export const GITHUB_URL = "https://github.com/Pasta-Devs/Marinara-Engine";
export const DISCORD_URL = "https://discord.com/invite/KdAkTg94ME";

const MODES = [
  {
    key: "roleplay",
    icon: Drama,
    image: "website/Desktop_Roleplay_View.webp",
    href: "#/docs/roleplay/getting-started.md",
    points: ["scenes", "sprites", "trackers"],
  },
  {
    key: "conversation",
    icon: MessageCircle,
    image: "website/Desktop_DM_Conversation.webp",
    href: "#/docs/conversation/getting-started.md",
    points: ["groups", "calls", "schedules"],
  },
  {
    key: "game",
    icon: Dices,
    image: "website/Browser_Game_Screen.webp",
    href: "#/docs/game/getting-started.md",
    points: ["dice", "map", "saves"],
  },
] as const;

// Feature stories: real screens from the installed app, accented like Home modules.
const STORIES = [
  {
    key: "trackers",
    image: "website/Desktop_Tracker_Panel.webp",
    width: 1600,
    height: 900,
    accent: HOME_MODULE_ACCENTS.cyan,
    href: "#/docs/roleplay/hud-and-trackers.md",
  },
  {
    key: "groups",
    image: "website/Mobile_Group_Conversation.webp",
    width: 739,
    height: 1600,
    accent: HOME_MODULE_ACCENTS.pink,
    href: "#/docs/chats/group-chats.md",
  },
  {
    key: "themes",
    image: "website/Desktop_Custom_Theme.webp",
    width: 1600,
    height: 777,
    accent: HOME_MODULE_ACCENTS.violet,
    href: "#/docs/appearance/custom-css-themes.md",
  },
  {
    key: "game",
    image: "website/Browser_Game_Dialogue.webp",
    width: 1600,
    height: 900,
    accent: HOME_MODULE_ACCENTS.orange,
    href: "#/docs/game/party-and-npcs.md",
  },
] as const;

// True facts only: each one links to where a visitor can check it.
const PROOF = [
  { key: "open", icon: Code, href: GITHUB_URL },
  { key: "local", icon: HardDrive, href: "#/docs/data/where-data-is-stored.md" },
  { key: "models", icon: Cloud, href: "#/docs/connections/connecting-to-a-provider.md" },
  { key: "platforms", icon: Monitor, href: "#/download" },
] as const;

const TEASER = ["lighthouse", "fog"] as const;
const TEASER_TICK_MS = 55;
const TEASER_WAIT_TICKS = 18; // typing dots before the reply
const TEASER_HOLD_TICKS = 70; // finished reply stays this long

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const MODEL_OPTIONS = [
  { key: "app", icon: Code, href: GITHUB_URL },
  { key: "provider", icon: Cloud, href: "#/docs/connections/connecting-to-a-provider.md" },
  { key: "local", icon: Cpu, href: "#/docs/connections/local-model.md" },
] as const;

const PLATFORMS = [
  { key: "windows", icon: Monitor, href: "#/docs/installation/windows.md" },
  { key: "macosLinux", icon: Laptop, href: "#/docs/installation/macos-linux.md" },
  { key: "android", icon: Smartphone, href: "#/docs/installation/android-termux.md" },
  { key: "ios", icon: Tablet, href: "#/docs/installation/ios-pwa.md" },
  { key: "containers", icon: Boxes, href: "#/docs/installation/containers.md" },
] as const;

const GUIDES = [
  { key: "start", href: "#/docs/home/welcome.md" },
  { key: "connect", href: "#/docs/connections/connecting-to-a-provider.md" },
  { key: "characters", href: "#/docs/characters/creating-and-editing-characters.md" },
  { key: "lorebooks", href: "#/docs/lorebooks/overview.md" },
  { key: "agents", href: "#/docs/agents/agents-overview.md" },
  { key: "mari", href: "#/docs/home/professor-mari.md" },
] as const;

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]";
const PRIMARY_BUTTON = `inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-6 text-sm font-semibold text-[var(--primary-foreground)] shadow-[0_10px_30px_-12px_var(--primary)] transition-[transform,opacity] hover:-translate-y-px hover:opacity-95 motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${FOCUS}`;
const SECONDARY_BUTTON = `inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--card)_80%,transparent)] px-6 text-sm font-semibold text-[var(--foreground)] backdrop-blur-sm transition-colors hover:bg-[var(--accent)] ${FOCUS}`;
const TEXT_LINK = `inline-flex min-h-11 w-fit items-center gap-1.5 text-sm font-semibold text-[var(--primary)] hover:underline ${FOCUS}`;
const EYEBROW = "text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]";
const SECTION_TITLE = "text-balance text-3xl font-bold leading-tight text-[var(--foreground)] sm:text-4xl";
// Layers move by var(--depth) times the pointer offset set on the stage.
const PARALLAX =
  "translate-x-[calc(var(--px,0)*var(--depth))] translate-y-[calc(var(--py,0)*var(--depth))] transition-transform duration-500 ease-out";
const SHOT = "block w-full rounded-xl border border-[var(--border)] object-cover shadow-2xl shadow-black/30";

const external = (href: string) => (href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {});

export function DemoLanding() {
  const { t } = useTranslation();
  const mari = useMariAppearancePack();
  const [mode, setMode] = useState<(typeof MODES)[number]["key"]>("roleplay");
  const active = MODES.find((item) => item.key === mode) ?? MODES[0];
  const stageRef = useRef<HTMLDivElement>(null);

  // Pointer parallax for the hero stage: mouse only, never with reduced motion.
  const tilt = (event: PointerEvent<HTMLElement>) => {
    const stage = stageRef.current;
    if (!stage || event.pointerType !== "mouse" || reducedMotion()) return;
    const box = event.currentTarget.getBoundingClientRect();
    stage.style.setProperty("--px", String(((event.clientX - box.left) / box.width) * 2 - 1));
    stage.style.setProperty("--py", String(((event.clientY - box.top) / box.height) * 2 - 1));
  };

  useEffect(() => {
    document.title = "Marinara Engine";
  }, []);

  return (
    <div data-testid="demo-product-home" className="relative isolate w-full overflow-x-clip">
      {/* Ambient light, behind every section */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[56rem] [[data-demo-site]_&]:-top-12 bg-[radial-gradient(55%_45%_at_78%_18%,color-mix(in_srgb,var(--primary)_22%,transparent),transparent_70%),radial-gradient(40%_35%_at_8%_8%,color-mix(in_srgb,var(--primary)_10%,transparent),transparent_70%)]"
      />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-20 px-4 pb-20 pt-10 sm:gap-24 sm:px-8 sm:pt-16">
        {/* Hero: one promise, one action, and a scripted story playing beside it */}
        <section
          aria-labelledby="demo-product-title"
          onPointerMove={tilt}
          onPointerLeave={() => {
            stageRef.current?.style.removeProperty("--px");
            stageRef.current?.style.removeProperty("--py");
          }}
          className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-10"
        >
          <div className="flex flex-col gap-7">
            <span className="inline-flex w-fit items-center gap-2.5 rounded-full border border-[var(--border)] bg-[color-mix(in_srgb,var(--card)_70%,transparent)] py-1 pl-1 pr-3.5 text-xs font-semibold text-[var(--foreground)]">
              <img src={asset("logo.png")} alt="" width={24} height={24} className="h-6 w-6 rounded-full" />
              {t("demo.product.badge")}
            </span>
            <h1
              id="demo-product-title"
              className="text-balance text-4xl font-bold leading-[1.05] tracking-tight text-[var(--foreground)] sm:text-5xl xl:text-6xl"
            >
              {t("demo.landing.title")}
            </h1>
            <p className="max-w-[52ch] text-pretty text-base leading-relaxed text-[var(--muted-foreground)] sm:text-lg">
              {t("demo.landing.lede")}
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
              <a href="#/demo" className={PRIMARY_BUTTON}>
                <Play className="h-4 w-4" aria-hidden="true" />
                {t("demo.site.try")}
              </a>
              <a href="#/download" className={cn(TEXT_LINK, "self-center")}>
                <Download className="h-4 w-4" aria-hidden="true" />
                {t("demo.landing.install")}
              </a>
            </div>
            <p className="text-xs text-[var(--muted-foreground)]">{t("demo.landing.heroNote")}</p>
          </div>

          {/* Stage: a scripted chat plays in the app frame, a real screen behind, Mari at the edge */}
          <div ref={stageRef} className="relative pb-16 sm:pb-20 lg:pl-6">
            <img
              src={asset("website/Desktop_DM_Conversation.webp")}
              alt=""
              width={1920}
              height={1080}
              loading="lazy"
              className={`${SHOT} ${PARALLAX} absolute -right-3 -top-6 hidden w-[62%] rotate-[4deg] opacity-50 [--depth:-8px] sm:block lg:-right-8`}
            />
            <figure
              className={`${PARALLAX} relative overflow-hidden rounded-2xl border border-[var(--border)] shadow-2xl shadow-black/40 ring-1 ring-[color-mix(in_srgb,var(--primary)_25%,transparent)] [--depth:4px]`}
            >
              <img src={DEMO_ASSETS.harbor} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/45 to-black/75" />
              <div className="relative flex items-center gap-3 border-b border-white/10 bg-black/35 px-4 py-2.5 text-xs text-white/75 backdrop-blur-md">
                <span className="flex gap-1.5" aria-hidden="true">
                  <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
                  <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
                  <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
                </span>
                <Drama className="h-3.5 w-3.5 text-[var(--primary)]" aria-hidden="true" />
                <span className="truncate font-semibold text-white">{t("demo.landing.teaser.chat")}</span>
                <span className="ml-auto shrink-0 rounded-full border border-white/20 px-2 py-0.5 text-[0.6875rem]">
                  {t("demo.landing.teaser.scripted")}
                </span>
              </div>
              <HeroTeaser />
              <figcaption className="sr-only">{t("demo.landing.teaser.caption")}</figcaption>
            </figure>
            <div
              className={`${PARALLAX} absolute bottom-0 left-0 flex items-end gap-2 [--depth:14px] sm:-left-4 lg:-left-2`}
            >
              <img
                src={mari.poses.chibi}
                alt={t("demo.landing.mariAlt")}
                width={120}
                height={180}
                draggable={false}
                className="h-24 w-auto select-none object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.35)] sm:h-32"
              />
              <p className="mb-6 max-w-[15rem] rounded-2xl rounded-bl-sm border border-[var(--border)] bg-[var(--card)] px-3.5 py-2.5 text-xs font-medium leading-snug text-[var(--card-foreground)] shadow-lg sm:mb-12 sm:text-sm">
                {t("demo.product.mariHello")}
              </p>
            </div>
          </div>
        </section>

        {/* Proof: four true facts, each links to where you can check it */}
        <ul
          aria-label={t("demo.landing.proof.label")}
          className="-mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--border)] sm:-mt-14 lg:grid-cols-4"
        >
          {PROOF.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.key} className="flex">
                <a
                  href={item.href}
                  {...external(item.href)}
                  className={`group flex w-full flex-col gap-1.5 bg-[color-mix(in_srgb,var(--card)_92%,transparent)] p-4 transition-colors hover:bg-[var(--accent)] sm:p-5 ${FOCUS}`}
                >
                  <Icon className="h-5 w-5 text-[var(--primary)]" aria-hidden="true" />
                  <span className="text-sm font-semibold text-[var(--foreground)]">
                    {t(`demo.landing.proof.${item.key}.title`)}
                  </span>
                  <span className="text-xs leading-relaxed text-[var(--muted-foreground)]">
                    {t(`demo.landing.proof.${item.key}.body`)}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>

        {/* Mode tour: pick a mode, see the real screen and what it does */}
        <section aria-labelledby="demo-product-modes" className="flex flex-col gap-8">
          <div className="flex max-w-2xl flex-col gap-3">
            <span className={EYEBROW}>{t("demo.product.modesEyebrow")}</span>
            <h2 id="demo-product-modes" className={`${SECTION_TITLE} scroll-mt-20`}>
              {t("demo.landing.modes.title")}
            </h2>
            <p className="text-pretty text-base leading-relaxed text-[var(--muted-foreground)]">
              {t("demo.landing.modes.body")}
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3" role="group" aria-label={t("demo.landing.modes.title")}>
            {MODES.map((item) => {
              const Icon = item.icon;
              const selected = item.key === mode;
              return (
                <button
                  key={item.key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setMode(item.key)}
                  style={{ "--mode-accent": HOME_CHAT_MODE_ACCENTS[item.key] } as CSSProperties}
                  className={cn(
                    "flex min-h-14 items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                    FOCUS,
                    selected
                      ? "border-[color-mix(in_srgb,var(--mode-accent)_55%,var(--border))] bg-[color-mix(in_srgb,var(--mode-accent)_12%,var(--card))]"
                      : "border-[var(--border)] bg-[color-mix(in_srgb,var(--card)_60%,transparent)] hover:bg-[var(--accent)]",
                  )}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--mode-accent)_18%,transparent)] text-[var(--mode-accent)]">
                    <Icon className="h-[1.1rem] w-[1.1rem]" aria-hidden="true" />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-semibold text-[var(--foreground)]">
                      {t(`demo.landing.modes.${item.key}.eyebrow`)}
                    </span>
                    <span className="text-xs text-[var(--muted-foreground)]">
                      {t(`demo.product.modes.${item.key}.tagline`)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div
            style={{ "--mode-accent": HOME_CHAT_MODE_ACCENTS[active.key] } as CSSProperties}
            className="grid gap-8 rounded-3xl border border-[var(--border)] bg-[radial-gradient(70%_80%_at_0%_100%,color-mix(in_srgb,var(--mode-accent)_14%,transparent),transparent_70%),var(--card)] p-4 sm:p-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-center lg:p-8"
          >
            <img
              key={active.image}
              src={asset(active.image)}
              alt={t(`demo.landing.modes.${active.key}.alt`)}
              width={1920}
              height={1080}
              loading="lazy"
              className={`${SHOT} aspect-video`}
            />
            <div className="flex flex-col gap-4">
              <h3 className="text-2xl font-bold leading-tight text-[var(--card-foreground)]">
                {t(`demo.landing.modes.${active.key}.title`)}
              </h3>
              <p className="text-sm leading-relaxed text-[var(--muted-foreground)] sm:text-base">
                {t(`demo.landing.modes.${active.key}.body`)}
              </p>
              <ul className="flex flex-col gap-2.5 text-sm text-[var(--card-foreground)]">
                {active.points.map((point) => (
                  <li key={point} className="flex gap-2.5">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--mode-accent)]" aria-hidden="true" />
                    {t(`demo.product.modes.${active.key}.points.${point}`)}
                  </li>
                ))}
              </ul>
              <a href={active.href} className={TEXT_LINK}>
                {t(`demo.landing.modes.${active.key}.link`)}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>

        {/* Feature stories in Home module cards */}
        <section aria-labelledby="demo-product-stories" className="flex flex-col gap-8">
          <div className="flex max-w-2xl flex-col gap-3">
            <span className={EYEBROW}>{t("demo.landing.stories.eyebrow")}</span>
            <h2 id="demo-product-stories" className={SECTION_TITLE}>
              {t("demo.landing.stories.title")}
            </h2>
            <p className="text-pretty text-base leading-relaxed text-[var(--muted-foreground)]">
              {t("demo.landing.stories.body")}
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {STORIES.map((story) => (
              <FeedModule
                key={story.key}
                accent={story.accent}
                eyebrow={t(`demo.landing.stories.${story.key}.eyebrow`)}
                title={t(`demo.landing.stories.${story.key}.title`)}
                description={t(`demo.landing.stories.${story.key}.body`)}
                className="gap-4"
              >
                <img
                  src={asset(story.image)}
                  alt={t(`demo.landing.stories.${story.key}.alt`)}
                  width={story.width}
                  height={story.height}
                  loading="lazy"
                  className={cn(
                    "block rounded-xl border border-[var(--border)] shadow-lg shadow-black/25",
                    story.height > story.width ? "mx-auto h-72 w-auto" : "w-full",
                  )}
                />
                <a href={story.href} className={cn(TEXT_LINK, "mt-2")}>
                  {t(`demo.landing.stories.${story.key}.link`)}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
              </FeedModule>
            ))}
          </div>
        </section>

        {/* Bring your own model: honest cost and hardware notes */}
        <section
          aria-labelledby="demo-product-models"
          className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16"
        >
          <div className="flex flex-col gap-3">
            <span className={EYEBROW}>{t("demo.product.modelsEyebrow")}</span>
            <h2 id="demo-product-models" className={SECTION_TITLE}>
              {t("demo.landing.models.title")}
            </h2>
            <p className="text-pretty text-base leading-relaxed text-[var(--muted-foreground)]">
              {t("demo.landing.models.body")}
            </p>
          </div>
          <ul className="flex flex-col divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--card)_70%,transparent)]">
            {MODEL_OPTIONS.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.key} className="flex gap-4 p-5 sm:p-6">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--primary)_14%,transparent)] text-[var(--primary)]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="flex min-w-0 flex-col gap-1">
                    <h3 className="text-base font-bold text-[var(--foreground)]">
                      {t(`demo.landing.models.${item.key}.title`)}
                    </h3>
                    <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">
                      {t(`demo.landing.models.${item.key}.body`)}
                    </p>
                    <a href={item.href} {...external(item.href)} className={TEXT_LINK}>
                      {t(`demo.landing.models.${item.key}.link`)}
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Professor Mari as the guide into the docs and the scripted chat */}
        <section
          aria-labelledby="demo-product-guide"
          className="relative grid gap-8 overflow-hidden rounded-3xl border border-[var(--border)] bg-[radial-gradient(60%_70%_at_15%_40%,color-mix(in_srgb,var(--primary)_16%,transparent),transparent_70%),var(--card)] p-5 sm:p-8 md:grid-cols-[auto_minmax(0,1fr)] md:gap-10 lg:p-12"
        >
          <img
            src={mari.poses.explaining}
            alt={t("demo.landing.mariAlt")}
            width={240}
            height={360}
            loading="lazy"
            draggable={false}
            className="mx-auto h-48 w-auto select-none object-contain drop-shadow-[0_16px_24px_rgba(0,0,0,0.35)] sm:h-64 md:mx-0 md:self-end lg:h-80"
          />
          <div className="flex min-w-0 flex-col gap-5">
            <div className="flex flex-col gap-3">
              <span className={EYEBROW}>{t("demo.landing.guides.mari.title")}</span>
              <h2 id="demo-product-guide" className={SECTION_TITLE}>
                {t("demo.product.guideTitle")}
              </h2>
            </div>
            <p className="w-fit max-w-[48ch] rounded-2xl rounded-tl-sm bg-[var(--secondary)] px-4 py-3 text-sm leading-relaxed text-[var(--secondary-foreground)]">
              {t("demo.product.guideBubble")}
            </p>
            <ul className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2">
              {GUIDES.map((guide) => (
                <li key={guide.key}>
                  <a
                    href={guide.href}
                    className={`group flex min-h-14 items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 transition-colors hover:border-[color-mix(in_srgb,var(--primary)_45%,var(--border))] ${FOCUS}`}
                  >
                    <BookOpen className="h-4 w-4 shrink-0 text-[var(--primary)]" aria-hidden="true" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-sm font-semibold text-[var(--foreground)]">
                        {t(`demo.landing.guides.${guide.key}.title`)}
                      </span>
                      <span className="text-xs text-[var(--muted-foreground)]">
                        {t(`demo.landing.guides.${guide.key}.body`)}
                      </span>
                    </span>
                    <ArrowRight
                      className="h-4 w-4 shrink-0 text-[var(--muted-foreground)] transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                      aria-hidden="true"
                    />
                  </a>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-[52ch] text-xs leading-relaxed text-[var(--muted-foreground)]">
                {t("demo.landing.preview.honest")}
              </p>
              <a href="#/demo" className={`${SECONDARY_BUTTON} shrink-0`}>
                <Play className="h-4 w-4" aria-hidden="true" />
                {t("demo.product.tryChat")}
              </a>
            </div>
          </div>
        </section>

        {/* Install: platform guides and the download page */}
        <section aria-labelledby="demo-product-install" className="flex flex-col gap-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex max-w-2xl flex-col gap-3">
              <span className={EYEBROW}>{t("demo.product.installEyebrow")}</span>
              <h2 id="demo-product-install" className={SECTION_TITLE}>
                {t("demo.landing.platforms.title")}
              </h2>
              <p className="text-pretty text-base leading-relaxed text-[var(--muted-foreground)]">
                {t("demo.landing.platforms.body")}
              </p>
            </div>
            <a href="#/download" className={`${PRIMARY_BUTTON} shrink-0`}>
              <Download className="mari-rgb-static-icon h-4 w-4" aria-hidden="true" />
              {t("demo.landing.install")}
            </a>
          </div>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {PLATFORMS.map((platform) => {
              const Icon = platform.icon;
              return (
                <li key={platform.key} className="last:col-span-2 sm:last:col-span-1">
                  <a
                    href={platform.href}
                    className={`group flex h-full min-h-24 flex-col justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:bg-[var(--accent)] ${FOCUS}`}
                  >
                    <Icon className="h-5 w-5 text-[var(--primary)]" aria-hidden="true" />
                    <span className="flex items-end justify-between gap-2 text-sm font-semibold text-[var(--card-foreground)]">
                      {t(`demo.landing.platforms.${platform.key}`)}
                      <ArrowRight
                        className="h-4 w-4 shrink-0 text-[var(--muted-foreground)] transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                        aria-hidden="true"
                      />
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Final call to action, closing like the Home hero */}
        <section
          aria-labelledby="demo-product-cta"
          className="relative flex flex-col items-center gap-5 overflow-hidden rounded-3xl border border-[color-mix(in_srgb,var(--primary)_30%,var(--border))] bg-[radial-gradient(60%_80%_at_50%_0%,color-mix(in_srgb,var(--primary)_18%,transparent),transparent_70%),var(--card)] px-5 py-10 text-center sm:py-14"
        >
          <img
            src={mari.poses.wave}
            alt=""
            width={120}
            height={180}
            draggable={false}
            className="h-28 w-auto select-none object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.35)]"
          />
          <h2 id="demo-product-cta" className={cn(SECTION_TITLE, "max-w-2xl")}>
            {t("demo.landing.cta.title")}
          </h2>
          <p className="max-w-[48ch] text-pretty text-base leading-relaxed text-[var(--muted-foreground)]">
            {t("demo.landing.cta.body")}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <a href="#/download" className={PRIMARY_BUTTON}>
              <Download className="mari-rgb-static-icon h-4 w-4" aria-hidden="true" />
              {t("demo.landing.install")}
            </a>
            <a href="#/demo" className={SECONDARY_BUTTON}>
              <Play className="h-4 w-4" aria-hidden="true" />
              {t("demo.product.tryChat")}
            </a>
          </div>
        </section>

        <footer className="flex flex-col gap-4 border-t border-[var(--border)] pt-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <img src={asset("logo.png")} alt="" width={32} height={32} className="h-8 w-8 rounded-lg" />
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-[var(--foreground)]">
                {t("demo.landing.community.title")}
              </span>
              <span className="text-xs text-[var(--muted-foreground)]">{t("demo.landing.community.body")}</span>
            </div>
          </div>
          <nav aria-label={t("demo.landing.community.title")} className="flex flex-wrap gap-2">
            <a href="#/docs" className={SECONDARY_BUTTON}>
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              {t("demo.landing.readDocs")}
            </a>
            {(
              [
                { key: "github", href: GITHUB_URL },
                { key: "discord", href: DISCORD_URL },
              ] as const
            ).map((link) => (
              <a key={link.key} href={link.href} {...external(link.href)} className={SECONDARY_BUTTON}>
                {t(`demo.landing.community.${link.key}`)}
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            ))}
          </nav>
        </footer>
      </div>
    </div>
  );
}

/** Roleplay actions are written *like this*; an unclosed one stays italic while it types. */
const italicActions = (text: string) => text.split("*").map((part, i) => (i % 2 ? <em key={i}>{part}</em> : part));

/** Hero chat: a scripted exchange that types itself, then the next one. Reduced motion shows the first one finished. */
function HeroTeaser() {
  const { t } = useTranslation();
  const [exchange, setExchange] = useState(0);
  const [tick, setTick] = useState(() => (reducedMotion() ? Number.POSITIVE_INFINITY : -TEASER_WAIT_TICKS));
  const key = TEASER[exchange];
  const words = t(`demo.landing.teaser.${key}.reply`).split(/(?<=\s)/);

  useEffect(() => {
    if (!Number.isFinite(tick)) return;
    const timer = window.setTimeout(() => {
      if (tick < words.length + TEASER_HOLD_TICKS) return setTick(tick + 1);
      setExchange((exchange + 1) % TEASER.length);
      setTick(-TEASER_WAIT_TICKS);
    }, TEASER_TICK_MS);
    return () => window.clearTimeout(timer);
  }, [tick, exchange, words.length]);

  const bubble = "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-lg backdrop-blur-md";
  return (
    <div
      aria-hidden="true"
      className="relative flex min-h-[22rem] flex-col justify-end gap-3 p-4 pb-12 sm:min-h-[25rem] sm:p-5 sm:pb-16"
    >
      <div className="flex items-end gap-2.5">
        <img
          src={DEMO_ASSETS.iris}
          alt=""
          className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-white/30"
        />
        <p className={`${bubble} rounded-bl-sm bg-black/55 text-white/90`}>
          {italicActions(t("demo.landing.teaser.greeting"))}
        </p>
      </div>
      <p
        key={`user-${exchange}`}
        className={`${bubble} animate-message-in self-end rounded-br-sm bg-[var(--primary)] text-[var(--primary-foreground)]`}
      >
        {t(`demo.landing.teaser.${key}.user`)}
      </p>
      <div key={`reply-${exchange}`} className="flex items-start gap-2.5">
        <img
          src={DEMO_ASSETS.iris}
          alt=""
          className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-white/30"
        />
        <div className="flex min-w-0 flex-col items-start gap-1.5">
          {tick < 0 ? (
            <p className={`${bubble} flex gap-1 rounded-bl-sm bg-black/55`}>
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="h-2 w-2 animate-pulse rounded-full bg-white/70"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </p>
          ) : (
            <>
              <p className={`${bubble} rounded-bl-sm bg-black/55 text-white/90`}>
                {italicActions(words.slice(0, tick + 1).join(""))}
              </p>
              <span className="animate-fade-in-up inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/40 px-2.5 py-1 text-[0.6875rem] text-white/80 backdrop-blur-md">
                <BookOpen className="h-3 w-3 text-[var(--primary)]" />
                {t(`demo.landing.teaser.${key}.entry`)}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
