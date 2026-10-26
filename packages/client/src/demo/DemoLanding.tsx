// ──────────────────────────────────────────────
// Static demo: product page on the Home tab
// ──────────────────────────────────────────────
import { useEffect, useState, type CSSProperties } from "react";
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

const AUDIENCES = [
  { key: "writers", accent: HOME_CHAT_MODE_ACCENTS.roleplay, href: "#/docs/roleplay/getting-started.md" },
  { key: "fans", accent: HOME_CHAT_MODE_ACCENTS.conversation, href: "#/docs/conversation/getting-started.md" },
  { key: "players", accent: HOME_CHAT_MODE_ACCENTS.game, href: "#/docs/game/getting-started.md" },
  { key: "builders", accent: HOME_MODULE_ACCENTS.violet, href: "#/docs/agents/agents-overview.md" },
] as const;

const DATA_LINKS = [
  { key: "where", href: "#/docs/data/where-data-is-stored.md" },
  { key: "backup", href: "#/docs/data/backup-and-restore.md" },
] as const;

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
const SHOT = "block w-full rounded-xl border border-[var(--border)] object-cover shadow-2xl shadow-black/30";

const external = (href: string) => (href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {});

export function DemoLanding() {
  const { t } = useTranslation();
  const mari = useMariAppearancePack();
  const [mode, setMode] = useState<(typeof MODES)[number]["key"]>("roleplay");
  const active = MODES.find((item) => item.key === mode) ?? MODES[0];

  useEffect(() => {
    document.title = "Marinara Engine";
  }, []);

  return (
    <div data-testid="demo-product-home" className="relative isolate w-full overflow-x-clip">
      {/* Ambient light, behind every section */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[56rem] bg-[radial-gradient(55%_45%_at_78%_18%,color-mix(in_srgb,var(--primary)_22%,transparent),transparent_70%),radial-gradient(40%_35%_at_8%_8%,color-mix(in_srgb,var(--primary)_10%,transparent),transparent_70%)]"
      />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-24 px-4 pb-20 pt-10 sm:gap-28 sm:px-8 sm:pt-16">
        {/* Hero: promise and actions, then a staged view of the real app */}
        <section
          aria-labelledby="demo-product-title"
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
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <a href="#/download" className={PRIMARY_BUTTON}>
                <Download className="mari-rgb-static-icon h-4 w-4" aria-hidden="true" />
                {t("demo.landing.install")}
              </a>
              <a href="#/demo" className={SECONDARY_BUTTON}>
                <Play className="h-4 w-4" aria-hidden="true" />
                {t("demo.product.tryChat")}
              </a>
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--muted-foreground)]">
              {(["free", "local", "models"] as const).map((fact) => (
                <li key={fact} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]" aria-hidden="true" />
                  {t(`demo.product.facts.${fact}`)}
                </li>
              ))}
            </ul>
          </div>

          {/* Stage: roleplay view in front, conversation view behind, Mari at the edge */}
          <div className="relative pb-10 sm:pb-14 lg:pl-6">
            <img
              src={asset("website/Desktop_DM_Conversation.webp")}
              alt=""
              width={1920}
              height={1080}
              loading="lazy"
              className={`${SHOT} absolute -right-3 -top-6 hidden w-[62%] rotate-[4deg] opacity-70 sm:block lg:-right-8`}
            />
            <figure className="relative">
              <img
                src={asset("website/Desktop_Roleplay_View.webp")}
                alt={t("demo.landing.modes.roleplay.alt")}
                width={1920}
                height={1080}
                className={`${SHOT} aspect-video ring-1 ring-[color-mix(in_srgb,var(--foreground)_8%,transparent)]`}
              />
              <figcaption className="sr-only">{t("demo.landing.installedLabel")}</figcaption>
            </figure>
            <div className="absolute -bottom-2 left-0 flex items-end gap-2 sm:-left-4 sm:bottom-0 lg:-left-2">
              <img
                src={mari.poses.chibi}
                alt={t("demo.landing.mariAlt")}
                width={120}
                height={180}
                draggable={false}
                className="h-24 w-auto select-none object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.35)] sm:h-32"
              />
              <p className="mb-8 max-w-[15rem] rounded-2xl rounded-bl-sm border border-[var(--border)] bg-[var(--card)] px-3.5 py-2.5 text-xs font-medium leading-snug text-[var(--card-foreground)] shadow-lg sm:mb-12 sm:text-sm">
                {t("demo.product.mariHello")}
              </p>
            </div>
          </div>
        </section>

        {/* Mode tour: pick a mode, see the real screen and what it does */}
        <section aria-labelledby="demo-product-modes" className="flex flex-col gap-8">
          <div className="flex max-w-2xl flex-col gap-3">
            <span className={EYEBROW}>{t("demo.product.modesEyebrow")}</span>
            <h2 id="demo-product-modes" className={SECTION_TITLE}>
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

        {/* Who it is for */}
        <section aria-labelledby="demo-product-audience" className="flex flex-col gap-8">
          <div className="flex max-w-2xl flex-col gap-3">
            <span className={EYEBROW}>{t("demo.landing.audience.eyebrow")}</span>
            <h2 id="demo-product-audience" className={SECTION_TITLE}>
              {t("demo.landing.audience.title")}
            </h2>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {AUDIENCES.map((item) => (
              <li key={item.key} className="flex">
                <FeedModule
                  accent={item.accent}
                  eyebrow={t(`demo.landing.audience.${item.key}.eyebrow`)}
                  title={t(`demo.landing.audience.${item.key}.title`)}
                  description={t(`demo.landing.audience.${item.key}.body`)}
                  className="w-full"
                >
                  <a href={item.href} className={cn(TEXT_LINK, "mt-auto")}>
                    {t(`demo.landing.audience.${item.key}.link`)}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </a>
                </FeedModule>
              </li>
            ))}
          </ul>
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

        {/* Own your data */}
        <section>
          <FeedModule
            accent={HOME_MODULE_ACCENTS.cyan}
            eyebrow={t("demo.landing.data.eyebrow")}
            title={t("demo.landing.data.title")}
            description={t("demo.landing.data.body")}
            className="gap-4"
          >
            <ul className="grid gap-3 text-sm leading-relaxed text-[var(--card-foreground)] md:grid-cols-3">
              {(["provider", "folder", "keys"] as const).map((point) => (
                <li
                  key={point}
                  className="rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_60%,transparent)] p-4"
                >
                  {t(`demo.landing.data.points.${point}`)}
                </li>
              ))}
            </ul>
            <div className="mt-2 flex flex-wrap gap-x-6">
              {DATA_LINKS.map((item) => (
                <a key={item.key} href={item.href} className={TEXT_LINK}>
                  {t(`demo.landing.data.links.${item.key}`)}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
              ))}
            </div>
          </FeedModule>
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

        {/* Open source */}
        <section>
          <FeedModule
            accent={HOME_MODULE_ACCENTS.orange}
            eyebrow={t("demo.landing.source.eyebrow")}
            title={t("demo.landing.source.title")}
            description={t("demo.landing.source.body")}
          >
            <div className="mt-2 flex flex-wrap gap-3">
              <a href={GITHUB_URL} {...external(GITHUB_URL)} className={SECONDARY_BUTTON}>
                <Code className="h-4 w-4" aria-hidden="true" />
                {t("demo.landing.source.github")}
              </a>
              <a href={DISCORD_URL} {...external(DISCORD_URL)} className={SECONDARY_BUTTON}>
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                {t("demo.landing.source.discord")}
              </a>
            </div>
          </FeedModule>
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
