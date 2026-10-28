// The landing page's "What's new" summary: the newest changelog release and the first sentence of a few of its notes.
const plain = (text) =>
  text
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]+/g, "")
    .replace(/\s*\((?:[\w-]+)?#\d+(?:,\s*(?:[\w-]+)?#\d+)*\)/g, "")
    .trim();

export function whatsNew(release) {
  if (!release) return null;
  const sections = release.body
    .split(/^### /m)
    .slice(1)
    .map((part) => {
      const [heading = "", ...lines] = part.split("\n");
      return { heading, bullets: lines.filter((line) => line.startsWith("- ")).map((line) => line.slice(2)) };
    });
  // Keep-a-Changelog releases have Added/Changed; newer ones group notes by area after a "Before you update" warning.
  const preferred = sections.filter((section) => /^(added|changed|release highlights)/i.test(section.heading));
  const pool = preferred.length
    ? preferred
    : sections.filter((section) => !/before you update|removed|security/i.test(section.heading));
  const highlights = [];
  for (let i = 0; highlights.length < 4 && pool.some((section) => section.bullets[i]); i++) {
    for (const section of pool) {
      const text = plain(section.bullets[i] ?? "");
      if (text && highlights.length < 4) highlights.push(text.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? text);
    }
  }
  return { version: release.version, date: release.date, highlights };
}
