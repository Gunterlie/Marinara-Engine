// Static demo: Professor Mari's prewritten answers. Matching is keyword based; no model is connected.
import type { MariSuggestionChip } from "@marinara-engine/shared";

export type MariAction = "character" | "lorebook";

const chip = (label: string, extra: Partial<MariSuggestionChip> = {}): MariSuggestionChip => ({
  id: `demo-mari:${label}`,
  label,
  prompt: label,
  ...extra,
});

export const MARI_STARTER_CHIPS: MariSuggestionChip[] = [
  chip("Create a cozy café character", { icon: "UserPlus" }),
  chip("Add a lorebook entry about the lighthouse", { icon: "BookOpen" }),
  chip("Explain what agents do", { icon: "Sparkles" }),
  chip("Set up a connection", { icon: "Link2" }),
  chip("Change the theme or accent", { icon: "Wand2" }),
];

export const MARI_WELCOME =
  "Hello, I'm Professor Mari. I live inside Marinara and can check or change things for you: characters, lorebooks, presets and more. Every change I make shows up as a card, so you can see what changed and undo it. Pick one below to watch me work.";

const MARI_SCRIPTS: { match: RegExp; reply: string; action?: MariAction; chips: MariSuggestionChip[] }[] = [
  {
    match: /\b(?:caf[eé]|cozy|cosy|character|barista|baker)\b/i,
    action: "character",
    reply:
      "Done. I made **Wren Hollis**, who bakes at the Copper Kettle on Saltmere's harbor road. She has a description, a warm personality and a first message, so you can start a chat with her right away. The card below shows every field I wrote. If she isn't what you wanted, press Undo and she's gone.",
    chips: [chip("Add a lorebook entry about the lighthouse"), chip("Explain what agents do")],
  },
  {
    match: /\b(?:lore|lorebook|entry|lighthouse|lamp)\b/i,
    action: "lorebook",
    reply:
      "Added. **The lamp keeper's log** is a new entry in the Saltmere Harbor lorebook. It wakes up when a chat mentions *keeper*, *log* or *lamp oil*, and it tells the story that the oil went bad the night the Gull's Promise came in late. Iris will use it the next time you ask her about the light.",
    chips: [chip("Set up a connection"), chip("Change the theme or accent")],
  },
  {
    match: /\b(?:agents?|tracker|helper)\b/i,
    reply:
      "Agents are small helpers that run beside a chat. A tracker keeps the time, weather and quest up to date, the Expression Engine picks a sprite for the mood, the Lorebook Keeper suggests new entries, and the Illustrator draws scenes. You turn them on per chat. Read [the agents overview](#/docs/agents/agents-overview.md) or [the built-in agents](#/docs/agents/built-in-agents.md).",
    chips: [chip("Set up a connection"), chip("Change the theme or accent")],
  },
  {
    match: /\b(?:connect\w*|model|api|provider|key|ollama|openai)\b/i,
    reply:
      "Marinara brings no model of its own. You connect the one you like: a local model on your own computer, or a provider such as OpenAI, Anthropic, OpenRouter or NanoGPT with your key. Open Connections, add one, and I can check it works for you. The guide [Connecting to a provider](#/docs/connections/connecting-to-a-provider.md) walks through it.",
    chips: [
      chip("Open Connections", { action: { kind: "panel", panel: "connections" } }),
      chip("Explain what agents do"),
    ],
  },
  {
    match: /\b(?:theme|dark|light|accent|colou?r|look)\b/i,
    reply:
      "The theme lives on your screen, not in your library, so here is the way. Open the settings (the gear in the top bar), then Appearance. Theme switches between dark and light, and Accent picks the colour of buttons and highlights. You can also load community themes there. The [appearance guide](#/docs/appearance/appearance-settings.md) shows every option.",
    chips: [chip("Create a cozy café character"), chip("Explain what agents do")],
  },
];

export function pickMariScript(text: string) {
  return (
    MARI_SCRIPTS.find((script) => script.match.test(text)) ?? {
      reply:
        "I can help with that in your own Marinara, where I read your real data. Here I know a few tricks: I can create a character, add a lorebook entry, or explain agents and connections. Pick one below.",
      chips: MARI_STARTER_CHIPS,
      action: undefined,
    }
  );
}

export const MARI_CHARACTER = {
  name: "Wren Hollis",
  description:
    "Baker at the Copper Kettle on Saltmere's harbor road. Flour on her sleeves, a pencil behind one ear, and a window seat she saves for regulars.",
  personality: "Warm, chatty and a little nosy. Remembers every order and every rumour.",
  first_mes:
    "*Wren slides a cinnamon knot across the counter.* On the house, since you look like you walked in from the fog. What can I get you?",
};

export const MARI_ENTRY = {
  name: "The lamp keeper's log",
  keys: ["keeper", "log", "lamp oil"],
  content:
    "The lamp keeper's log records ninety years of nights. The last page says the oil went bad the night the Gull's Promise came in late, and nobody knows who delivered it.",
};
