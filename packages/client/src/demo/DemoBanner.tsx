// ──────────────────────────────────────────────
// Static demo: persistent banner + guided lessons
// ──────────────────────────────────────────────
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { APP_VERSION } from "@marinara-engine/shared";
import { ArrowLeft, BookOpen, Check, Code, Download, GitBranch, Home, Menu, RotateCcw } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { OnboardingTutorialInner, type TourStep } from "../components/onboarding/OnboardingTutorial";
import { showConfirmDialog } from "../lib/app-dialogs";
import { useChatStore } from "../stores/chat.store";
import { isMobileShellViewport, useUIStore, type Panel } from "../stores/ui.store";
import { resetDemo } from "./runtime";
import { DEMO_SEED_IDS } from "./seed";
import { useDemoNavigation } from "./navigation";
import { MarinaraWordmark } from "../components/chat/HomeBrowserHub";
import { DISCORD_URL, GITHUB_URL, asset } from "./DemoLanding";

// ponytail: fork trial branch; point at the release tag once demos publish from stable tags.
const SOURCE_URL = "https://github.com/Gunterlie/Marinara-Engine/tree/feat/static-demo-tutorial";
const DONE_KEY = `marinara-demo:lessons-done:${APP_VERSION}`;
const WELCOMED_KEY = `marinara-demo:welcomed:${APP_VERSION}`;

function openChat() {
  const ui = useUIStore.getState();
  ui.closeAllDetails();
  ui.closeRightPanel();
  if (isMobileShellViewport()) ui.setSidebarOpen(false);
  useChatStore.getState().setActiveChatId(DEMO_SEED_IDS.chatId);
}

function openPanel(panel: Panel) {
  const ui = useUIStore.getState();
  ui.closeAllDetails();
  if (isMobileShellViewport()) ui.setSidebarOpen(false);
  ui.openRightPanel(panel);
}

const LESSONS = {
  chat: [
    { target: "chat-area", centerCard: true, enter: openChat, sprite: { pose: "greet" } },
    { target: "chat-area", centerCard: true, enter: openChat, sprite: { pose: "wave" } },
    { target: "chat-area", centerCard: true, enter: openChat, sprite: { pose: "point-middle" } },
    { target: "chat-area", centerCard: true, enter: openChat, sprite: { pose: "point-middle" } },
  ],
  character: [
    {
      target: "panel-characters",
      side: "bottom",
      enter: () => openPanel("characters"),
      sprite: { pose: "point-up", flip: true },
    },
    {
      target: null,
      enter: () => useUIStore.getState().openCharacterDetail(DEMO_SEED_IDS.characterId),
      sprite: { pose: "wave" },
    },
  ],
  lorebook: [
    {
      target: "panel-lorebooks",
      side: "bottom",
      enter: () => openPanel("lorebooks"),
      sprite: { pose: "point-up", flip: true },
    },
    {
      target: null,
      enter: () => useUIStore.getState().openLorebookDetail(DEMO_SEED_IDS.lorebookId),
      sprite: { pose: "wave" },
    },
    { target: "chat-area", centerCard: true, enter: openChat, sprite: { pose: "point-middle" } },
  ],
} satisfies Record<string, TourStep[]>;

type LessonId = keyof typeof LESSONS;
export const LESSON_IDS = Object.keys(LESSONS) as LessonId[];
export const PROGRESS_EVENT = "marinara-demo-progress";

function lessonSteps(id: LessonId): TourStep[] {
  return LESSONS[id].map((step, i) => ({
    ...step,
    titleKey: `demo.lessons.${id}.step${i + 1}.title`,
    bodyKey: `demo.lessons.${id}.step${i + 1}.body`,
  }));
}

export function readDone(): LessonId[] {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(DONE_KEY) ?? "[]");
    return Array.isArray(stored) ? stored.filter((id): id is LessonId => LESSON_IDS.includes(id)) : [];
  } catch {
    return [];
  }
}

const BUTTON_CLASS =
  "flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-[var(--marinara-chat-chrome-panel-text)] transition-colors hover:bg-[var(--marinara-chat-chrome-highlight-bg)] focus-visible:outline-2 focus-visible:outline-[var(--marinara-chat-chrome-focus-ring)]";

const NAV_LINK =
  "relative inline-flex h-9 items-center rounded-md px-2.5 text-[0.8125rem] font-medium text-[var(--muted-foreground)] transition-colors [@media(pointer:coarse)]:h-11 hover:text-[var(--foreground)] aria-[current=page]:text-[var(--foreground)] after:absolute after:inset-x-2.5 after:bottom-1.5 after:h-px after:origin-left after:scale-x-0 after:rounded-full after:bg-current after:transition-transform hover:after:scale-x-100 aria-[current=page]:after:scale-x-100 aria-[current=page]:after:bg-[var(--primary)] motion-reduce:after:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-app-accent-solid)]";

