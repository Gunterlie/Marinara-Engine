// Static demo: fixed daily schedules, so conversation status pills and the schedule manager have data.
import {
  CONVERSATION_SCHEDULE_DAYS,
  type ActivityOverview,
  type ConversationPresenceStatus,
  type WeekSchedule,
} from "@marinara-engine/shared";
import { localDayKey } from "../lib/chat-insights-display";

type Block = [time: string, activity: string, status: ConversationPresenceStatus];

const DAYS: Record<string, Block[]> = {
  "demo-character-mira": [
    ["00:00-07:00", "asleep in her bunk", "offline"],
    ["07:00-12:00", "fixing the coffee machine", "online"],
    ["12:00-18:00", "rewiring the deck 4 lights", "dnd"],
    ["18:00-00:00", "reading repair manuals", "idle"],
  ],
  "demo-character-vale": [
    ["00:00-06:00", "asleep, pager on", "offline"],
    ["06:00-13:00", "running crew checkups", "dnd"],
    ["13:00-19:00", "writing up the med log", "online"],
    ["19:00-00:00", "tea and a crossword", "idle"],
  ],
  "demo-character-k7": [
    ["00:00-06:00", "charging", "idle"],
    ["06:00-12:00", "scanning light 14", "online"],
    ["12:00-18:00", "filing repair tickets", "online"],
    ["18:00-00:00", "practising jokes", "idle"],
  ],
  "demo-character-juniper": [
    ["00:00-05:00", "asleep", "offline"],
    ["05:00-11:00", "baking for the morning rush", "dnd"],
    ["11:00-20:00", "serving at the cafe", "online"],
    ["20:00-00:00", "closing the cafe", "idle"],
  ],
  "demo-character-orsolo": [
    ["00:00-05:00", "asleep below deck", "offline"],
    ["05:00-12:00", "mending nets", "online"],
    ["12:00-19:00", "charting the coast", "dnd"],
    ["19:00-00:00", "telling stories in the tavern", "idle"],
  ],
};

function thisMonday(now = new Date()): string {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  return [monday.getFullYear(), monday.getMonth() + 1, monday.getDate()].map((n) => String(n).padStart(2, "0")).join("-");
}

export function demoSchedule(characterId: string): WeekSchedule | null {
  const blocks = DAYS[characterId];
  if (!blocks) return null;
  const day = blocks.map(([time, activity, status]) => ({ time, activity, status }));
  return {
    weekStart: thisMonday(),
    days: Object.fromEntries(CONVERSATION_SCHEDULE_DAYS.map((name) => [name, day])),
    inactivityThresholdMinutes: 0,
    talkativeness: 50,
  };
}

const HOUR = 3_600_000;
const TOP_CHATS = [
  ["demo-chat-mira", "Chat with Mira Voss", "conversation", 412, 9],
  ["demo-chat-kestrel", "The Ember Reach run", "game", 288, 14],
  ["demo-chat-orsolo", "Aboard the Gull's Promise", "roleplay", 236, 11],
  ["demo-chat-crew", "Deck 4 crew", "conversation", 174, 5],
  ["demo-chat-juniper", "Chat with Juniper", "conversation", 96, 3],
] as const;

/** A fixed, believable history for the Activity overview, ending today. */
export function demoActivityOverview(now = new Date()): ActivityOverview {
  const days: Record<string, number> = {};
  for (let i = 0; i < 300; i++) {
    // Deterministic rhythm: no gap in the last 9 days, a quiet day each week, sparse before the last 140 days.
    const active = i < 9 || (i < 140 ? i % 7 !== 3 : i % 4 === 0);
    const count = active ? ((i * 37) % 23) + (i % 7 < 2 ? 18 : 6) : 0;
    if (count) days[localDayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i))] = count;
  }
  const totalMessages = Object.values(days).reduce((a, b) => a + b, 0);
  return {
    generatedAt: now.toISOString(),
    days,
    totalMessages,
    totalWords: totalMessages * 41,
    activeChats: 9,
    activeDays: Object.keys(days).length,
    currentStreakDays: 9,
    longestStreakDays: 23,
    playTime: { totalMs: 61 * HOUR, sittings: 87, longestSittingMs: 3.5 * HOUR, gapMs: 30 * 60_000 },
    topChats: TOP_CHATS.map(([chatId, chatName, chatMode, messages, hours], i) => ({
      chatId,
      chatName,
      chatMode,
      messages,
      playTimeMs: hours * HOUR,
      lastMessageAt: new Date(now.getTime() - (i + 1) * 47 * 60_000).toISOString(),
    })),
    firstMessageAt: new Date(now.getTime() - 299 * 24 * HOUR).toISOString(),
    lastMessageAt: new Date(now.getTime() - 6 * 60_000).toISOString(),
  };
}

/** The block that covers the current local time. */
export function demoStatusNow(characterId: string, now = new Date()) {
  const minutes = now.getHours() * 60 + now.getMinutes();
  const block = DAYS[characterId]?.find(([time]) => {
    const [start, end] = time.split("-").map((t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3)));
    return minutes >= start! && minutes < (end || 1440);
  });
  return block ? { status: block[2], activity: block[1] } : null;
}
