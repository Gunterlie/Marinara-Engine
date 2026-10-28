// Static demo: the Settings panel holds nothing to try without an install, so it says so.
import { useTranslation } from "react-i18next";
import { useMariAppearancePack } from "../hooks/use-mari-appearance-pack";

export function DemoSettings() {
  const { t } = useTranslation();
  const mari = useMariAppearancePack();
  return (
    <div
      data-testid="demo-settings-placeholder"
      className="flex h-full min-h-[18rem] flex-col items-center justify-center gap-3 px-6 py-10 text-center"
    >
      <img
        src={mari.poses.chibi}
        alt=""
        width={72}
        height={108}
        draggable={false}
        className="h-24 w-auto select-none object-contain"
      />
      <p className="text-sm font-semibold text-[var(--foreground)]">{t("demo.settings.title")}</p>
      <p className="max-w-[18rem] text-xs leading-relaxed text-[var(--muted-foreground)]">{t("demo.settings.body")}</p>
      <a
        href="#/download"
        className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:border-[var(--primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
      >
        {t("demo.settings.install")}
      </a>
    </div>
  );
}
