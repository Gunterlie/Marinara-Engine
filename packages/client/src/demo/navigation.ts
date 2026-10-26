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
    const followRoute = () => {
      const hash = window.location.hash;
      if (hash && !hash.startsWith("#/")) return;
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
      unsubscribe();
    };
  }, []);
}
