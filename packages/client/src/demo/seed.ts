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
  return { settings, connections, characters, personas, lorebooks, lorebookEntries, chats, messages };
}