const subscribeHash = (notify: () => void) => {
  window.addEventListener("hashchange", notify);
  return () => window.removeEventListener("hashchange", notify);
};

// Features is a section of the home page, so the link scrolls there once home shows.
function showFeatures(event: ReactMouseEvent<HTMLAnchorElement>) {
  const scroll = () =>
    requestAnimationFrame(() =>
      document.getElementById("demo-product-modes")?.scrollIntoView({
        block: "start",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      }),
    );
  if (window.location.hash !== "#/") return window.addEventListener("hashchange", scroll, { once: true });
  event.preventDefault();
  scroll();
}

// The website part of the one shared bar. Website pages give it the whole bar; in the demo workspace the Engine
// controls follow it, so its links wait for wide screens and the demo menu carries them.
export function DemoSiteStart({ site }: { site: boolean }) {
  const { t } = useUiTranslation();
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash);
  const external = { target: "_blank", rel: "noreferrer" };
  return (
    <div
      data-testid="demo-site-header"
      className={`flex min-w-0 items-center ${site ? "mx-auto w-full max-w-6xl flex-1 gap-2 sm:px-4 xl:px-8" : "shrink-0 gap-1"}`}
    >
      {!site && <span aria-hidden="true" className="mr-1 h-5 w-px bg-[var(--border)] max-md:hidden" />}
      <a
        href="#/"
        aria-label={t("demo.docs.home")}
        className={`flex shrink-0 items-center gap-2 rounded-md pr-1 ${site ? "" : "max-md:hidden"} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-app-accent-solid)]`}
      >
        <img src={asset("logo.png")} alt="" width={32} height={32} className="h-7 w-7 object-contain" />
        <MarinaraWordmark className={`text-sm ${site ? "block" : "hidden lg:block"}`} />
      </a>
      <DemoBanner site={site} />
      {!site && (
        <a
          href="#/"
          data-testid="demo-back-to-site"
          className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full border border-[var(--border)] px-3 max-md:w-9 max-md:px-0 text-[0.8125rem] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-app-accent-solid)] [@media(pointer:coarse)]:h-11"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span className="max-md:sr-only">{t("demo.site.back")}</span>
        </a>
      )}
      <nav
        aria-label={t("demo.site.navigation")}
        className={`items-center gap-0.5 ${site ? "mx-auto hidden md:flex" : "hidden"}`}
      >
        <a href="#/" onClick={showFeatures} className={NAV_LINK}>
          {t("demo.site.features")}
        </a>
        <a href="#/docs" aria-current={hash.startsWith("#/docs") ? "page" : undefined} className={NAV_LINK}>
          {t("demo.site.docs")}
        </a>
        <a href="#/download" aria-current={hash === "#/download" ? "page" : undefined} className={NAV_LINK}>
          {t("demo.site.download")}
        </a>
        <a href={GITHUB_URL} {...external} className={NAV_LINK}>
          {t("demo.landing.community.github")}
        </a>
        <a
          href={DISCORD_URL}
          {...external}
          aria-label={t("demo.landing.community.discord")}
          title={t("demo.landing.community.discord")}
          className="group inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11 hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-app-accent-solid)]"
        >
          <img
            src={asset("home/tab-icons/discord.svg")}
            alt=""
            className="h-4 w-4 opacity-60 transition-opacity group-hover:opacity-100 [[data-theme=light]_&]:invert"
          />
        </a>
      </nav>
      {site && (
        <a
          href="#/demo"
          data-testid="demo-site-try"
          className="ml-auto inline-flex h-9 shrink-0 items-center rounded-full bg-[var(--primary)] px-4 text-[0.8125rem] font-semibold text-[var(--primary-foreground)] transition-opacity [@media(pointer:coarse)]:h-11 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-app-accent-solid)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] md:ml-0"
        >
          {t("demo.site.try")}
        </a>
      )}
    </div>
  );
}

export function DemoNavigation() {
  useDemoNavigation();
  return null;
}

