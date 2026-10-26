// ──────────────────────────────────────────────
// Static demo: persistent banner + guided lessons
// ──────────────────────────────────────────────
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { APP_VERSION } from "@marinara-engine/shared";
import { BookOpen, Check, Code, Download, GraduationCap, Home, RotateCcw } from "lucide-react";
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

const INSTALL_URL = "https://github.com/Pasta-Devs/Marinara-Engine#installation";
// ponytail: fork trial branch; point at the release tag once demos publish from stable tags.
const SOURCE_URL = "https://github.com/Gunterlie/Marinara-Engine/tree/feat/static-demo-tutorial";
const DONE_KEY = `marinara-demo:lessons-done:${APP_VERSION}`;

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
const LESSON_IDS = Object.keys(LESSONS) as LessonId[];

function lessonSteps(id: LessonId): TourStep[] {
  return LESSONS[id].map((step, i) => ({
    ...step,
    titleKey: `demo.lessons.${id}.step${i + 1}.title`,
    bodyKey: `demo.lessons.${id}.step${i + 1}.body`,
  }));
}

function readDone(): LessonId[] {
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
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-app-accent-solid)] sm:px-2.5";

// The website part of the one shared bar: TopBar puts it first, and in the demo workspace its Engine controls follow.
export function DemoSiteStart({ site }: { site: boolean }) {
  const { t } = useUiTranslation();
  // In the workspace the Engine icons need the room, so labels wait for wide screens and phones use the lessons menu.
  const labelClass = site ? "max-sm:sr-only" : "max-lg:sr-only";
  const link = (href: string, icon: ReactNode, label: string, className = "") => (
    <a
      href={href}
      className={`${NAV_LINK} ${className}`}
      {...(href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}
    >
      {icon}
      <span className={labelClass}>{label}</span>
    </a>
  );
  return (
    <div data-testid="demo-site-header" className="flex min-w-0 shrink-0 items-center gap-0.5 sm:gap-1">
      <a href="#/" className={`${NAV_LINK} !px-1`} aria-label={t("demo.docs.home")}>
        <img src={asset("logo.png")} alt="" width={32} height={32} className="h-7 w-7 object-contain" />
        <MarinaraWordmark className="hidden text-sm lg:block" />
      </a>
      <nav
        aria-label={t("demo.site.navigation")}
        className={`items-center gap-0.5 ${site ? "flex" : "hidden sm:flex"}`}
      >
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
    </div>
  );
}

export function DemoSiteTry({ site }: { site: boolean }) {
  const { t } = useUiTranslation();
  return (
    <a
      href="#/demo"
      data-testid="demo-site-try"
      className={`ml-2 min-h-11 shrink-0 items-center rounded-full bg-[var(--primary)] px-3.5 text-xs font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-app-accent-solid)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] ${site ? "inline-flex" : "hidden lg:inline-flex"}`}
    >
      {t("demo.site.try")}
    </a>
  );
}

export function DemoNavigation() {
  useDemoNavigation();
  return null;
}

export function DemoBanner() {
  const { t } = useUiTranslation();
  const [lessonsOpen, setLessonsOpen] = useState(false);
  const [lesson, setLesson] = useState<LessonId | null>(null);
  const [done, setDone] = useState(readDone);
  const steps = useMemo(() => (lesson ? lessonSteps(lesson) : null), [lesson]);

  const lessonsButtonRef = useRef<HTMLButtonElement>(null);
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
    setLesson(id);
  };

  const finishLesson = (completed: boolean) => {
    if (completed && lesson && !done.includes(lesson)) {
      const next = [...done, lesson];
      setDone(next);
      try {
        window.localStorage.setItem(DONE_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable — the check mark lasts for this page only */
      }
    }
    setLesson(null);
    requestAnimationFrame(() => lessonsButtonRef.current?.focus());
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
      <section data-testid="demo-banner" aria-label={t("demo.banner.label")} className="shrink-0">
        <button
          ref={lessonsButtonRef}
          type="button"
          data-testid="demo-tutorial"
          aria-label={t("demo.banner.badge", { version: APP_VERSION })}
          aria-expanded={lessonsOpen}
          aria-controls={lessonsOpen ? "demo-lessons" : undefined}
          onClick={() => setLessonsOpen((value) => !value)}
          onKeyDown={closeLessonsOnEscape}
          className={`${BUTTON_CLASS} min-h-11 rounded-full border border-[var(--border)] bg-[var(--card)] text-[var(--primary)]`}
        >
          <GraduationCap aria-hidden="true" className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t("demo.banner.badge", { version: APP_VERSION })}</span>
          <span className="sm:hidden">{t("demo.controls.short")}</span>
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
            className="mari-chrome-token-scope fixed z-[9990] flex max-h-[calc(100dvh-4rem)] w-64 max-w-[calc(100vw-1rem)] flex-col gap-0.5 overflow-y-auto rounded-xl border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-panel-bg)] p-1 shadow-lg"
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
              <a href={INSTALL_URL} data-testid="demo-install" className={`${BUTTON_CLASS} w-full justify-start`}>
                <Download size={14} aria-hidden="true" />
                {t("demo.banner.install")}
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
      {lesson && steps && <OnboardingTutorialInner key={lesson} steps={steps} onDone={finishLesson} />}
    </>
  );
}
