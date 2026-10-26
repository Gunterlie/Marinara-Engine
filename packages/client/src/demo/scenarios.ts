import { DEMO_ASSETS } from "./seed";

// Scripted replies. Matching is keyword based; this is not a language model.
export const DEMO_FALLBACK_REPLY =
  "*Iris smiles and tips her head.* This is a scripted demo, so I only know a few topics. Try asking about the lighthouse, the fog, or the harbor. In your own Engine, a real model would answer anything.";

const SCENARIOS: { match: RegExp; reply: string }[] = [
  {
    match: /\b(?:lighthouse|lantern|lamp|light)\b/i,
    reply:
      `*Iris leads you up the spiral stairs.* The lamp has burned for ninety years. On clear nights you can see it from ten miles out. *(This reply is scripted. The lorebook entry about the lighthouse shows how world notes can feed a real reply.)*\n\n![Iris’s lantern beside the lighthouse stairs](${DEMO_ASSETS.lantern})`,
  },
  {
    match: /\b(?:fog|weather|storm)\b/i,
    reply:
      "*She checks a brass barometer.* Fog until midnight, I'd say. The ships will sound their horns. Stay for tea until it lifts.",
  },
  {
    match: /\b(?:harbor|ships?|boats?|saltmere)\b/i,
    reply:
      "Saltmere is small, but the harbor never sleeps. Fishing boats at dawn, traders at noon, and stories all night.",
  },
  {
    match: /^\s*(hi|hello|hey)\b/i,
    reply: "*Iris waves.* Hello again! Ask me about the lighthouse, the fog, or the harbor.",
  },
];

export function pickDemoReply(userText: string): string {
  return SCENARIOS.find((s) => s.match.test(userText))?.reply ?? DEMO_FALLBACK_REPLY;
}
