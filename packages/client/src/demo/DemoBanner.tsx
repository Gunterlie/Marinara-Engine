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
import {
  BookMarked,
  BookOpen,
  Check,
  Code,
  Download,
  Home,
  LayoutGrid,
  MessagesSquare,
  RotateCcw,
  UserRound,
} from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { OnboardingTutorialInner, type TourStep } from "../components/onboarding/OnboardingTutorial";
import { showConfirmDialog } from "../lib/app-dialogs";
import { useChatStore } from "../stores/chat.store";
import { isMobileShellViewport, useUIStore, type Panel } from "../stores/ui.store";
import { resetDemo } from "./runtime";
import { DEMO_SEED_IDS } from "./seed";
import { useDemoNavigation } from "./navigation";
import { DISCORD_URL, DiscordIcon, GITHUB_URL, GithubIcon } from "./DemoSiteTabs";
import { SOURCE_TREE_URL as SOURCE_URL } from "./docs";
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

const MENU_ROW =
  "flex min-h-12 w-full items-center gap-3 rounded-xl px-2 text-left text-sm font-medium text-[var(--marinara-chat-chrome-panel-text)] transition-colors hover:bg-[var(--marinara-chat-chrome-highlight-bg)] focus-visible:outline-2 focus-visible:outline-[var(--marinara-chat-chrome-focus-ring)] aria-[current=page]:bg-[color-mix(in_srgb,#f29744_14%,transparent)] aria-[current=page]:text-[var(--foreground)]";
const MENU_TILE =
  "grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[color-mix(in_srgb,#f29744_13%,transparent)] text-[#f29744]";
const EXPLORE = [
  { href: "#/", label: "demo.docs.home", testId: "demo-home", Icon: Home },
  { href: "#/features", label: "demo.site.features", testId: "demo-menu-features", Icon: LayoutGrid },
  { href: "#/docs", label: "demo.docs.title", testId: "demo-docs-link", Icon: BookOpen },
  { href: "#/download", label: "demo.site.download", testId: "demo-download", Icon: Download },
];
const LESSON_ICONS = { chat: MessagesSquare, character: UserRound, lorebook: BookMarked };

