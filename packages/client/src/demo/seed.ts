// Immutable example content. The runtime deep-copies it into per-tab memory.
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
  const extra = [
    [
      "demo-character-mira",
      "Mira Voss",
      "#3b82a6",
      "M",
      "conversation",
      "A sharp, funny station engineer who texts in short bursts. Made up for the demo.",
      "Hey, you up? The coffee machine on deck 4 is haunted again.",
      ["demo", "sci-fi"],
    ],
    [
      "demo-character-orsolo",
      "Captain Orsolo",
      "#a64b3b",
      "O",
      "roleplay",
      "A weathered sea captain with a booming laugh. Made up for the demo.",
      "*Orsolo slaps the map table.* Ye look like someone who needs a ship. Sit, sit!",
      ["demo", "adventure"],
    ],
    [
      "demo-character-kestrel",
      "Kestrel",
      "#6b8f3a",
      "K",
      "game",
      "A dry-witted game master narrating the ember-lit ruins of Ember Reach. Made up for the demo.",
      "The gate groans open. Torchlight shows three paths: a stair down, a bridge, and a door with no handle. What do you do?",
      ["demo", "fantasy"],
    ],
  ] as const;
  const extraChars = extra.map(([id, name, bg, letter, , description, first_mes, tags]) => ({
    ...characters[0],
    id,
    name,
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
  const extraChats = extra.map(([id, name, , , mode, , first_mes]) => ({
    ...chats[0],
    id: id.replace("character", "chat"),
    name:
      mode === "conversation" ? `Chat with ${name}` : mode === "game" ? "The Ember Reach run" : `Aboard with ${name}`,
    mode,
    characterIds: [id],
    metadata: JSON.stringify({}),
    _first: first_mes,
  }));
  const extraMessages = extraChats.map(({ _first, ...c }, i) => ({
    ...messages[0],
    id: `demo-message-extra-${i}`,
    chatId: c.id,
    characterId: c.characterIds[0],
    content: _first,
  }));
  const entry = (id: string, lorebookId: string, name: string, content: string, keys: string[]) => ({
    ...lorebookEntries[0],
    id,
    lorebookId,
    name,
    content,
    keys,
  });
  const extraLorebooks = [
    {
      ...lorebooks[0],
      id: "demo-lorebook-ember",
      name: "Ember Reach",
      description: "Example ruins for the game mode demo.",
    },
    {
      ...lorebooks[0],
      id: "demo-lorebook-deck4",
      name: "Deck 4",
      description: "Example station notes for Mira's chat.",
    },
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
    entry(
      "demo-entry-coffee",
      "demo-lorebook-deck4",
      "The Coffee Machine",
      "The coffee machine on deck 4 hums at night and makes tea when nobody asked. Mira thinks it is haunted.",
      ["coffee", "machine", "haunted"],
    ),
  ];
  // A second persona, so the Personas panel shows switching.
  const extraPersonas = [
    {
      ...personas[0],
      id: "demo-persona-wren",
      name: "Wren",
      comment: "",
      description: "A cartographer mapping the coast near Saltmere. Example persona for the demo.",
      avatarPath: portrait("#5b8a6b", "W"),
      isActive: "false",
    },
  ];
  return {
    settings,
    connections,
    characters: [...characters, ...extraChars],
    personas: [...personas, ...extraPersonas],
    lorebooks: [...lorebooks, ...extraLorebooks],
    lorebookEntries: [...lorebookEntries, ...extraEntries],
    chats: [...chats, ...extraChats.map(({ _first, ...c }) => c)],
    messages: [...messages, ...extraMessages],
  };
}
