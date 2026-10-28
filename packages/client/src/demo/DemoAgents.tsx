// Static demo: #/features/agents and #/features/agents/<slug>, generated at build time from the agents reference guide.
import "./demo-docs.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, BookOpen, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { applyInlineMarkdown, renderMarkdownBlocks } from "../lib/markdown";
import { docHref, loadDemoIndex, prepareDemoDoc } from "./docs";
import { AGENT_TAGLINES } from "./features";
import { DemoBrandMark } from "./DemoSiteTabs";

interface AgentPage {
  slug: string;
  name: string;
  category: string;
  summary: string;
  body: string;
}

const AGENTS_GUIDE = "agents/built-in-agents.md";
const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]";
const LINK = `inline-flex min-h-11 w-fit items-center gap-1.5 text-sm font-semibold text-[var(--primary)] hover:underline ${FOCUS}`;
const EYEBROW = "text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]";

const loadAgents = () =>
  fetch(`${import.meta.env.BASE_URL}agents.json`).then((response) => {
    if (!response.ok) throw new Error("Agent pages unavailable");
    return response.json() as Promise<AgentPage[]>;
  });

function useTagline() {
  const { t } = useTranslation();
  // Agents without a hand-written tagline, such as new upstream agents, use their guide's first sentence.
  return (agent: AgentPage) =>
    AGENT_TAGLINES.includes(agent.slug)
      ? t(`demo.agents.tagline.${agent.slug}`)
      : (agent.summary.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? agent.summary);
}

export function DemoAgents({ slug }: { slug: string }) {
  const { t } = useTranslation();
  const agents = useQuery({ queryKey: ["demo-agents"], queryFn: loadAgents, staleTime: Infinity });
  const topRef = useRef<HTMLDivElement>(null);
  useEffect(() => topRef.current?.scrollIntoView({ block: "start" }), [slug]);

  return (
    <div
      ref={topRef}
      className="mx-auto flex max-w-[75rem] scroll-mt-12 flex-col gap-8 px-5 pb-16 pt-6 sm:px-8 sm:pt-10"
    >
      {agents.isLoading ? (
        <p role="status" className="text-sm text-[var(--muted-foreground)]">
          {t("demo.agents.loading")}
        </p>
      ) : agents.isError || !agents.data ? (
        <p role="alert" className="text-sm text-[var(--muted-foreground)]">
          {t("demo.agents.error")}{" "}
          <a href={docHref(AGENTS_GUIDE)} className={LINK}>
            {t("demo.agents.reference")}
          </a>
        </p>
      ) : slug ? (
        <AgentDetail agent={agents.data.find((agent) => agent.slug === slug)} />
      ) : (
        <AgentOverview agents={agents.data} />
      )}
    </div>
  );
}

function AgentOverview({ agents }: { agents: AgentPage[] }) {
  const { t } = useTranslation();
  const tagline = useTagline();
  const [query, setQuery] = useState("");
  const guides = useQuery({
    queryKey: ["demo-docs", "index", "en"],
    queryFn: () => loadDemoIndex(),
    staleTime: Infinity,
  });
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = agents.filter((agent) => {
    const text = `${agent.name} ${agent.category} ${tagline(agent)}`.toLowerCase();
    return terms.every((term) => text.includes(term));
  });
  const groups = useMemo(() => [...new Set(agents.map((agent) => agent.category))], [agents]);

  return (
    <>
      <header className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <DemoBrandMark />
          <h1 className="text-balance text-[2.125rem] font-bold leading-[1.08] tracking-tight text-[var(--foreground)] sm:text-5xl">
            {t("demo.agents.title")}
          </h1>
        </div>
        <p className="max-w-[60ch] text-pretty text-base leading-relaxed text-[var(--muted-foreground)]">
          {t("demo.agents.body", { count: agents.length })}
        </p>
        <label className="relative max-w-xl">
          <span className="sr-only">{t("demo.agents.search")}</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("demo.agents.search")}
            className={`min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] pl-9 pr-3 text-base text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] sm:text-sm ${FOCUS}`}
          />
        </label>
      </header>

      {shown.length ? null : (
        <p role="status" className="text-sm text-[var(--muted-foreground)]">
          {t("demo.agents.noResults")}
        </p>
      )}
      {groups.map((group) => {
        const items = shown.filter((agent) => agent.category === group);
        if (!items.length) return null;
        return (
          <section key={group} aria-label={group} className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-[var(--foreground)]">{group}</h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((agent) => (
                <li key={agent.slug}>
                  <a
                    href={`#/features/agents/${agent.slug}`}
                    className={`flex h-full flex-col gap-1.5 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:border-[var(--primary)] ${FOCUS}`}
                  >
                    <span className="font-semibold text-[var(--foreground)]">{agent.name}</span>
                    <span className="text-sm leading-relaxed text-[var(--muted-foreground)]">{tagline(agent)}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <section aria-labelledby="demo-agents-guides" className="flex flex-col gap-3">
        <h2 id="demo-agents-guides" className="text-xl font-bold text-[var(--foreground)]">
          {t("demo.agents.guides")}
        </h2>
        <ul className="flex flex-wrap gap-2">
          {(guides.data ?? [])
            .filter((guide) => guide.dir === "agents")
            .map((guide) => (
              <li key={guide.path}>
                <a
                  href={docHref(guide.path)}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--background)] px-4 text-sm text-[var(--foreground)] hover:border-[var(--primary)] ${FOCUS}`}
                >
                  <BookOpen className="h-4 w-4 text-[var(--primary)]" aria-hidden="true" />
                  {guide.title}
                </a>
              </li>
            ))}
        </ul>
      </section>
    </>
  );
}

function AgentDetail({ agent }: { agent: AgentPage | undefined }) {
  const { t } = useTranslation();
  const tagline = useTagline();
  const back = (
    <a href="#/features/agents" className={LINK}>
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      {t("demo.agents.all")}
    </a>
  );
  if (!agent)
    return (
      <div role="alert" className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">{t("demo.agents.notFound")}</h1>
        {back}
      </div>
    );
  return (
    <article className="flex max-w-[72ch] flex-col gap-4">
      {back}
      <span className={EYEBROW}>{agent.category}</span>
      <h1 className="text-balance text-[2.125rem] font-bold leading-[1.08] tracking-tight text-[var(--foreground)] sm:text-5xl">
        {agent.name}
      </h1>
      <p className="text-pretty text-lg leading-relaxed text-[var(--muted-foreground)]">{tagline(agent)}</p>
      <div className="mari-message-content docs-reader-content demo-docs-reader break-words">
        {renderMarkdownBlocks(prepareDemoDoc(agent.body, AGENTS_GUIDE), applyInlineMarkdown, `agent-${agent.slug}`)}
      </div>
      <a href={docHref(AGENTS_GUIDE, agent.slug)} className={LINK}>
        {t("demo.agents.reference")}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </a>
    </article>
  );
}
