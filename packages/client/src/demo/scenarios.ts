import { DEMO_ASSETS } from "./seed";

// Scripted replies. Matching is keyword based; this is not a language model.
export const DEMO_FALLBACK_REPLY =
  "*Smiles and tips their head.* This is a scripted demo, so I only know a few topics. Try asking about the lighthouse, the fog, the harbor, agents, presets or the ruins. In your own Engine, a real model would answer anything.";

const SCENARIOS: { match: RegExp; reply: string }[] = [
  {
    match: /\b(?:lighthouse|lantern|lamp|light)\b/i,
    reply: `*Iris leads you up the spiral stairs.* The lamp has burned for ninety years. On clear nights you can see it from ten miles out. *(This reply is scripted. The lorebook entry about the lighthouse shows how world notes can feed a real reply.)*\n\n![Iris’s lantern beside the lighthouse stairs](${new URL(DEMO_ASSETS.lantern, window.location.href).href})`,
  },
  {
    match: /\b(?:fog|weather|storm)\b/i,
    reply:
      "*She checks a brass barometer, jaw clenched.* Fog until midnight, I'd say. The ships will sound their horns. Stay for tea until it lifts.",
  },
  {
    match: /\b(?:harbor|ships?|boats?|saltmere)\b/i,
    reply:
      "Saltmere is small, but the harbor never sleeps. Fishing boats at dawn, traders at noon, and stories all night.",
  },
  {
    match: /^\s*(hi|hello|hey)\b/i,
    reply: "*Iris grins and waves.* Hello again! Ask me about the lighthouse, the fog, or the harbor.",
  },
];

const HARBOR = new URL(DEMO_ASSETS.harbor, window.location.href).href;
const MIRA_SELFIE = new URL(`${import.meta.env.BASE_URL}demo-assets/avatars/mira-voss.webp`, window.location.href).href;
const RAIN_STREET = new URL(
  `${import.meta.env.BASE_URL}demo-assets/backgrounds/rain-city-street.webp`,
  window.location.href,
).href;

