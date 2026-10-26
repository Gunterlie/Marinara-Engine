// Static demo: a tip from Mari and suggested messages above the composer, plus the lesson checklist chip.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import type { MariSuggestionChip } from "@marinara-engine/shared";
import { MariSuggestionChips } from "../components/chat/MariSuggestionChips";
import { DEMO_PROMPTS } from "./scenarios";
import { LESSON_IDS, PROGRESS_EVENT, readDone } from "./DemoBanner";

const LESSONS_CHIP = "demo-things-to-try";

export function DemoPrompts({
  chatId,
  disabled,
  onPick,
}: {
  chatId: string;
  disabled: boolean;
  onPick: (text: string) => void;
}) {
  const { t } = useTranslation();
  const [done, setDone] = useState(readDone);
  const demo = DEMO_PROMPTS[chatId];

  useEffect(() => {
    const update = () => setDone(readDone());
    window.addEventListener(PROGRESS_EVENT, update);
    return () => window.removeEventListener(PROGRESS_EVENT, update);
  }, []);

  const chips: MariSuggestionChip[] = [
    ...(demo?.prompts ?? []).map((prompt) => ({ id: `demo-prompt:${prompt}`, label: prompt, prompt })),
    {
      id: LESSONS_CHIP,
      label: t("demo.prompts.lessons", { done: done.length, total: LESSON_IDS.length }),
      prompt: "",
      icon: "BookOpen",
      tone: done.length === LESSON_IDS.length ? "success" : undefined,
    },
  ];

  return (
    <div data-testid="demo-prompts">
      {demo && (
        <p className="mb-1 hidden items-center gap-1.5 px-0.5 text-xs text-[var(--muted-foreground)] sm:flex">
          <Sparkles size="0.75rem" className="shrink-0 text-[var(--primary)]" aria-hidden="true" />
          <span>{t(`demo.prompts.tip.${demo.tip}`)}</span>
        </p>
      )}
      <MariSuggestionChips
        chips={chips}
        disabled={disabled}
        onSelect={(chip) =>
          chip.id === LESSONS_CHIP ? window.dispatchEvent(new Event("marinara-demo-lessons")) : onPick(chip.prompt)
        }
      />
    </div>
  );
}