export function DemoBanner({ site }: { site: boolean }) {
  const { t } = useUiTranslation();
  const [lessonsOpen, setLessonsOpen] = useState(false);
  const [lesson, setLesson] = useState<LessonId | null>(null);
  const [done, setDone] = useState(readDone);
  const steps = useMemo(() => (lesson ? lessonSteps(lesson) : null), [lesson]);

  const lessonsButtonRef = useRef<HTMLButtonElement>(null);
  // Only a lesson picked from the menu returns focus there; the automatic welcome must not leave a focus ring.
  const fromMenu = useRef(false);
  const lessonsListRef = useRef<HTMLUListElement>(null);

  const [position, setPosition] = useState({ top: 48, left: 8 });
  useLayoutEffect(() => {
    if (!lessonsOpen) return;
    const update = () => {
      const rect = lessonsButtonRef.current?.getBoundingClientRect();
      if (rect) setPosition({ top: rect.bottom + 6, left: Math.max(8, Math.min(rect.left, window.innerWidth - 264)) });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [lessonsOpen]);
  // Until a first lesson ends (done or skipped), opening the workspace starts Mari's welcome lesson.
  useEffect(() => {
    const welcome = () => {
      if (window.location.hash === "#/demo" && !localStorage.getItem(WELCOMED_KEY)) setLesson("chat");
    };
    welcome();
    window.addEventListener("hashchange", welcome);
    return () => window.removeEventListener("hashchange", welcome);
  }, []);

  useEffect(() => {
    const open = () => setLessonsOpen(true);
    window.addEventListener("marinara-demo-lessons", open);
    return () => window.removeEventListener("marinara-demo-lessons", open);
  }, []);

  // Close the lessons menu on an outside press, like other menus.
  useEffect(() => {
    if (!lessonsOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!lessonsListRef.current?.contains(target) && !lessonsButtonRef.current?.contains(target)) {
        setLessonsOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [lessonsOpen]);

  useEffect(() => {
    if (lessonsOpen) lessonsListRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [lessonsOpen]);

  const closeLessonsOnEscape = (event: ReactKeyboardEvent) => {
    if (event.key !== "Escape" || !lessonsOpen) return;
    event.stopPropagation();
    setLessonsOpen(false);
    lessonsButtonRef.current?.focus();
  };

  const startLesson = (id: LessonId) => {
    setLessonsOpen(false);
    const ui = useUIStore.getState();
    if (!useChatStore.getState().activeChatId && !ui.hasAnyDetailOpen() && !ui.rightPanelOpen) openChat();
    fromMenu.current = true;
    setLesson(id);
  };

  const finishLesson = (completed: boolean) => {
    try {
      localStorage.setItem(WELCOMED_KEY, "1");
    } catch {
      /* storage unavailable: the welcome may show again */
    }
    if (completed && lesson && !done.includes(lesson)) {
      const next = [...done, lesson];
      setDone(next);
      window.setTimeout(() => window.dispatchEvent(new Event(PROGRESS_EVENT)));
      try {
        window.localStorage.setItem(DONE_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable — the check mark lasts for this page only */
      }
    }
    setLesson(null);
    if (fromMenu.current) requestAnimationFrame(() => lessonsButtonRef.current?.focus());
    fromMenu.current = false;
  };

  const confirmReset = async () => {
    const confirmed = await showConfirmDialog({
      title: t("demo.reset.title"),
      message: t("demo.reset.message"),
      confirmLabel: t("demo.reset.confirm"),
      tone: "destructive",
    });
    if (confirmed) resetDemo();
  };

  return (
    <>
      <section
        data-testid="demo-banner"
        aria-label={t("demo.banner.label")}
        className={`shrink-0 ${site ? "max-md:order-last" : ""}`}
      >
        <button
          ref={lessonsButtonRef}
          type="button"
          data-testid="demo-tutorial"
          aria-label={t("demo.banner.badge", { version: APP_VERSION })}
          title={t("demo.banner.badge", { version: APP_VERSION })}
          aria-expanded={lessonsOpen}
          aria-controls={lessonsOpen ? "demo-lessons" : undefined}
          onClick={() => setLessonsOpen((value) => !value)}
          onKeyDown={closeLessonsOnEscape}
          className={`group inline-flex h-9 items-center justify-center rounded-md text-[var(--foreground)] [@media(pointer:coarse)]:h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-app-accent-solid)] ${site ? "w-9 hover:bg-[var(--accent)] [@media(pointer:coarse)]:w-11 md:w-auto md:px-1 md:hover:bg-transparent" : "px-1"}`}
        >
          <span
            className={`items-center gap-1 rounded-full border border-[var(--border)] px-2 py-0.5 text-[0.6875rem] font-medium leading-4 text-[var(--muted-foreground)] transition-colors group-hover:text-[var(--foreground)] group-aria-expanded:border-[color-mix(in_srgb,var(--primary)_50%,var(--border))] group-aria-expanded:text-[var(--foreground)] ${site ? "hidden md:inline-flex" : "inline-flex"}`}
          >
            {t("demo.controls.short")}
            <span className="hidden tabular-nums opacity-70 lg:inline">v{APP_VERSION}</span>
          </span>
          {site && <Menu className="h-5 w-5 md:hidden" aria-hidden="true" />}
        </button>
      </section>
      {lessonsOpen &&
        createPortal(
          // Portalled so it paints above the shell, which is mounted after the banner.
          <ul
            ref={lessonsListRef}
            id="demo-lessons"
            aria-label={t("demo.lessons.label")}
            onKeyDown={closeLessonsOnEscape}
            onBlur={(event) => {
              const target = event.relatedTarget as Node | null;
              if (!event.currentTarget.contains(target) && !lessonsButtonRef.current?.contains(target))
                setLessonsOpen(false);
            }}
            style={position}
            className="mari-chrome-token-scope fixed z-[9990] flex max-h-[calc(100dvh-4rem)] w-64 max-w-[calc(100vw-1rem)] flex-col gap-0.5 overflow-y-auto rounded-xl border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-panel-bg)] p-1 shadow-lg backdrop-blur-xl"
          >
            <li className="px-3 py-2 text-xs text-[var(--muted-foreground)]">{t("demo.controls.info")}</li>
            {LESSON_IDS.map((id) => (
              <li key={id}>
                <button
                  type="button"
                  data-testid={`demo-lesson-${id}`}
                  onClick={() => startLesson(id)}
                  className={`${BUTTON_CLASS} w-full justify-start`}
                >
                  {done.includes(id) ? (
                    <Check aria-hidden="true" className="h-3.5 w-3.5 text-[var(--marinara-chat-chrome-accent)]" />
                  ) : (
                    <span aria-hidden="true" className="h-3.5 w-3.5" />
                  )}
                  <span>{t(`demo.lessons.${id}.title`)}</span>
                  {done.includes(id) && <span className="sr-only">{t("demo.lessons.done")}</span>}
                </button>
              </li>
            ))}
            <li>
              <a
                href="#/"
                data-testid="demo-home"
                className={`${BUTTON_CLASS} w-full justify-start`}
                onClick={() => setLessonsOpen(false)}
              >
                <Home size={14} aria-hidden="true" />
                {t("demo.docs.home")}
              </a>
            </li>
            <li>
              <a
                href="#/docs"
                data-testid="demo-docs-link"
                className={`${BUTTON_CLASS} w-full justify-start`}
                onClick={() => setLessonsOpen(false)}
              >
                <BookOpen size={14} aria-hidden="true" />
                {t("demo.docs.title")}
              </a>
            </li>
            <li>
              <a href="#/download" data-testid="demo-download" className={`${BUTTON_CLASS} w-full justify-start`}>
                <Download size={14} aria-hidden="true" />
                {t("demo.site.download")}
              </a>
            </li>
            <li className={site ? "md:hidden" : undefined}>
              <a href={GITHUB_URL} target="_blank" rel="noreferrer" className={`${BUTTON_CLASS} w-full justify-start`}>
                <GitBranch size={14} aria-hidden="true" />
                {t("demo.landing.community.github")}
              </a>
            </li>
            <li className={site ? "md:hidden" : undefined}>
              <a href={DISCORD_URL} target="_blank" rel="noreferrer" className={`${BUTTON_CLASS} w-full justify-start`}>
                <img
                  src={asset("home/tab-icons/discord.svg")}
                  alt=""
                  className="h-3.5 w-3.5 [[data-theme=light]_&]:invert"
                />
                {t("demo.landing.community.discord")}
              </a>
            </li>
            <li>
              <button
                type="button"
                data-testid="demo-reset"
                className={`${BUTTON_CLASS} w-full justify-start`}
                onClick={() => {
                  setLessonsOpen(false);
                  void confirmReset();
                }}
              >
                <RotateCcw size={14} aria-hidden="true" />
                {t("demo.reset.open")}
              </button>
            </li>
            <li>
              <a
                href={SOURCE_URL}
                target="_blank"
                rel="noreferrer"
                className={`${BUTTON_CLASS} w-full justify-start text-[var(--marinara-chat-chrome-panel-muted)]`}
              >
                <Code aria-hidden="true" className="h-3.5 w-3.5" />
                {t("demo.banner.source")}
              </a>
            </li>
          </ul>,
          document.body,
        )}
      {/* Portaled: the bar's backdrop blur would otherwise pin the fixed tour stage inside the 48px bar. */}
      {lesson &&
        steps &&
        createPortal(<OnboardingTutorialInner key={lesson} steps={steps} onDone={finishLesson} />, document.body)}
    </>
  );
}