// Per-character replies, tried before the Iris ones. Each points at a feature the demo shows.
const BY_CHARACTER: Record<string, { match: RegExp; reply: string }[]> = {
  "demo-character-mira": [
    {
      match: /\b(?:crew|who'?s on)\b/i,
      reply:
        "Me, Vale and K-7. This is a group chat, so everyone here gets a turn, and you can mute or nudge anyone from the chat header. (Scripted.)",
    },
    {
      match: /\broll call\b/i,
      reply:
        "*Mira:* here. *Vale:* here, and hydrated. *K-7:* PRESENT. In a real group chat each of us answers in our own voice. (Scripted.)",
    },
    {
      match: /\bjoke\b/i,
      reply:
        'K-7 tried one: "Why did the robot cross the deck? It was programmed to." We are still recovering. Running jokes like this can live in a character\'s lorebook. (Scripted.)',
    },
    {
      match: /\b(?:agent|help|track)/i,
      reply:
        "Agents run beside a chat and keep notes for you, like a tracker for my repair log. Open the Agents panel to see the examples.",
    },
    {
      match: /\b(?:preset|prompt)/i,
      reply:
        "Presets decide how the prompt is built. Swap one in the Presets panel and I would talk differently. (Scripted demo reply.)",
    },
    {
      match: /\b(?:hi|hello|hey)\b/i,
      reply: "Hey! Ask me about agents or presets. This is a scripted demo, so I only know a few topics.",
    },
    {
      match: /\b(?:selfie|photo|picture)\b/i,
      reply: `*Mira sends a selfie from deck 4.* Proof I am still awake. In your own Engine, characters can send real selfies once you connect an image model. (Scripted.)\n\n![Mira on deck 4](${MIRA_SELFIE})`,
    },
  ],
  "demo-character-orsolo": [
    {
      match: /\b(?:ship|sail|sea|brig|gull)/i,
      reply:
        "*Orsolo grins.* The Gull's Promise! Her entry sits in the Saltmere Harbor lorebook, and a keyword like 'ship' pulls it into the prompt. (Scripted.)",
    },
    {
      match: /\b(?:sprite|face|look)/i,
      reply:
        "In roleplay mode, a character can show sprites that change with the mood. Check the Characters panel. (Scripted.)",
    },
    {
      match: /\b(?:lorebook|lore)\b/i,
      reply:
        "*Orsolo unrolls a sea chart.* The Saltmere Harbor lorebook holds the fog, the lighthouse and my ship. Mention one of them and its entry joins the prompt. Open Lorebooks in the top bar to read every entry. (Scripted.)",
    },
  ],
  "demo-character-kestrel": [
    {
      match: /\b(?:stair|down)/i,
      reply:
        '*You descend.* Water drips. A glowing map hangs on the wall, which is the game mode map. Roll for perception. (Scripted.)\n[Kestrel] [serious]: "Stay close. Something lives down here."',
    },
    {
      match: /\b(?:bridge|cross)/i,
      reply:
        "The bridge sways. A skill check appears: dice roll, difficulty 12. In a real game the dice are rolled for you. (Scripted.)",
    },
    {
      match: /\b(?:door|open)/i,
      reply:
        "The door has no handle, but the Ember Reach lorebook says it opens to a spoken word. Try 'ember'. (Scripted.)",
    },
    {
      match: /\b(?:roll|dice|perception)\b/i,
      reply:
        '*The dice clatter: 13 + 3 = 16.* Success. You spot a loose stone in the wall, and behind it a rusted key. In a real game the roll is random and the game master reacts to it. (Scripted roll.)\n[Kestrel] [happy]: "A key! Good eyes."',
    },
  ],
  "demo-character-vale": [
    {
      match: /\b(?:schedule|today|shift)\b/i,
      reply:
        "Clinic until six, then a long walk around the ring. In conversation mode every character has a daily schedule, so I might be busy when you text. (Scripted.)",
    },
    {
      match: /\b(?:sleep|tired)\b/i,
      reply:
        "Then put the screen down soon. Doctor's orders. Characters can also message you first, so I'll check in tomorrow. (Scripted.)",
    },
    {
      match: /\b(?:remember|allerg\w*)\b/i,
      reply:
        "Noted: no peanuts. In your Engine, memory and lorebook entries carry facts like this into later chats. (Scripted.)",
    },
  ],
  "demo-character-juniper": [
    {
      match: /\busual\b/i,
      reply:
        "*Juniper starts your oat latte before you finish.* Extra cinnamon, like last time. I remember because the chat keeps its history. (Scripted.)",
    },
    {
      match: /\b(?:menu|new)\b/i,
      reply:
        "Cinnamon knots, and a pear tart if you're quick. Everything I know about this place comes from my character card, so I never mix it up. (Scripted.)",
    },
    {
      match: /\b(?:caf[eé]|show|picture|photo)\b/i,
      reply: `*She points out the window.* Best view in Saltmere. Characters can share pictures in chat. (Scripted.)\n\n![The harbor from the café window](${HARBOR})`,
    },
  ],
  "demo-character-k7": [
    {
      match: /\bjoke\b/i,
      reply: "WHY DID THE ROBOT GO ON VACATION? TO RECHARGE. *K-7's lights blink proudly.* (Scripted.)",
    },
    {
      match: /\b(?:working|doing|up to)\b/i,
      reply:
        "REPAIRING LIGHT 14. I HAVE NAMED IT GERALD. My character card says I name things, so I always will. (Scripted.)",
    },
    {
      match: /\bdream\w*\b/i,
      reply: "I DREAM OF FRESHLY OILED HINGES. Edit my character card and you change how I talk. (Scripted.)",
    },
  ],
  "demo-character-tamsin": [
    {
      match: /\b(?:song|play|sing)\b/i,
      reply:
        "*Tamsin strikes a chord and the whole tavern stamps along.* In roleplay, a music agent can pick tracks to fit the scene. (Scripted.)",
    },
    {
      match: /\b(?:orsolo|story)\b/i,
      reply:
        "*Orsolo is already on his feet, telling the one about the giant squid.* Two characters, one scene: each speaks in their own voice. (Scripted.)",
    },
    {
      match: /\b(?:salt rat|tavern)\b/i,
      reply:
        "Low beams, loud songs and a cat that steals fish. That's the Saltmere Harbor lorebook: say 'tavern' and the entry joins the prompt. (Scripted.)",
    },
  ],
  "demo-character-seraphine": [
    {
      match: /\b(?:silver|ashcombe)\b/i,
      reply:
        "Lord Ashcombe. He owes money to half the court. *She smiles.* The Hollowmere Court lorebook makes sure I never forget it. (Scripted.)",
    },
    {
      match: /\bdance\b/i,
      reply:
        "*She takes your hand and leads you onto the floor.* Roleplay chats can set the mood with a background and sprites. (Scripted.)",
    },
    {
      match: /\bmask\b/i,
      reply:
        "Before midnight? How rude. *She laughs.* A lorebook entry for 'mask' tells me the court's rules. (Scripted.)",
    },
  ],
  "demo-character-rook": [
    {
      match: /\b(?:know|clues?|case)\b/i,
      reply:
        "Clock stopped at 3:12. Caretaker inside. A red umbrella near every scene. The Rain City Case Files lorebook keeps the clues straight. (Scripted.)",
    },
    {
      match: /\b(?:clock|tower)\b/i,
      reply:
        "*Rook shines his torch on the gears.* Someone jammed them with a key. Clues like this wake up when a keyword shows up in the chat. (Scripted.)",
    },
    {
      match: /\bumbrella\b/i,
      reply: `That's the question. *He turns up his collar.* With a real model, the twist is yours to find. (Scripted. In your Engine, the Illustrator agent can draw the scene like this.)\n\n![The street with the red umbrella](${RAIN_STREET})`,
    },
  ],
};

/** Suggested messages per example chat. Each one reaches a different scripted reply above. */
export const DEMO_PROMPTS: Record<string, { tip: string; prompts: string[] }> = {
  "demo-chat-iris": {
    tip: "lorebook",
    prompts: ["Tell me about the lighthouse.", "Will the fog lift tonight?", "What is the harbor like?"],
  },
  "demo-chat-mira": {
    tip: "conversation",
    prompts: ["What does an agent do?", "What is a preset?", "Send me a selfie!"],
  },
  "demo-chat-orsolo": {
    tip: "roleplay",
    prompts: ["Tell me about your ship.", "Show me your sprite.", "What is in the lorebook?"],
  },
  "demo-chat-kestrel": { tip: "game", prompts: ["Take the stairs down.", "Cross the bridge.", "Roll for perception."] },
  "demo-chat-crew": { tip: "crew", prompts: ["Who's on the crew?", "Everyone, roll call!", "Ask K-7 for a joke."] },
  "demo-chat-vale": {
    tip: "schedules",
    prompts: ["What's your schedule today?", "I can't sleep.", "Remember my allergy: peanuts."],
  },
  "demo-chat-juniper": { tip: "cafe", prompts: ["The usual, please.", "What's new on the menu?", "Show me the café."] },
  "demo-chat-k7": { tip: "robot", prompts: ["Tell me a joke.", "What are you working on?", "Do you dream?"] },
  "demo-chat-tavern": {
    tip: "tavern",
    prompts: ["Play us a song!", "Orsolo, tell us a story.", "What's the Salt Rat like?"],
  },
  "demo-chat-seraphine": {
    tip: "court",
    prompts: ["Who is the man in silver?", "Shall we dance?", "Take off your mask."],
  },
  "demo-chat-rook": {
    tip: "noir",
    prompts: ["What do we know?", "Check the clock tower.", "Who has the red umbrella?"],
  },
};

export function pickDemoReply(userText: string, characterId?: string | null): string {
  const list = [...(BY_CHARACTER[characterId ?? ""] ?? []), ...SCENARIOS];
  return list.find((s) => s.match.test(userText))?.reply ?? DEMO_FALLBACK_REPLY;
}