function MenuHeading({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center px-2.5 pb-0.5 pt-2.5 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[#f29744]">
      {children}
    </p>
  );
}

// The demo's only control in the Engine bar: a small badge whose menu holds the tours, reset and source.
export function DemoSiteStart() {
  return (
    // Phones order the bar with CSS (the menu is order 10 and pushed right by ml-auto); the badge takes both, so it sits just before the menu.
    <div className="flex shrink-0 items-center gap-1 max-sm:order-10 max-sm:ml-auto max-sm:[&+button]:ml-0">
      <span aria-hidden="true" className="mr-1 h-5 w-px bg-[var(--border)] max-md:hidden" />
      <DemoBanner />
    </div>
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
  // Only a lesson picked from the menu returns focus there; the automatic welcome must not leave a focus ring.
  const fromMenu = useRef(false);
  const lessonsListRef = useRef<HTMLDivElement>(null);

  const [position, setPosition] = useState({ top: 48, left: 8 });
  useLayoutEffect(() => {
    if (!lessonsOpen) return;
    const update = () => {
      const rect = lessonsButtonRef.current?.getBoundingClientRect();
      if (rect)
        setPosition({
          top: rect.bottom + 6,
          left: Math.max(8, Math.min(rect.left, window.innerWidth - (lessonsListRef.current?.offsetWidth ?? 264) - 8)),
        });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [lessonsOpen]);
  // Until a first lesson ends (done or skipped), opening the workspace starts Mari's welcome lesson.
  useEffect(() => {
    const welcome = () => {
      // Tours point at the chat UI, so leaving the workspace pauses them; the welcome comes back on return.
      if (!window.location.hash.startsWith("#/demo")) setLesson(null);
      else if (window.location.hash === "#/demo" && !localStorage.getItem(WELCOMED_KEY)) setLesson("chat");
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

  const here = window.location.hash || "#/";
  return (
    <>
      <section data-testid="demo-banner" aria-label={t("demo.banner.label")} className="shrink-0">
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
          className={`group inline-flex h-9 items-center justify-center rounded-md text-[var(--foreground)] [@media(pointer:coarse)]:h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-app-accent-solid)] px-1`}
        >
          <span
            className={`items-center gap-1 rounded-full border border-[var(--border)] px-2 py-0.5 text-[0.6875rem] font-medium leading-4 text-[var(--muted-foreground)] transition-colors group-hover:text-[var(--foreground)] group-aria-expanded:border-[color-mix(in_srgb,var(--primary)_50%,var(--border))] group-aria-expanded:text-[var(--foreground)] inline-flex`}
          >
            {t("demo.controls.short")}
            <span className="hidden tabular-nums opacity-70 lg:inline">v{APP_VERSION}</span>
          </span>
        </button>
      </section>
      {lessonsOpen &&
        createPortal(
          // Portalled so it paints above the shell, which is mounted after the banner.
          <div
            ref={lessonsListRef}
            id="demo-lessons"
            role="group"
            aria-label={t("demo.lessons.label")}
            onKeyDown={closeLessonsOnEscape}
            onBlur={(event) => {
              const target = event.relatedTarget as Node | null;
              if (!event.currentTarget.contains(target) && !lessonsButtonRef.current?.contains(target))
                setLessonsOpen(false);
            }}
            style={position}
            className="demo-menu mari-chrome-token-scope fixed z-[9990] flex max-h-[calc(100dvh-4rem)] w-72 max-w-[calc(100vw-1rem)] flex-col gap-1 overflow-y-auto rounded-2xl border border-[var(--marinara-chat-chrome-panel-border)] bg-[color-mix(in_srgb,var(--marinara-chat-chrome-panel-bg)_88%,transparent)] p-1.5 shadow-2xl shadow-black/30 backdrop-blur-xl"
          >
            <p className="px-2.5 pb-1 pt-2 text-xs leading-snug text-[var(--muted-foreground)]">
              {t("demo.controls.info")}
            </p>
            <MenuHeading>{t("demo.menu.explore")}</MenuHeading>
            {EXPLORE.map(({ href, label, testId, Icon }) => (
              <a
                key={href}
                href={href}
                data-testid={testId}
                aria-current={(href === "#/" ? here === href : here.startsWith(href)) ? "page" : undefined}
                className={MENU_ROW}
                onClick={() => setLessonsOpen(false)}
              >
                <span className={MENU_TILE}>
                  <Icon size={16} aria-hidden="true" />
                </span>
                {t(label)}
              </a>
            ))}
            <MenuHeading>
              {t("demo.menu.learn")}
              <span className="ml-auto tabular-nums">
                {done.length}/{LESSON_IDS.length}
              </span>
            </MenuHeading>
            <div aria-hidden="true" className="mx-2.5 mb-1 h-1 overflow-hidden rounded-full bg-[var(--border)]">
              <div
                className="h-full rounded-full bg-[#f29744] transition-[width] duration-500 motion-reduce:transition-none"
                style={{ width: `${(done.length / LESSON_IDS.length) * 100}%` }}
              />
            </div>
            {LESSON_IDS.map((id) => {
              const Icon = LESSON_ICONS[id];
              return (
                <button
                  key={id}
                  type="button"
                  data-testid={`demo-lesson-${id}`}
                  onClick={() => startLesson(id)}
                  className={MENU_ROW}
                >
                  <span className={MENU_TILE}>
                    <Icon size={16} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">{t(`demo.lessons.${id}.title`)}</span>
                  {done.includes(id) && (
                    <>
                      <Check aria-hidden="true" className="h-4 w-4 text-[#f29744]" />
                      <span className="sr-only">{t("demo.lessons.done")}</span>
                    </>
                  )}
                </button>
              );
            })}
            <MenuHeading>{t("demo.menu.community")}</MenuHeading>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className={MENU_ROW}>
              <span className={MENU_TILE}>
                <GithubIcon className="h-4 w-4" />
              </span>
              {t("demo.landing.community.github")}
            </a>
            <a href={DISCORD_URL} target="_blank" rel="noreferrer" className={MENU_ROW}>
              <span className={MENU_TILE}>
                <DiscordIcon className="h-4 w-4" />
              </span>
              {t("demo.landing.community.discord")}
            </a>
            <div className="mt-1 flex items-center gap-1 border-t border-[var(--marinara-chat-chrome-panel-border)] pt-1.5">
              <button
                type="button"
                data-testid="demo-reset"
                className={`${MENU_ROW} min-w-0 whitespace-nowrap`}
                onClick={() => {
                  setLessonsOpen(false);
                  void confirmReset();
                }}
              >
                <span className={MENU_TILE}>
                  <RotateCcw size={16} aria-hidden="true" />
                </span>
                {t("demo.reset.open")}
              </button>
              <a
                href={SOURCE_URL}
                target="_blank"
                rel="noreferrer"
                title={t("demo.banner.source")}
                className="flex min-h-12 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-xs text-[var(--marinara-chat-chrome-panel-muted)] transition-colors hover:bg-[var(--marinara-chat-chrome-highlight-bg)] focus-visible:outline-2 focus-visible:outline-[var(--marinara-chat-chrome-focus-ring)]"
              >
                <Code aria-hidden="true" className="h-3.5 w-3.5" />
                <span className="rounded-full border border-[var(--border)] px-1.5 py-0.5 tabular-nums">
                  v{APP_VERSION}
                </span>
                <span className="sr-only">{t("demo.banner.source")}</span>
              </a>
            </div>
          </div>,
          document.body,
        )}
      {/* Portaled: the bar's backdrop blur would otherwise pin the fixed tour stage inside the 48px bar. */}
      {lesson &&
        steps &&
        createPortal(<OnboardingTutorialInner key={lesson} steps={steps} onDone={finishLesson} />, document.body)}
    </>
  );
}
