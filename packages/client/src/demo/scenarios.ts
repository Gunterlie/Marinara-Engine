import { DEMO_ASSETS } from "./seed";

// Scripted replies. Matching is keyword based; this is not a language model.
export const DEMO_FALLBACK_REPLY =
  "*Smiles and tips their head.* This is a scripted demo, so I only know a few topics. Try asking about the lighthouse, the fog, the harbor, agents, presets or the ruins. In your own Engine, a real model would answer anything.";

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

// Per-character replies, tried before the Iris ones. Each points at a feature the demo shows.
const BY_CHARACTER: Record<string, { match: RegExp; reply: string }[]> = {
  "demo-character-mira": [
    { match: /\b(?:agent|help|track)/i, reply: "Agents run beside a chat and keep notes for you, like a tracker for my repair log. Open the Agents panel to see the examples." },
    { match: /\b(?:preset|prompt)/i, reply: "Presets decide how the prompt is built. Swap one in the Presets panel and I would talk differently. (Scripted demo reply.)" },
    { match: /\b(?:hi|hello|hey)\b/i, reply: "Hey! Ask me about agents or presets. This is a scripted demo, so I only know a few topics." },
  ],
  "demo-character-orsolo": [
    { match: /\b(?:ship|sail|sea|brig|gull)/i, reply: "*Orsolo grins.* The Gull's Promise! Her entry sits in the Saltmere Harbor lorebook, and a keyword like 'ship' pulls it into the prompt. (Scripted.)" },
    { match: /\b(?:sprite|face|look)/i, reply: "In roleplay mode, a character can show sprites that change with the mood. Check the Characters panel. (Scripted.)" },
  ],
  "demo-character-kestrel": [
    { match: /\b(?:stair|down)/i, reply: "*You descend.* Water drips. A glowing map hangs on the wall, which is the game mode map. Roll for perception. (Scripted.)" },
    { match: /\b(?:bridge|cross)/i, reply: "The bridge sways. A skill check appears: dice roll, difficulty 12. In a real game the dice are rolled for you. (Scripted.)" },
    { match: /\b(?:door|open)/i, reply: "The door has no handle, but the Ember Reach lorebook says it opens to a spoken word. Try 'ember'. (Scripted.)" },
  ],
};

export function pickDemoReply(userText: string, characterId?: string | null): string {
  const list = [...(BY_CHARACTER[characterId ?? ""] ?? []), ...SCENARIOS];
  return list.find((s) => s.match.test(userText))?.reply ?? DEMO_FALLBACK_REPLY;
}
