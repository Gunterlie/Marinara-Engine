// Feature inventory for the demo website. Every item links to the guide that documents it.
import {
  Bot,
  Database,
  Dices,
  Drama,
  Image,
  MessageCircle,
  Palette,
  Plug,
  ScrollText,
  Server,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";

export type FeatureItem = {
  key: string;
  doc: string;
  section?: string;
  highlight?: boolean;
  demo?: string;
  page?: string;
};
export type FeatureCategory = {
  key: string;
  icon: LucideIcon;
  accent: string;
  image?: { src: string; width: number; height: number };
  items: FeatureItem[];
};

const ROLEPLAY = "oklch(0.72 0.17 303)";
const CYAN = "oklch(0.79 0.16 205)";
const ORANGE = "oklch(0.76 0.19 52)";
const PINK = "oklch(0.73 0.21 345)";
const GREEN = "oklch(0.74 0.17 150)";
const GOLD = "oklch(0.82 0.15 90)";

export const FEATURE_CATEGORIES: FeatureCategory[] = [
  {
    key: "modes",
    icon: Drama,
    accent: ROLEPLAY,
    image: { src: "website/Desktop_Roleplay_View.webp", width: 1600, height: 900 },
    items: [
      { key: "roleplay", doc: "roleplay/getting-started.md", highlight: true, demo: "#/demo" },
      {
        key: "conversation",
        doc: "conversation/getting-started.md",
        highlight: true,
        demo: "#/demo?chat=demo-chat-juniper",
      },
      { key: "game", doc: "game/getting-started.md", highlight: true, demo: "#/demo?chat=demo-chat-kestrel" },
      { key: "groupChats", doc: "chats/group-chats.md", demo: "#/demo?chat=demo-chat-crew" },
      { key: "branches", doc: "chats/branches.md" },
      { key: "connectedChats", doc: "chats/connected-chats.md" },
      { key: "scenes", doc: "roleplay/scenes.md" },
      { key: "guided", doc: "chats/guided-and-impersonate.md" },
      { key: "messages", doc: "chats/messages.md" },
    ],
  },
  {
    key: "characters",
    icon: Users,
    accent: PINK,
    image: { src: "website/Mobile_Group_Conversation.webp", width: 739, height: 1600 },
    items: [
      { key: "cards", doc: "characters/creating-and-editing-characters.md", highlight: true },
      { key: "cardBrowser", doc: "characters/bot-browser.md", highlight: true },
      { key: "sprites", doc: "characters/sprites.md", highlight: true },
      { key: "personas", doc: "characters/personas.md", demo: "#/demo?panel=personas" },
      { key: "importCards", doc: "characters/import-export.md" },
      { key: "galleries", doc: "characters/galleries.md" },
      { key: "animatedExpressions", doc: "media/animated-expressions.md" },
      { key: "avatars", doc: "agents/avatars.md" },
      { key: "colorsStats", doc: "characters/colors-and-stats.md" },
      { key: "library", doc: "characters/library-organization.md" },
    ],
  },
  {
    key: "world",
    icon: ScrollText,
    accent: CYAN,
    image: { src: "website/Desktop_Tracker_Panel.webp", width: 1600, height: 900 },
    items: [
      {
        key: "lorebooks",
        doc: "lorebooks/overview.md",
        highlight: true,
        demo: "#/demo?chat=demo-chat-rook&panel=lorebooks",
      },
      { key: "memory", doc: "agents/memory.md", highlight: true },
      { key: "trackers", doc: "roleplay/hud-and-trackers.md", highlight: true },
      { key: "semanticSearch", doc: "lorebooks/semantic-search.md" },
      { key: "knowledge", doc: "agents/knowledge-sources.md" },
      { key: "worldMaps", doc: "agents/hierarchical-maps.md" },
      { key: "director", doc: "roleplay/narrative-director.md" },
      { key: "encounters", doc: "roleplay/combat-encounters.md" },
    ],
  },
  {
    key: "game",
    icon: Dices,
    accent: ORANGE,
    image: { src: "website/Browser_Game_Screen.webp", width: 1600, height: 900 },
    items: [
      { key: "gameMaster", doc: "game/getting-started.md", highlight: true },
      { key: "combat", doc: "game/combat.md", highlight: true },
      { key: "dice", doc: "game/dice-and-skill-checks.md", highlight: true },
      { key: "map", doc: "game/map-time-weather.md" },
      { key: "party", doc: "game/party-and-npcs.md" },
      { key: "saves", doc: "game/sessions-and-saves.md" },
      { key: "hud", doc: "game/hud-widgets.md" },
      { key: "gameAssets", doc: "game/game-assets.md" },
      { key: "rulesets", doc: "extending/writing-rulesets.md" },
      { key: "storyScripts", doc: "extending/writing-story-scripts.md" },
    ],
  },
  {
    key: "social",
    icon: MessageCircle,
    accent: PINK,
    image: { src: "website/Desktop_DM_Conversation.webp", width: 1600, height: 900 },
    items: [
      { key: "calls", doc: "conversation/calls.md", highlight: true },
      { key: "schedules", doc: "conversation/schedules.md", highlight: true },
      { key: "tableGames", doc: "conversation/table-games.md", highlight: true },
      { key: "noodle", doc: "noodle/overview.md", highlight: true },
      { key: "selfies", doc: "conversation/selfies.md" },
      { key: "emoji", doc: "conversation/emoji-stickers-gifs.md" },
      { key: "profiles", doc: "conversation/profiles.md" },
    ],
  },
  {
    key: "media",
    icon: Image,
    accent: GOLD,
    image: { src: "website/Browser_Game_Dialogue.webp", width: 1600, height: 900 },
    items: [
      { key: "imageGeneration", doc: "media/image-providers.md", highlight: true },
      { key: "tts", doc: "media/tts-setup.md", highlight: true },
      { key: "music", doc: "media/music.md", highlight: true },
      { key: "illustrator", doc: "media/illustrator-agent.md" },
      { key: "sceneBackgrounds", doc: "media/scene-backgrounds.md" },
      { key: "sceneVideo", doc: "media/scene-video.md" },
      { key: "comfyui", doc: "media/comfyui.md" },
      { key: "styleProfiles", doc: "media/style-profiles.md" },
    ],
  },
  {
    key: "agents",
    icon: Bot,
    accent: ROLEPLAY,
    items: [
      { key: "mari", doc: "home/professor-mari.md", highlight: true },
      {
        key: "agents",
        doc: "agents/agents-overview.md",
        highlight: true,
        demo: "#/demo?panel=agents",
        page: "#/features/agents",
      },
      { key: "customAgents", doc: "agents/custom-agents.md", highlight: true },
      { key: "catalog", doc: "agents/built-in-agents.md", page: "#/features/agents" },
      { key: "approvals", doc: "agents/approvals-and-agent-suite.md" },
      { key: "tutorial", doc: "home/tutorial.md" },
      { key: "achievements", doc: "home/achievements.md" },
    ],
  },
  {
    key: "prompts",
    icon: Sparkles,
    accent: CYAN,
    items: [
      { key: "presets", doc: "prompts/presets.md", highlight: true, demo: "#/demo?panel=presets" },
      { key: "peekPrompt", doc: "chats/peek-prompt.md", highlight: true },
      { key: "macros", doc: "prompts/macros.md", highlight: true },
      { key: "conditionals", doc: "prompts/conditional-prompts.md" },
      { key: "slashCommands", doc: "chats/slash-commands.md" },
      { key: "parameters", doc: "prompts/generation-parameters.md" },
      { key: "settingsProfiles", doc: "chats/settings-profiles.md" },
      { key: "promptOverrides", doc: "prompts/prompt-overrides.md" },
    ],
  },
  {
    key: "models",
    icon: Server,
    accent: GREEN,
    items: [
      { key: "providers", doc: "connections/providers-reference.md", highlight: true },
      { key: "subscriptions", doc: "connections/subscription-clis.md", highlight: true },
      { key: "localModels", doc: "connections/local-self-hosted.md", highlight: true },
      { key: "builtinModel", doc: "connections/local-model.md" },
      { key: "decisionModels", doc: "connections/decision-models.md" },
      { key: "organizeConnections", doc: "connections/organizing-connections.md" },
    ],
  },
  {
    key: "look",
    icon: Palette,
    accent: ROLEPLAY,
    image: { src: "website/Desktop_Custom_Theme.webp", width: 1600, height: 777 },
    items: [
      { key: "themes", doc: "appearance/custom-css-themes.md", highlight: true },
      { key: "fonts", doc: "appearance/fonts.md", highlight: true },
      { key: "chatBackgrounds", doc: "appearance/chat-backgrounds.md", highlight: true },
      { key: "cardCss", doc: "appearance/card-css-theming.md" },
      { key: "appearance", doc: "appearance/appearance-settings.md" },
    ],
  },
  {
    key: "data",
    icon: Database,
    accent: GREEN,
    items: [
      { key: "localData", doc: "data/where-data-is-stored.md", highlight: true },
      { key: "backups", doc: "data/backup-and-restore.md", highlight: true },
      { key: "sillyTavern", doc: "data/importing-from-sillytavern.md", highlight: true },
      { key: "encryptedKeys", doc: "FAQ.md", section: "are-my-api-keys-safe" },
      { key: "chatExport", doc: "chats/export-import.md" },
      { key: "platforms", doc: "INSTALLATION.md" },
      { key: "pwa", doc: "installation/ios-pwa.md" },
    ],
  },
  {
    key: "extend",
    icon: Plug,
    accent: ORANGE,
    items: [
      { key: "customTools", doc: "extending/custom-tools.md", highlight: true },
      { key: "translation", doc: "integrations/message-translation.md", highlight: true },
      { key: "homeAssistant", doc: "integrations/home-assistant.md", highlight: true },
      { key: "discord", doc: "integrations/discord-mirror.md" },
      { key: "haptics", doc: "integrations/haptic-feedback.md" },
      { key: "regex", doc: "extending/regex-scripts.md" },
      { key: "extensions", doc: "extending/personal-extensions.md" },
      { key: "creaturePacks", doc: "extending/writing-creature-packs.md" },
      { key: "multiplayer", doc: "CONFIGURATION.md", section: "optional-multiplayer" },
    ],
  },
];

export const FEATURE_COUNT = FEATURE_CATEGORIES.reduce((sum, category) => sum + category.items.length, 0);

/** Agent pages with a hand-written tagline, `demo.agents.tagline.<slug>`. The rest show the first sentence of their guide entry. */
export const AGENT_TAGLINES = [
  "noodle",
  "slurp",
  "gacha-forge",
  "illustrator",
  "lorebook-keeper",
  "long-term-memory",
  "music-dj",
  "narrative-director",
  "world-state",
  "2d-avatars",
  "calls",
  "chess",
];
