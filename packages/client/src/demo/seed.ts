// Immutable example content. The runtime deep-copies it into per-tab memory.
import { DEFAULT_GENERATION_PARAMS } from "@marinara-engine/shared";

export const DEMO_SEED_IDS = {
  characterId: "demo-character-iris",
  chatId: "demo-chat-iris",
  lorebookId: "demo-lorebook-harbor",
  personaId: "demo-persona-you",
  connectionId: "demo-connection",
} as const;

export const DEMO_ASSETS = {
  iris: `${import.meta.env.BASE_URL}demo-assets/iris.webp`,
  harbor: `${import.meta.env.BASE_URL}demo-assets/saltmere-harbor.webp`,
  lantern: `${import.meta.env.BASE_URL}demo-assets/lighthouse-lantern.webp`,
} as const;

const NOW = "2026-01-01T00:00:00.000Z";

const portrait = (bg: string, letter: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" fill="${bg}"/><text x="64" y="84" font-size="64" text-anchor="middle" fill="white" font-family="sans-serif">${letter}</text></svg>`,
  )}`;

export function createSeed() {
  const characterData = {
    name: "Iris",
    description:
      "Iris is a cheerful lighthouse keeper in the harbor town of Saltmere. She is a made-up example character for the demo.",
    personality: "Warm, curious, a little teasing. Loves weather reports and stories about ships.",
    scenario: "You walk into the lighthouse on a foggy evening.",
    first_mes: "Oh, a visitor! Come in out of the fog. I just put the kettle on. What brings you to Saltmere?",
    mes_example: "",
    creator_notes: "Example character bundled with the Marinara Engine demo.",
    system_prompt: "",
    post_history_instructions: "",
    alternate_greetings: [],
    tags: ["demo", "example"],
    creator: "Marinara Engine",
    character_version: "1.0",
    extensions: {},
  };
  const characters = [
    {
      id: DEMO_SEED_IDS.characterId,
      data: JSON.stringify(characterData),
      comment: "Demo example",
      avatarPath: DEMO_ASSETS.iris,
      name: "Iris",
      favorite: false,
      createdAt: NOW,
      updatedAt: NOW,
    },
  ];
  const personas = [
    {
      id: DEMO_SEED_IDS.personaId,
      name: "You",
      comment: "",
      description: "A traveler visiting Saltmere. Edit this persona to change who you play.",
      personality: "",
      scenario: "",
      backstory: "",
      appearance: "",
      avatarPath: portrait("#4a6fb5", "Y"),
      isActive: "true",
      tags: ["traveler"],
      creator: "",
      creatorNotes: "",
      personaVersion: "1.0",
      versioningEnabled: false,
      nameColor: "",
      dialogueColor: "",
      boxColor: "",
      createdAt: NOW,
      updatedAt: NOW,
    },
  ];
  const lorebooks = [
    {
      id: DEMO_SEED_IDS.lorebookId,
      name: "Saltmere Harbor",
      description: "Example world notes for the demo.",
      category: "world",
      enabled: true,
      isGlobal: false,
      characterId: null,
      chatId: null,
      tags: [],
      scanDepth: 2,
      tokenBudget: 2048,
      createdAt: NOW,
      updatedAt: NOW,
    },
  ];
  const lorebookEntries = [
    {
      id: "demo-entry-lighthouse",
      lorebookId: DEMO_SEED_IDS.lorebookId,
      name: "The Saltmere Lighthouse",
      content:
        "The Saltmere lighthouse was built 90 years ago. Its lamp burns a warm amber light that ships can see from ten miles out.",
      keys: ["lighthouse", "lamp"],
      secondaryKeys: [],
      enabled: true,
      constant: false,
      selective: false,
      selectiveLogic: "and",
      probability: null,
      scanDepth: null,
      matchWholeWords: false,
      caseSensitive: false,
      position: 0,
      depth: 4,
      order: 100,
      role: "system",
      folderId: null,
      tag: "",
      createdAt: NOW,
      updatedAt: NOW,
    },
  ];
  const chats = [
    {
      id: DEMO_SEED_IDS.chatId,
      name: "Evening at the lighthouse",
      mode: "roleplay",
      characterIds: [DEMO_SEED_IDS.characterId],
      groupId: null,
      personaId: DEMO_SEED_IDS.personaId,
      promptPresetId: null,
      connectionId: DEMO_SEED_IDS.connectionId,
      connectedChatId: null,
      folderId: null,
      sortOrder: 0,
      lastMessageAt: NOW,
      createdAt: NOW,
      updatedAt: NOW,
      metadata: { background: DEMO_ASSETS.harbor },
    },
  ];
  const messages = [
    {
      id: "demo-message-1",
      chatId: DEMO_SEED_IDS.chatId,
      role: "assistant",
      characterId: DEMO_SEED_IDS.characterId,
      content: characterData.first_mes,
      activeSwipeIndex: 0,
      swipeCount: 0,
      createdAt: NOW,
      extra: {},
    },
  ];
  // A fake connection so the composer is enabled. Nothing is ever sent to it: /generate is scripted.
  const connections = [
    {
      id: DEMO_SEED_IDS.connectionId,
      name: "Demo (scripted replies)",
      provider: "custom",
      baseUrl: "",
      model: "demo-scripted",
      pinnedModels: [],
      imagePath: null,
      maxContext: 8192,
      isDefault: true,
      fallbackForMain: false,
      useForRandom: false,
      defaultForAgents: false,
      fallbackForAgents: false,
      enableCaching: false,
      anthropicExtendedCacheTtl: false,
      cachingAtDepth: 0,
      embeddingModel: null,
      embeddingBaseUrl: null,
      embeddingConnectionId: null,
      openrouterProvider: null,
      imageGenerationSource: null,
      comfyuiWorkflow: null,
      imageService: null,
      imageEndpointId: null,
      imagePromptInstructions: null,
      imageGenerationQuality: "standard",
      videoGenerationSource: null,
      videoService: null,
      videoPromptInstructions: null,
      audioSource: null,
      credentialsFromConnectionId: null,
      maxStateTokens: null,
      audioVoice: null,
      audioMs: null,
      audioSoundEffects: false,
      audioMusic: false,
      audioMusicEndpoint: null,
      defaultParameters: null,
      promptPresetId: null,
      maxTokensOverride: null,
      maxParallelJobs: 1,
      maxRequestsPerMinute: null,
      treatAsLocalEndpoint: false,
      folderId: null,
      showUsageWidget: false,
      hasApiKey: false,
      createdAt: NOW,
      updatedAt: NOW,
    },
  ];
  const settings: Record<string, string> = {};
  // More example content, built from the Iris rows so every field keeps the same shape.
  // Counting back from today's UTC midnight keeps every tab in sync and the chats recent.
  const midnight = Math.floor(Date.now() / 86_400_000) * 86_400_000;
  const ago = (minutes: number) => new Date(midnight - minutes * 60_000).toISOString();
  const extra = [
    [
      "demo-character-mira",
      "Mira Voss",
      "#3b82a6",
      "M",
      "A sharp, funny station engineer who texts in short bursts. Made up for the demo.",
      "Hey, you up? The coffee machine on deck 4 is haunted again.",
      ["demo", "sci-fi"],
      true,
    ],
    [
      "demo-character-orsolo",
      "Captain Orsolo",
      "#a64b3b",
      "O",
      "A weathered sea captain with a booming laugh. Made up for the demo.",
      "*Orsolo slaps the map table.* Ye look like someone who needs a ship. Sit, sit!",
      ["demo", "adventure"],
      false,
    ],
    [
      "demo-character-kestrel",
      "Kestrel",
      "#6b8f3a",
      "K",
      "A dry-witted game master narrating the ember-lit ruins of Ember Reach. Made up for the demo.",
      "The gate groans open. Torchlight shows three paths: a stair down, a bridge, and a door with no handle. What do you do?",
      ["demo", "fantasy", "game master"],
      true,
    ],
    [
      "demo-character-seraphine",
      "Seraphine Vey",
      "#7c3aed",
      "S",
      "A masked noble who trades secrets at the Hollowmere court. Made up for the demo.",
      "*Seraphine lowers her fan.* You are new here. Dance with me, and I will tell you who to fear.",
      ["demo", "gothic", "intrigue"],
      true,
    ],
    [
      "demo-character-rook",
      "Detective Rook",
      "#475569",
      "R",
      "A tired detective in a city where it never stops raining. Made up for the demo.",
      "*Rook flicks rain off his hat.* The clock tower stopped at 3:12. So did the man inside it.",
      ["demo", "noir", "mystery"],
      false,
    ],
    [
      "demo-character-juniper",
      "Juniper Hale",
      "#d97706",
      "J",
      "Runs a tiny cafe and remembers everyone's order. Made up for the demo.",
      "Morning! Your usual? I tried a new cinnamon thing, you have to taste it.",
      ["demo", "slice of life", "cozy"],
      false,
    ],
    [
      "demo-character-k7",
      "K-7",
      "#0891b2",
      "K",
      "A polite maintenance robot learning human jokes. Made up for the demo.",
      "GREETINGS. I have prepared a joke. It contains a pun. Please brace.",
      ["demo", "sci-fi", "robot"],
      false,
    ],
    [
      "demo-character-vale",
      "Dr. Vale Okonkwo",
      "#16a34a",
      "V",
      "The station doctor, calm in every emergency. Made up for the demo.",
      "Checking in after your shift. Did you sleep, or do I need to prescribe a nap?",
      ["demo", "sci-fi", "medic"],
      false,
    ],
    [
      "demo-character-tamsin",
      "Tamsin Reed",
      "#db2777",
      "T",
      "A traveling bard who turns every tavern into a stage. Made up for the demo.",
      "*Tamsin tunes her lute.* Request a song, friend. Anything but sea shanties. Orsolo has worn them out.",
      ["demo", "fantasy", "music"],
      false,
    ],
  ] as const;
  const extraChars = extra.map(([id, name, bg, letter, description, first_mes, tags, favorite]) => ({
    ...characters[0],
    id,
    name,
    favorite,
    avatarPath: portrait(bg, letter),
    data: JSON.stringify({
      ...characterData,
      name,
      description,
      first_mes,
      tags: [...tags],
      scenario: "",
      personality: "",
    }),
  }));
  const firstMes = Object.fromEntries(extra.map(([id, , , , , first_mes]) => [id, first_mes]));

  const chatFolders = [
    {
      id: "demo-folder-saltmere",
      name: "Saltmere stories",
      mode: "roleplay",
      color: "#f29744",
      sortOrder: 0,
      collapsed: false,
      createdAt: NOW,
      updatedAt: NOW,
    },
    {
      id: "demo-folder-station",
      name: "Station crew",
      mode: "conversation",
      color: "#0891b2",
      sortOrder: 0,
      collapsed: false,
      createdAt: NOW,
      updatedAt: NOW,
    },
  ];

  // [id, name, mode, character ids, minutes ago, folder, background]
  const chatList: [string, string, string, string[], number, string | null, string | null][] = [
    ["demo-chat-mira", "Chat with Mira Voss", "conversation", ["demo-character-mira"], 6, "demo-folder-station", null],
    [
      "demo-chat-crew",
      "Deck 4 crew",
      "conversation",
      ["demo-character-mira", "demo-character-vale", "demo-character-k7"],
      25,
      "demo-folder-station",
      null,
    ],
    ["demo-chat-vale", "Chat with Dr. Vale", "conversation", ["demo-character-vale"], 190, "demo-folder-station", null],
    ["demo-chat-juniper", "Chat with Juniper", "conversation", ["demo-character-juniper"], 75, null, null],
    ["demo-chat-k7", "Chat with K-7", "conversation", ["demo-character-k7"], 1500, null, null],
    [
      "demo-chat-orsolo",
      "Aboard the Gull's Promise",
      "roleplay",
      ["demo-character-orsolo"],
      40,
      "demo-folder-saltmere",
      DEMO_ASSETS.harbor,
    ],
    [
      "demo-chat-tavern",
      "Songs at the Salt Rat",
      "roleplay",
      ["demo-character-tamsin", "demo-character-orsolo"],
      300,
      "demo-folder-saltmere",
      DEMO_ASSETS.lantern,
    ],
    ["demo-chat-seraphine", "The Hollowmere masquerade", "roleplay", ["demo-character-seraphine"], 130, null, null],
    ["demo-chat-rook", "The clock that stopped", "roleplay", ["demo-character-rook"], 2900, null, null],
    ["demo-chat-kestrel", "The Ember Reach run", "game", ["demo-character-kestrel"], 15, null, DEMO_ASSETS.lantern],
    [
      "demo-chat-smugglers",
      "Smugglers of Saltmere",
      "game",
      ["demo-character-kestrel"],
      4300,
      null,
      DEMO_ASSETS.harbor,
    ],
  ];

  // Longer scripted histories, so a few chats look lived in. user / assistant lines alternate after the first message.
  const history: Record<string, string[]> = {
    "demo-chat-mira": [
      "Haunted how?",
      "It made tea. Nobody asked for tea. It does not have a tea setting.",
      "Maybe it likes you.",
      "Great. A machine with a crush. Vale says I need more sleep.",
    ],
    "demo-chat-crew": [
      "Status report, everyone?",
      "[Mira] Coffee machine still haunted. Filing a ticket with the ghost.",
      "[Vale] Everyone drink water. That is my status.",
      "[K-7] I HAVE FIXED THE LIGHTS. I HAVE ALSO NAMED THEM.",
    ],
    "demo-chat-orsolo": [
      "Where are we sailing?",
      "*Orsolo jabs a finger at the chart.* North, past the lighthouse, where the fog hides the old smugglers' cove.",
      "Is it safe?",
      "*He laughs until the lantern swings.* Safe? No. Worth it? Aye.",
    ],
    "demo-chat-seraphine": [
      "Who should I fear?",
      "*She tilts her mask toward the balcony.* The man in silver. He smiles at everyone, which means he trusts no one.",
    ],
    "demo-chat-kestrel": [
      "I take the bridge.",
      "The bridge sways. Roll a skill check, difficulty 12. *The dice show 15.* You cross, and the far gate is already open.",
    ],
    "demo-chat-juniper": [
      "Surprise me.",
      "*She slides over a cup with a cinnamon heart on top.* On the house. Tell me if it is too sweet.",
    ],
  };

  const extraChats = chatList.map(([id, name, mode, characterIds, minutes, folderId, background], sortOrder) => ({
    ...chats[0],
    id,
    name,
    mode,
    characterIds,
    folderId,
    sortOrder,
    lastMessageAt: ago(minutes),
    createdAt: ago(minutes + 600),
    updatedAt: ago(minutes),
    // A game chat without a gameId opens the new-game wizard; these play as running games.
    metadata: {
      ...(background ? { background } : {}),
      ...(mode === "game" ? { gameId: id, gameSessionStatus: "active" } : {}),
    },
  }));
  const extraMessages = extraChats.flatMap((chat) => {
    const lines = [firstMes[chat.characterIds[0]], ...(history[chat.id] ?? [])];
    return lines.map((content, i) => {
      // Group chats name the speaker as "[Name] text"; pick that character's id.
      const speaker = /^\[([^\]]+)\]/.exec(content)?.[1];
      const characterId = extraChars.find((c) => speaker && c.name.includes(speaker))?.id ?? chat.characterIds[0];
      return {
        ...messages[0],
        id: `demo-message-${chat.id}-${i}`,
        chatId: chat.id,
        role: i % 2 && !speaker ? "user" : "assistant",
        characterId: i % 2 && !speaker ? null : characterId,
        content: speaker ? content.replace(/^\[[^\]]+\]\s*/, "") : content,
        createdAt: new Date(Date.parse(chat.lastMessageAt) - (lines.length - 1 - i) * 120_000).toISOString(),
      };
    });
  });

  const entry = (id: string, lorebookId: string, name: string, content: string, keys: string[]) => ({
    ...lorebookEntries[0],
    id,
    lorebookId,
    name,
    content,
    keys,
  });
  const book = (id: string, name: string, description: string, category = "world") => ({
    ...lorebooks[0],
    id,
    name,
    description,
    category,
  });
  const extraLorebooks = [
    book("demo-lorebook-ember", "Ember Reach", "Example ruins for the game mode demo."),
    book("demo-lorebook-deck4", "Deck 4", "Example station notes for Mira's chat."),
    book("demo-lorebook-hollowmere", "Hollowmere Court", "Example nobles and rumors for Seraphine's masquerade."),
    book("demo-lorebook-rain", "Rain City Case Files", "Example clues for Detective Rook."),
  ];
  const extraEntries = [
    entry(
      "demo-entry-fog",
      "demo-lorebook-harbor",
      "The Saltmere Fog",
      "Fog rolls in from the bay most evenings. The ships sound horns until it lifts.",
      ["fog", "horn"],
    ),
    entry(
      "demo-entry-orsolo-ship",
      "demo-lorebook-harbor",
      "The Gull's Promise",
      "Captain Orsolo's ship, a patched brig that has never sunk. Its crew swears it is lucky.",
      ["ship", "brig", "gull"],
    ),
    entry(
      "demo-entry-salt-rat",
      "demo-lorebook-harbor",
      "The Salt Rat",
      "The harbor tavern. Low beams, loud songs, and a cat that steals fish.",
      ["tavern", "salt rat"],
    ),
    entry(
      "demo-entry-ruins",
      "demo-lorebook-ember",
      "Ember Reach Ruins",
      "A drowned fortress lit by ever-burning torches. Three routes lead inside: stair, bridge and handleless door.",
      ["ruins", "fortress", "torch"],
    ),
    entry(
      "demo-entry-stair",
      "demo-lorebook-ember",
      "The Drowned Stair",
      "A spiral stair that ends in black water. A map of the reach glows on the wall at the bottom.",
      ["stair", "stairs", "map"],
    ),
    entry("demo-entry-door", "demo-lorebook-ember", "The Handleless Door", "It opens to a spoken word: ember.", [
      "door",
      "ember",
    ]),
    entry(
      "demo-entry-coffee",
      "demo-lorebook-deck4",
      "The Coffee Machine",
      "The coffee machine on deck 4 hums at night and makes tea when nobody asked. Mira thinks it is haunted.",
      ["coffee", "machine", "haunted"],
    ),
    entry(
      "demo-entry-medbay",
      "demo-lorebook-deck4",
      "Medbay",
      "Dr. Vale's domain. Always smells of mint. Naps are prescribed often.",
      ["medbay", "vale", "doctor"],
    ),
    entry("demo-entry-k7", "demo-lorebook-deck4", "K-7", "The maintenance robot. Names every light it fixes.", [
      "k-7",
      "robot",
    ]),
    entry(
      "demo-entry-silver",
      "demo-lorebook-hollowmere",
      "The Man in Silver",
      "Lord Ashcombe. Smiles at everyone, owes money to half the court.",
      ["silver", "ashcombe"],
    ),
    entry(
      "demo-entry-masks",
      "demo-lorebook-hollowmere",
      "Masks",
      "At Hollowmere, removing your mask before midnight is an insult.",
      ["mask", "masks"],
    ),
    entry(
      "demo-entry-balcony",
      "demo-lorebook-hollowmere",
      "The East Balcony",
      "Where secrets are traded. The guards are paid to look at the moon.",
      ["balcony"],
    ),
    entry(
      "demo-entry-clock",
      "demo-lorebook-rain",
      "The Clock Tower",
      "Stopped at 3:12. The caretaker was found inside.",
      ["clock", "tower"],
    ),
    entry("demo-entry-umbrella", "demo-lorebook-rain", "The Red Umbrella", "Seen near every crime scene this month.", [
      "umbrella",
      "red",
    ]),
    entry(
      "demo-entry-precinct",
      "demo-lorebook-rain",
      "Precinct 9",
      "Rook's office. The coffee is worse than the crime rate.",
      ["precinct", "office"],
    ),
  ];
  // More personas, so the Personas panel shows switching.
  const persona = (id: string, name: string, description: string, bg: string) => ({
    ...personas[0],
    id,
    name,
    comment: "",
    description,
    avatarPath: portrait(bg, name[0]!),
    isActive: "false",
  });
  const extraPersonas = [
    persona(
      "demo-persona-wren",
      "Wren",
      "A cartographer mapping the coast near Saltmere. Example persona for the demo.",
      "#5b8a6b",
    ),
    persona(
      "demo-persona-ash",
      "Captain Ash",
      "A retired pilot who now runs a cargo ship. Example persona for the demo.",
      "#9a3412",
    ),
    persona("demo-persona-nova", "Nova", "A new crew member on the station. Example persona for the demo.", "#6d28d9"),
  ];
  // Example connections show the list; they have no keys and only the scripted one is used.
  const extraConnections = [
    {
      ...connections[0],
      id: "demo-connection-openrouter",
      name: "Example: OpenRouter (no key)",
      provider: "openrouter",
      model: "",
      isDefault: false,
    },
    {
      ...connections[0],
      id: "demo-connection-local",
      name: "Example: local model (not connected)",
      provider: "custom",
      baseUrl: "http://localhost:11434/v1",
      model: "",
      isDefault: false,
      treatAsLocalEndpoint: true,
    },
  ];
  // Example prompt presets: each prompt is a list of sections, some written text, some markers the Engine fills in.
  const presetList: [string, string, string, [string, string, string][]][] = [
    [
      "demo-preset-storyteller",
      "Storyteller",
      "Rich roleplay with scene detail. The default for these demo chats.",
      [
        [
          "main",
          "Main prompt",
          "You are {{char}}. Stay in character, write in third person and keep each reply to a few paragraphs.",
        ],
        ["character", "Character card", ""],
        ["lorebook", "Lorebook entries", ""],
        ["persona", "Your persona", ""],
        ["style", "Style", "Show feelings through actions. End each reply with something {{user}} can react to."],
        ["chat_history", "Chat history", ""],
      ],
    ],
    [
      "demo-preset-texting",
      "Texting buddy",
      "Short, casual messages for conversation mode.",
      [
        [
          "main",
          "Main prompt",
          "You are {{char}}, texting {{user}}. Keep it short and casual, like a real chat. No narration.",
        ],
        ["character", "Character card", ""],
        ["persona", "Your persona", ""],
        ["chat_history", "Chat history", ""],
      ],
    ],
    [
      "demo-preset-gm",
      "Game master",
      "Runs scenes, rolls and choices for game mode.",
      [
        [
          "main",
          "Main prompt",
          "You are the game master. Describe the scene, ask what {{user}} does and call for a roll when luck matters.",
        ],
        ["lorebook", "Lorebook entries", ""],
        ["rules", "House rules", "Rolls use a d20. 10 or more succeeds. Never decide what {{user}} does."],
        ["chat_history", "Chat history", ""],
      ],
    ],
  ];
  const markers = ["character", "lorebook", "persona", "chat_history"];
  const promptSections = presetList.flatMap(([presetId, , , sections]) =>
    sections.map(([identifier, name, content]) => ({
      id: `${presetId}-${identifier}`,
      presetId,
      identifier,
      name,
      content,
      role: "system",
      enabled: true,
      isMarker: markers.includes(identifier),
      groupId: null,
      markerConfig: markers.includes(identifier) ? { type: identifier } : null,
      injectionPosition: "ordered",
      injectionDepth: 0,
      injectionOrder: 100,
      forbidOverrides: false,
      skipWrap: false,
    })),
  );
  const presets = presetList.map(([id, name, description, sections], i) => ({
    id,
    name,
    description,
    imagePath: null,
    conversationPrompt: "",
    gamePrompt: "",
    sectionOrder: sections.map(([identifier]) => `${id}-${identifier}`),
    groupOrder: [],
    variableGroups: [],
    variableValues: {},
    parameters: DEFAULT_GENERATION_PARAMS,
    wrapFormat: "xml",
    defaultChoices: {},
    isDefault: i === 0,
    author: "Marinara Engine",
    systemKey: "",
    createdAt: NOW,
    updatedAt: NOW,
  }));
  return {
    settings,
    presets,
    promptSections,
    connections: [...connections, ...extraConnections],
    characters: [...characters, ...extraChars],
    personas: [...personas, ...extraPersonas],
    lorebooks: [...lorebooks, ...extraLorebooks],
    lorebookEntries: [...lorebookEntries, ...extraEntries],
    chats: [{ ...chats[0], lastMessageAt: ago(2), updatedAt: ago(2) }, ...extraChats],
    chatFolders,
    messages: [{ ...messages[0], createdAt: ago(2) }, ...extraMessages],
  };
}
