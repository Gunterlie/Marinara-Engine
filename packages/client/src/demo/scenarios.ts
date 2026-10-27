import { DEMO_ASSETS } from "./seed";

// Prewritten replies, matched by keyword. Every bubble stays in character; the honesty note lives in DemoPrompts.
export const DEMO_FALLBACK_REPLY =
  "*Iris tilts her head and smiles.* Hm, that one is beyond me. I keep a lighthouse, I don't read minds. Ask me about the lighthouse, the fog or the harbor, and I'll talk all night.";

const SCENARIOS: { match: RegExp; reply: string }[] = [
  {
    match: /\b(?:lighthouse|lantern|lamps?|light|tower)\b/i,
    reply: `*Iris leads you up the spiral stairs, grinning.* Ninety years this lamp has burned. On clear nights ships see it from ten miles out. Tonight it flickers, and I think something in the oil is wrong.\n\n![Iris’s lantern beside the lighthouse stairs](${new URL(DEMO_ASSETS.lantern, window.location.href).href})`,
  },
  {
    match: /\b(?:fog|foggy|weather|storm|mist)\b/i,
    reply:
      "*She checks a brass barometer, jaw clenched.* Fog until midnight, I'd say. The ships will sound their horns. If the Gull's Promise is still out there, she is sailing blind.",
  },
  {
    match: /\b(?:harbou?r|ships?|boats?|saltmere|town)\b/i,
    reply:
      "Saltmere is small, but the harbor never sleeps. Fishing boats at dawn, traders at noon, and stories all night. Tonight half the town is on the pier, waiting for one late ship.",
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

// Per-character replies. Characters without a list (Iris) use SCENARIOS above.
const BY_CHARACTER: Record<string, { match: RegExp; reply: string }[]> = {
  // Mira also speaks first in the Deck 4 crew chat, so her list covers both chats.
  "demo-character-mira": [
    {
      match: /\b(?:roll ?call|everyone|who'?s here)\b/i,
      reply:
        "*Mira:* here, armed with a wrench. *Vale:* here, and hydrated. *K-7:* PRESENT. ALSO BOLT IS PRESENT. *Vale:* Who is Bolt? *K-7:* NO COMMENT.",
    },
    {
      match: /\b(?:vents?|check|flashlight|torch|moving|noise)\b/i,
      reply:
        "*Mira:* Flashlight on. Two green eyes blink back. *Vale:* It is a cat. Why is there a cat on a space station? *K-7:* HER NAME IS BOLT. I ADOPTED HER LAST TUESDAY. *Mira:* K-7!",
    },
    {
      match: /\b(?:jokes?|funny|puns?)\b/i,
      reply:
        "*K-7:* WHY DID THE ROBOT CROSS THE DECK? IT WAS PROGRAMMED TO. *Vale:* I am prescribing silence. *Mira:* Don't encourage him. He has forty more.",
    },
    {
      match: /\b(?:selfie|photo|pic|picture|proof)\b/i,
      reply: `*Mira holds the phone up and grins.* Proof. Me, deck 4, and the haunted machine behind me, steaming like it knows something. Don't zoom in on my hair.\n\n![Mira on deck 4](${MIRA_SELFIE})`,
    },
    {
      match: /\b(?:haunt\w*|ghosts?|machine|coffee|tea)\b/i,
      reply:
        "It just drew a smiley in the foam. A SMILEY. I unplugged it and it kept humming for ten seconds. Filing this under 'not my problem'. Also under 'definitely my problem'.",
    },
    {
      match: /\b(?:awake|who else|crew|vale|k-?7)\b/i,
      reply:
        "Vale is on night shift, pretending not to be tired. K-7 is polishing light 14 and talking to it. Want me to drag them both into the Deck 4 crew chat? Chaos guaranteed.",
    },
    {
      match: /^\s*(?:hi|hello|hey)\b/i,
      reply: "Hey! You're up late too? Good. Someone has to witness the haunted coffee machine with me.",
    },
  ],
  "demo-character-orsolo": [
    {
      match: /\b(?:cove|chest|treasure|smuggl\w*|seal|teeth)\b/i,
      reply:
        "*He unrolls a salt-stained chart.* Two rocks guard the way in. Sailors call them the Teeth. Low tide gives us one hour, no more. Roll well, friend, because the Teeth have eaten better sailors than us.",
    },
    {
      match: /\b(?:ship|sail\w*|sea|brig|gull'?s?|boat|crew)\b/i,
      reply:
        "*Orsolo pats the mast like an old dog and grins.* The Gull's Promise. Patched sails, a leaky hold, and she has never sunk once. My crew swears she is lucky. I swear she is stubborn, like her captain.",
    },
    {
      match: /\b(?:lorebook|lore|legends?|tales?|stor(?:y|ies))\b/i,
      reply:
        "*Orsolo taps his temple.* Every tale of this harbor lives up here: the fog, the lighthouse, the Salt Rat, my ship. Say one of their names and I'll tell you all of it, with only some lies.",
    },
  ],
  "demo-character-kestrel": [
    {
      match: /\bember\b/i,
      reply:
        'The carved flame glows red and the door sighs open. Warm air rolls out, smelling of ash and old honey.\n[Kestrel] [happy]: "Ember! Of course it was ember. Nice."',
    },
    {
      match: /\b(?:stairs?|down|descend)\b/i,
      reply:
        'You descend. Water drips from the ceiling, and a glowing map of the Reach covers the far wall. Something scrapes in the dark below. Roll for perception.\n[Kestrel] [serious]: "Stay close. Something lives down here."',
    },
    {
      match: /\b(?:bridge|cross)\b/i,
      reply:
        'The bridge sways over a river of slow fire. Planks crack under your boots. Skill check, difficulty 12. Roll the dice.\n[Kestrel] [happy]: "Do not look down. I looked down. Bad idea."',
    },
    {
      match: /\b(?:door|open|handle)\b/i,
      reply:
        'The door has no handle, only a carved flame. Old words circle it: speak, and be warmed. Say a word.\n[Kestrel] [serious]: "I tried please. It did not care."',
    },
    {
      match: /\b(?:pack|bag|inventory|items?|gear)\b/i,
      reply:
        'Your pack holds a coil of rope, two torches and a brass key that hums when you face east. The Ember Heart is east.\n[Kestrel] [serious]: "Keys that hum are never good news. Keep it close."',
    },
    {
      match: /\b(?:ladder|climb)\b/i,
      reply:
        "You climb. Wet rungs, cold rope, and at the top a lantern in a stranger's fist. Behind him, crates stamped with the harbor master's seal.\n[Kestrel] [happy]: \"Well. Now we know what the cove hides.\"",
    },
    {
      match: /\b(?:lanterns?|blink\w*|signal)\b/i,
      reply:
        'You blink the lantern three times. Silence. Then a rope ladder drops from the cliff, and a voice hisses: "You are late, and you are not Captain Orsolo."\n[Kestrel] [happy]: "They are expecting us now."',
    },
    {
      match: /\b(?:roll|dice|perception|search|look)\b/i,
      reply:
        'Dust hangs in the torchlight. Roll the dice and tell the Reach what you are looking for.\n[Kestrel] [happy]: "I bet on a high number. No pressure."',
    },
  ],
  "demo-character-vale": [
    {
      match: /\b(?:blunt|honest|straight|harsh)\b/i,
      reply:
        "Blunt? Fine. You run on coffee, spite and three hours of sleep, and your hands shake when you lie about it. Bed by eleven, or I tell Mira you cried at the cat video.",
    },
    {
      match: /\b(?:gentl\w*|soft\w*|kind\w*|calm|nice)\b/i,
      reply:
        "*Vale's voice drops, slow and warm.* Hey. You are doing fine. Breathe in for four, out for six. The station hums, the cat sleeps, and nothing needs you until morning.",
    },
    {
      match: /\b(?:schedule|today|shift|busy|plans?)\b/i,
      reply:
        "Clinic until six, then a long walk around the ring. Then I read the same page of my book four times and fall asleep. If you text after nine, expect a very tired emoji.",
    },
    {
      match: /\b(?:sleep|tired|insomnia)\b/i,
      reply: "Then put the screen down soon. Doctor's orders. I'll check in tomorrow, and I will know if you lied.",
    },
  ],
  "demo-character-juniper": [
    {
      match: /\b(?:usual|same|regular|order)\b/i,
      reply:
        "*Juniper starts your oat latte before you finish.* Oat latte, extra cinnamon, no lid, because you always burn your lip anyway. And a pear tart, since it's Thursday. I know my regulars.",
    },
    {
      match: /\b(?:remember|about me|know me)\b/i,
      reply:
        "You're the traveler from the lighthouse road. Window seat, you hate jazz and pretend you don't. Tuesday you came in with a map you kept hiding from me. *She grins.* I notice things.",
    },
    {
      match: /\b(?:gr[ae]y|man|stranger|coat|window|view)\b/i,
      reply: `*She lowers her voice.* 8:14, every morning. Black coffee, two sugars, never drinks it. He just stares at this view until the lighthouse blinks.\n\n![The harbor from the café window](${HARBOR})`,
    },
  ],
  "demo-character-k7": [
    {
      match: /\b(?:scan|tools?|run|sensors?)\b/i,
      reply:
        "RUNNING STATION_SCAN. BEEP. DECK 4: ONE HAUNTED COFFEE MACHINE. CARGO BAY 2: ONE CAT, ONE LIGHT, BOTH WARM. CONCLUSION: BOLT IS SLEEPING ON GERALD.",
    },
    {
      match: /\b(?:light|gerald|14|missing|where)\b/i,
      reply:
        "LIGHT 14 IS NAMED GERALD. GERALD WAS UNSCREWED AT 03:12. THE CAMERA LOG SHOWS A SMALL FURRY THIEF. I SUSPECT BOLT. I DO NOT HAVE THE HEART TO ARREST HER.",
    },
    {
      match: /\b(?:jokes?|funny|puns?)\b/i,
      reply:
        "NEW JOKE. I AM READING A BOOK ON ANTI-GRAVITY. I CANNOT PUT IT DOWN. *K-7's lights blink proudly.* PLEASE LAUGH AT THE USUAL VOLUME.",
    },
  ],
  "demo-character-tamsin": [
    {
      match: /\b(?:spooky|scary|ghosts?|sad|slow|dark)\b/i,
      reply:
        "*Tamsin hushes the room and plucks one low string.* The candles gutter. Rain taps the shutters. Somewhere outside a bell rings twice, though the harbor has no bell. *She smiles.* Too much?",
    },
    {
      match: /\b(?:orsolo|story|tale)\b/i,
      reply:
        "*Orsolo is already on his feet.* The squid was THIS big, I tell ye! *Tamsin plays a dramatic chord on every lie.* By the end the squid is the size of the harbor, and somehow he married it.",
    },
    {
      match: /\b(?:jig|fast\w*|dance|happy|play|songs?|sing|music|tune)\b/i,
      reply:
        "*Tamsin stamps a beat and the whole Salt Rat joins in.* Mugs bang the tables, the cat leaps onto the bar, and Orsolo dances like a bear on a rolling deck. *She laughs.* Faster? Gladly!",
    },
  ],
  "demo-character-seraphine": [
    {
      match: /\b(?:silver|ashcombe|man)\b/i,
      reply:
        "*She leans closer, voice like silk.* Lord Ashcombe. He owes money to half the court and a duel to the other half. Tonight he wears silver so nobody remembers he sold his family's swords.",
    },
    {
      match: /\b(?:balcony|secrets?|east|guards?)\b/i,
      reply:
        "*Seraphine glances at the guards.* The east balcony is where secrets change hands. The guards are paid to watch the moon. Bring me a name, and I will trade you one.",
    },
    {
      match: /\bmasks?\b/i,
      reply:
        "*She catches your wrist, smiling.* Before midnight? How rude. At Hollowmere, the one who unmasks first loses everything. Wait for the bells, darling, and perhaps you will see my face.",
    },
    {
      match: /\bdanc\w*\b/i,
      reply:
        "*She takes your hand and leads you onto the floor.* One, two, three. Whisper while we turn. The walls have ears, but the music is loud.",
    },
  ],
  "demo-character-rook": [
    {
      match: /\b(?:know|clues?|case|facts?)\b/i,
      reply:
        "*Rook ticks them off on his fingers.* Clock stopped at 3:12. Caretaker dead inside. A key that fits nothing. A red umbrella near every scene. Four facts, zero answers, and my coffee went cold an hour ago.",
    },
    {
      match: /\b(?:clock|tower|gears?|keys?)\b/i,
      reply:
        "*Rook shines his torch on the gears and frowns.* Someone jammed them with a second key. Same cut as the one in the caretaker's hand. Two keys, one lock, somewhere in this city.",
    },
    {
      match: /\b(?:umbrella|red|woman|witness)\b/i,
      reply: `*He turns up his collar and points down the street.* There. Red umbrella, under the lamp, gone before I could shout. I sketched it fast, before the rain washed it off.\n\n![The street with the red umbrella](${RAIN_STREET})`,
    },
  ],
};

// In-character answers when no keyword matches; each nudges toward the chips.
const FALLBACKS: Record<string, string> = {
  "demo-character-mira":
    "Ha. You lost me there, and I just pulled a double shift. Ask me about the haunted machine, or make me send a selfie.",
  "demo-character-orsolo":
    "*Orsolo scratches his beard.* Ye've lost me, landlubber. Ask about my ship or the smugglers' cove, or throw the dice and let the sea decide.",
  "demo-character-kestrel":
    'The torches flicker while you think. Three ways lie open: the stair down, the bridge, and the door with no handle.\n[Kestrel] [serious]: "Pick one. Standing still in ruins is how people become ruins."',
  "demo-character-vale":
    "Hmm. I'll file that under 'interesting, not urgent'. Ask about my day, or tell me how you want me to talk: blunt or gentle.",
  "demo-character-juniper":
    "*She tilts her head.* You lost me, hon. Want your usual, or shall I tell you about the man in the grey coat?",
  "demo-character-k7":
    "INPUT NOT UNDERSTOOD. I CAN RUN A STATION SCAN, LOOK FOR LIGHT 14, OR TELL A JOKE. PLEASE SELECT. BEEP.",
  "demo-character-tamsin":
    "*Tamsin strums a chord that sounds like a question.* No song for that one, friend. Something spooky, a jig, or one of Orsolo's tall tales?",
  "demo-character-seraphine":
    "*Seraphine snaps her fan shut.* Dull questions bore me, darling. Ask about the man in silver, the east balcony, or my mask.",
  "demo-character-rook":
    "*Rook tries to light a cigarette in the rain.* Doesn't help the case, kid. Ask what we know, check the clock tower, or find that umbrella.",
};

/** Suggested messages per example chat. Each one reaches a different reply above. */
export const DEMO_PROMPTS: Record<string, { tip: string; prompts: string[] }> = {
  "demo-chat-iris": {
    tip: "lorebook",
    prompts: ["Tell me about the lighthouse.", "Will the fog lift tonight?", "What is the harbor like?"],
  },
  "demo-chat-mira": {
    tip: "conversation",
    prompts: ["Send me a selfie!", "Is the machine still haunted?", "Who else is awake?"],
  },
  "demo-chat-orsolo": {
    tip: "roleplay",
    prompts: ["Tell me about your ship.", "Tell me about the cove.", "What tales do you know?", "/roll 2d6+2"],
  },
  "demo-chat-kestrel": { tip: "game", prompts: ["Take the stairs down.", "Cross the bridge.", "Check my pack."] },
  "demo-chat-smugglers": { tip: "game", prompts: ["Blink the lantern back.", "Climb the ladder.", "Check my pack."] },
  "demo-chat-crew": { tip: "crew", prompts: ["Check the vents.", "Everyone, roll call!", "K-7, tell us a joke."] },
  "demo-chat-vale": {
    tip: "schedules",
    prompts: ["Be blunt with me, doc.", "Talk to me gently.", "What's your schedule today?"],
  },
  "demo-chat-juniper": {
    tip: "cafe",
    prompts: ["The usual, please.", "What do you remember about me?", "Tell me about the man in grey."],
  },
  "demo-chat-k7": { tip: "robot", prompts: ["Run the station scan.", "Where is light 14?", "Tell me a joke."] },
  "demo-chat-tavern": {
    tip: "tavern",
    prompts: ["Play something spooky.", "Play us a jig!", "Orsolo, tell us a story."],
  },
  "demo-chat-seraphine": {
    tip: "court",
    prompts: ["Who is the man in silver?", "What happens on the balcony?", "Take off your mask."],
  },
  "demo-chat-rook": {
    tip: "noir",
    prompts: ["What do we know?", "Check the clock tower.", "Who has the red umbrella?", "/roll 1d20"],
  },
};

export function pickDemoReply(userText: string, characterId?: string | null): string {
  // Game dice arrive as "[dice: 1d20 = 14 ...]"; the roll is real, so the reply uses its total.
  const dice = userText.match(/\[dice: ([^\]=]+?) = (-?\d+)/);
  if (dice)
    return `The dice land on ${dice[2]}. ${Number(dice[2]) >= 10 ? "It works. The way ahead is clear." : "Not this time. Something shifts in the dark."}`;
  const list = BY_CHARACTER[characterId ?? ""] ?? SCENARIOS;
  return list.find((s) => s.match.test(userText))?.reply ?? FALLBACKS[characterId ?? ""] ?? DEMO_FALLBACK_REPLY;
}
