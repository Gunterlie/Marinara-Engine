import { useEffect } from "react";
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
      const ui = useUIStore.getState();
      ui.closeAllDetails();
      ui.closeRightPanel();
      if (firstRoute || isMobileShellViewport()) ui.setSidebarOpen(false);
      firstRoute = false;
      useChatStore.getState().setActiveChatId(hash === "#/demo" ? DEMO_SEED_IDS.chatId : null);
    };
    followRoute();
    window.addEventListener("hashchange", followRoute);
    const unsubscribe = useChatStore.subscribe((state, previous) => {
      if (state.activeChatId === previous.activeChatId) return;
      const hash = state.activeChatId ? "#/demo" : "#/";
      if (hash !== window.location.hash && (state.activeChatId || window.location.hash === "#/demo")) {
        window.history.pushState(window.history.state, "", window.location.pathname + window.location.search + hash);
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
