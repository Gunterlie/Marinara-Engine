// The static demo rewrites doc cross-links to hash routes (#/docs/...), so only demo builds accept them.
const DEMO_LINK_TARGET = import.meta.env.VITE_MARINARA_DEMO === "1" ? String.raw`|#\/[^)\s]+` : "";
export const MD_LINK_TARGET_SOURCE = String.raw`(?:https?:\/\/[^)\s]+|card:\/\/[^)\s]+|\/api\/[^)\s]+${DEMO_LINK_TARGET})`;

/** Discord-style line-level subtext, which must be checked before unordered lists. */
export const DISCORD_SUBTEXT_RE = /^\s*-#(?:\s+(.*)|\s*)$/;

export const INLINE_MD_RE = new RegExp(
  "\\\\([-\\\\*_~`#|>!=\\[\\]{}])|(!?\\[([^\\]]*)\\]\\((" +
    MD_LINK_TARGET_SOURCE +
    ")\\))|`([^`\\n]+)`|==(.+?)==|~~(.+?)~~|\\*\\*\\*(.+?)\\*\\*\\*|\\*\\*(.+?)\\*\\*|__(.+?)__|(?<!\\*)\\*(?!\\*)(.+?)(?<!\\*)\\*(?!\\*)|(?<![_\\w])_([^_]+?)_(?![_\\w])",
  "g",
);
