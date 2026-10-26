import { useEffect } from "react";
import { flushSync } from "react-dom";
import { useChatStore } from "../stores/chat.store";
import { isMobileShellViewport, useUIStore } from "../stores/ui.store";
import { DEMO_SEED_IDS } from "./seed";
import { docHref } from "./docs";

// Hash routes work on Pages without a server-side rewrite or a second router for the Engine.
export function useDemoNavigation() {
  useEffect(() => {
    let firstRoute = true;
    // Website pages scroll inside an element, which browser scroll restoration does not cover.
    // A new link opens at the top; back and forward return to the offset the visitor left.
    const offsets = new Map<number, number>();
    let entry = 0;
    const pageScroller = () => document.querySelector<HTMLElement>("[data-demo-site] .flex-1.overflow-y-auto");
    const remember = (event: Event) => {
      const scroller = pageScroller();
      if (scroller && event.target === scroller) offsets.set(entry, scroller.scrollTop);
    };
    const followRoute = () => {
      const hash = window.location.hash;
      if (hash && !hash.startsWith("#/")) return;
      const known = window.history.state?.demoEntry;
      entry = typeof known === "number" ? known : Date.now();
      if (entry !== known) window.history.replaceState({ ...window.history.state, demoEntry: entry }, "");
      const offset = offsets.get(entry) ?? 0;
      // Guides place themselves: top of the guide, or the linked section.
      if (!hash.startsWith("#/docs")) {
        requestAnimationFrame(() => {
          const scroller = pageScroller();
          if (scroller) scroller.scrollTop = offset;
        });
      }
      // Website and workspace cross-fade; not on first load and not with reduced motion.
      const fade =
        !firstRoute &&
        "startViewTransition" in document &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      // A quick second route skips the first fade, which rejects its ready promise; that is expected.
      if (fade) document.startViewTransition(() => flushSync(() => openRoute(hash))).ready.catch(() => {});
      else openRoute(hash);
    };
    const openRoute = (hash: string) => {
      const ui = useUIStore.getState();
      ui.closeAllDetails();
      ui.closeRightPanel();
      if (firstRoute || isMobileShellViewport()) ui.setSidebarOpen(false);
      firstRoute = false;
      // Feature links deep-link with #/demo?chat=<id> or #/demo?panel=<panel>.
      const [route, query] = hash.split("?");
      const params = new URLSearchParams(query);
      useChatStore.getState().setActiveChatId(route === "#/demo" ? (params.get("chat") ?? DEMO_SEED_IDS.chatId) : null);
      const panel = params.get("panel");
      if (route === "#/demo" && panel) ui.openRightPanel(panel as Parameters<typeof ui.openRightPanel>[0]);
    };
    followRoute();
    window.addEventListener("hashchange", followRoute);
    document.addEventListener("scroll", remember, { capture: true, passive: true });
    const unsubscribe = useChatStore.subscribe((state, previous) => {
      if (state.activeChatId === previous.activeChatId) return;
      const hash = state.activeChatId ? "#/demo" : "#/";
      const current = window.location.hash;
      if (hash !== current && (state.activeChatId || current.startsWith("#/demo"))) {
        // A deep link becomes plain #/demo in place, so Back does not reopen it.
        const swap = state.activeChatId && current.startsWith("#/demo?") ? "replaceState" : "pushState";
        window.history[swap](window.history.state, "", window.location.pathname + window.location.search + hash);
      }
    });
    const unsubscribeDocs = useUIStore.subscribe((state, previous) => {
      if (state.modal?.type !== "docs-viewer" || state.modal === previous.modal) return;
      const path = state.modal.props?.initialDoc;
      state.closeModal();
      window.location.hash = docHref(typeof path === "string" ? path : "");
    });
    return () => {
      unsubscribeDocs();
      window.removeEventListener("hashchange", followRoute);
      document.removeEventListener("scroll", remember, { capture: true });
      unsubscribe();
    };
  }, []);
}
