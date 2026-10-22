// ──────────────────────────────────────────────
// Static demo: persistent banner + guided lessons
// ──────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { APP_VERSION } from "@marinara-engine/shared";
import { Check, Code, Download, GraduationCap, RotateCcw } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { OnboardingTutorialInner, type TourStep } from "../components/onboarding/OnboardingTutorial";
import { showConfirmDialog } from "../lib/app-dialogs";
import { useChatStore } from "../stores/chat.store";
import { isMobileShellViewport, useUIStore, type Panel } from "../stores/ui.store";
import { resetDemo } from "./runtime";
import { DEMO_SEED_IDS } from "./seed";

const INSTALL_URL = "https://github.com/Pasta-Devs/Marinara-Engine#installation";
// ponytail: fork trial branch; point at the release tag once demos publish from stable tags.
const SOURCE_URL = "https://github.com/Gunterlie/Marinara-Engine/tree/feat/static-demo-tutorial";
const DONE_KEY = `marinara-demo:lessons-done:${APP_VERSION}`;

// Reserve a strip above the shell instead of floating over it, so the banner never covers the
// composer. The mobile overrides mirror the visual-viewport rules for the shell in globals.css.
const SHELL_OFFSET_CSS = `
html[data-marinara-demo] { --marinara-demo-banner-height: calc(2.75rem + env(safe-area-inset-top)); }
html[data-marinara-demo] .mari-app { top: var(--marinara-demo-banner-height) !important; }
@media (max-width: 767px), (max-width: 1440px) and (hover: none) and (any-pointer: coarse) {
  html[data-marinara-demo] .mari-app[data-chat-surface-active="true"]:has([data-chat-mode]),
  html[data-marinara-demo][data-mari-ios-webkit] .mari-app {
    top: calc(var(--mari-visual-viewport-offset-top, 0px) + var(--marinara-demo-banner-height)) !important;
    height: calc(var(--mari-visual-viewport-height, 100dvh) - var(--marinara-demo-banner-height)) !important;
  }
}
`;

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

export function DemoBanner() {
  const { t } = useUiTranslation();
  const [lessonsOpen, setLessonsOpen] = useState(false);
  const [lesson, setLesson] = useState<LessonId | null>(null);
  const [done, setDone] = useState(readDone);
  const steps = useMemo(() => (lesson ? lessonSteps(lesson) : null), [lesson]);

  const lessonsButtonRef = useRef<HTMLButtonElement>(null);
  const lessonsListRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-marinara-demo", "");
    return () => document.documentElement.removeAttribute("data-marinara-demo");
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
      <style>{SHELL_OFFSET_CSS}</style>
      <section
        data-testid="demo-banner"
        aria-label={t("demo.banner.label")}
        className="mari-chrome-token-scope fixed inset-x-0 top-0 flex h-[var(--marinara-demo-banner-height)] items-center gap-0.5 overflow-hidden border-b border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-panel-bg)] pt-[env(safe-area-inset-top)] pr-[max(0.25rem,env(safe-area-inset-right))] pl-[max(0.5rem,env(safe-area-inset-left))]"
      >
        <span className="mr-1 min-w-0 truncate rounded bg-[var(--marinara-chat-chrome-accent)]/15 px-1.5 py-0.5 text-xs font-semibold text-[var(--marinara-chat-chrome-accent)]">
          {t("demo.banner.badge", { version: APP_VERSION })}
        </span>
        <button
          ref={lessonsButtonRef}
          type="button"
          data-testid="demo-tutorial"
          aria-expanded={lessonsOpen}
          aria-controls="demo-lessons"
          onClick={() => setLessonsOpen((value) => !value)}
          onKeyDown={closeLessonsOnEscape}
          className={BUTTON_CLASS}
        >
          <GraduationCap aria-hidden="true" className="h-3.5 w-3.5" />
          <span>{t("demo.lessons.open")}</span>
        </button>
        <a data-testid="demo-install" href={INSTALL_URL} target="_blank" rel="noreferrer" className={BUTTON_CLASS}>
          <Download aria-hidden="true" className="h-3.5 w-3.5" />
          <span className="max-sm:sr-only">{t("demo.banner.install")}</span>
        </a>
        <button type="button" data-testid="demo-reset" onClick={confirmReset} className={BUTTON_CLASS}>
          <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
          <span className="max-sm:sr-only">{t("demo.reset.open")}</span>
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
            className="mari-chrome-token-scope fixed top-[var(--marinara-demo-banner-height)] left-[max(0.5rem,env(safe-area-inset-left))] z-[9990] mt-1 flex w-64 max-w-[calc(100vw-1rem)] flex-col gap-0.5 rounded-xl border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-panel-bg)] p-1 shadow-lg"
          >
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
