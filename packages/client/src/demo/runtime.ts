import {
  APP_VERSION,
  DEFAULT_ADVANCED_MEMORY_SETTINGS,
  DEFAULT_DECISION_CALIBRATION,
  DEFAULT_MARI_PERMISSIONS_MODE,
  DEFAULT_MARI_RUNTIME,
  SIDECAR_DEFAULT_CONFIG,
  DEFAULT_DECISION_PROMPT_QUESTION_LIMIT,
  MAX_DECISION_PROMPT_QUESTION_LIMIT,
  ttsConfigSchema,
  clampParsedDiceToLimits,
  parseDiceNotation,
  rollParsedDice,
  PROFESSOR_MARI_ID,
  mariWorkspaceSessionId,
  type MariDbPendingApproval,
  type MariWorkspaceActionResult,
} from "@marinara-engine/shared";
import { i18n } from "../localization/i18n";
import { UI_PERSISTENCE } from "../lib/ui-persistence";
import { createSeed, DEMO_ASSETS, DEMO_SEED_IDS, DEMO_SPRITES } from "./seed";
import { pickDemoReply } from "./scenarios";
import { MARI_CHARACTER, MARI_ENTRY, MARI_STARTER_CHIPS, MARI_WELCOME, pickMariScript, type MariAction } from "./mari";
import { loadDemoDocs } from "./docs";

// Browser-only stand-in for the Engine backend. It replaces window.fetch, so the real API client,
// direct fetch calls and SSE streaming all run unchanged. State lives in memory, one copy per tab.

type Row = Record<string, any>;
type State = {
  settings: Record<string, string>;
  connections: Row[];
  characters: Row[];
  personas: Row[];
  lorebooks: Row[];
  lorebookEntries: Row[];
  chats: Row[];
  chatFolders: Row[];
  presets: Row[];
  promptSections: Row[];
  gameStates: Row[];
  messages: Row[];
};
type Handler = (m: RegExpMatchArray, url: URL, body: any, signal: AbortSignal | null) => Response | Promise<Response>;

const STORAGE_PREFIX = `marinara-demo:${APP_VERSION}:${import.meta.env.BASE_URL}:`;
const RESET_QUERY_KEY = "marinara-demo-reset";
const TOKEN_DELAY_MS = 35;

let state!: State; // set by installDemoRuntime / resetDemo
let installed = false;
const generations = new Map<string, AbortController>();

// Stands in for the Expression agent: the reply's wording picks the sprite.
const spriteExtra = (characterId: string | null, text: string) => {
  const expression = /grin|smil|laugh|happy|cheer/i.test(text)
    ? "happy"
    : /clench|frown|grim|stern/i.test(text)
      ? "serious"
      : null;
  return characterId && expression && DEMO_SPRITES[characterId]
    ? { spriteExpressions: { [characterId]: expression } }
    : {};
};

// Scripted agent outputs for the Agent Activity list; resultType "sample" skips every real side effect.
const sampleAgentResults = (chatId: string, characterName: string, sprites?: Record<string, string>) => {
  // Only the chats with trackers (Iris, Ember Reach) have a quest to report.
  const quest = state.gameStates.find((g) => g.chatId === chatId)?.playerStats?.activeQuests?.[0]?.name;
  if (!quest) return [];
  const results: [string, string, Row][] = [
    [
      "expression",
      "Expression Engine",
      { expressions: [{ characterName, expression: Object.values(sprites ?? {})[0] ?? "neutral" }] },
    ],
    ["quest", "Quest Tracker", { updates: [{ action: "update", questName: quest }] }],
    [
      "lorebook-keeper",
      "Lorebook Keeper",
      {
        updates: [{ action: "create", entryName: chatId === "demo-chat-iris" ? "Lamp keeper's log" : "The open gate" }],
      },
    ],
    ["illustrator", "Illustrator", { generated: true, chosen: "scene", reason: "Scene image for this reply" }],
  ];
  return results.map(([agentType, agentName, data]) => ({
    chatId,
    agentType,
    agentName: `${agentName} (sample)`,
    resultType: "sample",
    data,
    success: true,
    durationMs: 900,
    tokensUsed: 0,
  }));
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const notFound = () => json({ error: "Not found" }, 404);
const uid = (p: string) => `${p}-${crypto.randomUUID()}`;
const nowIso = () => new Date().toISOString();

function page<T>(items: T[], url: URL) {
  const limit = Number(url.searchParams.get("limit"));
  if (!limit) return items;
  const offset = Number(url.searchParams.get("offset")) || 0;
  return { items: items.slice(offset, offset + limit), limit, offset, hasMore: offset + limit < items.length };
}

function parseData(row: Row): Row {
  try {
    return JSON.parse(row.data);
  } catch {
    return {};
  }
}

/** Merge a PATCH body into a row; character `data` is a JSON string that merges key by key. */
function patchRow(row: Row, body: Row): Row {
  const { data, ...rest } = body ?? {};
  Object.assign(row, rest, { updatedAt: nowIso() });
  if (data !== undefined) {
    const merged = { ...parseData(row), ...(typeof data === "string" ? JSON.parse(data) : data) };
    row.data = JSON.stringify(merged);
    if (typeof merged.name === "string") row.name = merged.name;
  }
  return row;
}

function byId(list: Row[], id: string): Row | undefined {
  return list.find((r) => r.id === id);
}

function remove(list: Row[], id: string): boolean {
  const i = list.findIndex((r) => r.id === id);
  if (i < 0) return false;
  list.splice(i, 1);
  return true;
}

// --- Generation: scripted SSE stream -------------------------------------------------------------

function generate(body: Row, signal: AbortSignal | null): Response {
  const chatId = String(body.chatId ?? "");
  const chat = byId(state.chats, chatId);
  if (!chat) return json({ error: "Chat not found" }, 404);
  generations.get(chatId)?.abort(); // a newer request supersedes an older one
  const run = new AbortController();
  generations.set(chatId, run);
  const stale = () => run.signal.aborted || signal?.aborted === true || byId(state.chats, chatId) !== chat;

  const regenerateId = typeof body.regenerateMessageId === "string" ? body.regenerateMessageId : null;
  const userText = typeof body.userMessage === "string" ? body.userMessage.trim() : "";
  const characterId = (chat.characterIds as string[])[0] ?? null;
  const characterName = characterId ? String(byId(state.characters, characterId)?.name ?? "Character") : "Character";

  if (userText && !regenerateId) {
    state.messages.push({
      id: uid("demo-message"),
      chatId,
      role: "user",
      characterId: null,
      content: userText,
      activeSwipeIndex: 0,
      swipeCount: 0,
      createdAt: nowIso(),
      extra: {},
    });
  }
  const lastUser = [...state.messages].reverse().find((m) => m.chatId === chatId && m.role === "user");
  const reply = pickDemoReply(userText || lastUser?.content || "", characterId);

  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const sendEvent = (event: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      const send = (type: string, data?: unknown) => sendEvent({ type, data });
      // Images and *italic* runs arrive whole, so half-typed markdown never shows.
      const words = reply.match(/!\[[^\]]*\]\([^)]*\)\s*|\*[^*\n]+\*\S*\s*|\S+\s*/g) ?? [reply];
      let i = 0;
      const finish = () => {
        if (generations.get(chatId) === run) generations.delete(chatId);
        try {
          controller.close();
        } catch {
          /* already cancelled */
        }
      };
      const tick = () => {
        if (stale()) return finish();
        if (i < words.length) {
          send("token", words[i++]);
          timer = setTimeout(tick, TOKEN_DELAY_MS);
          return;
        }
        let saved = regenerateId ? byId(state.messages, regenerateId) : undefined;
        if (saved) saved.content = reply;
        else {
          saved = {
            id: uid("demo-message"),
            chatId,
            role: "assistant",
            characterId,
            content: reply,
            activeSwipeIndex: 0,
            swipeCount: 0,
            createdAt: nowIso(),
            extra: spriteExtra(characterId, reply),
          };
          state.messages.push(saved);
        }
        chat.lastMessageAt = chat.updatedAt = nowIso();
        send("message_saved", saved);
        // Only Roleplay mode has an Agent Activity list to show them.
        if (chat.mode === "roleplay")
          for (const data of sampleAgentResults(chatId, characterName, saved.extra?.spriteExpressions))
            send("agent_result", data);
        send("done");
        finish();
      };
      sendEvent({ type: "typing", characters: [characterName] });
      timer = setTimeout(tick, 400);
    },
    cancel() {
      run.abort();
      clearTimeout(timer);
      if (generations.get(chatId) === run) generations.delete(chatId);
    },
  });
  signal?.addEventListener("abort", () => run.abort(), { once: true });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
}

// --- Professor Mari: prewritten answers, real change cards ----------------------

const MARI_CHAT_ID = "demo-mari-chat";
let mariPending: MariDbPendingApproval[] = [];
const mariUndo = new Map<string, () => void>();

const mariMessage = (role: "user" | "assistant", content: string, extra: Row = {}): Row => ({
  id: uid("demo-message"),
  chatId: MARI_CHAT_ID,
  role,
  characterId: role === "assistant" ? PROFESSOR_MARI_ID : null,
  content,
  activeSwipeIndex: 0,
  swipeCount: 0,
  createdAt: nowIso(),
  extra,
});

function mariChat(): Row {
  let chat = byId(state.chats, MARI_CHAT_ID);
  if (chat) return chat;
  const now = nowIso();
  chat = {
    id: MARI_CHAT_ID,
    name: "Professor Mari",
    mode: "conversation",
    characterIds: [PROFESSOR_MARI_ID],
    groupId: null,
    personaId: null,
    promptPresetId: null,
    connectionId: DEMO_SEED_IDS.connectionId,
    connectedChatId: null,
    folderId: null,
    sortOrder: 0,
    lastMessageAt: now,
    createdAt: now,
    updatedAt: now,
    metadata: { professorMariActive: true },
  };
  state.chats.push(chat);
  state.messages.push(mariMessage("assistant", MARI_WELCOME, { mariSuggestions: MARI_STARTER_CHIPS }));
  return chat;
}

/** Makes the change for real (so Undo has something to remove) and returns its card. */
function mariApply(action: MariAction): MariWorkspaceActionResult {
  const id = uid("demo-review");
  const now = nowIso();
  const undoUntil = new Date(Date.now() + 86_400_000).toISOString();
  let row: Row, list: Row[], table: string, result: Omit<MariWorkspaceActionResult, "reviewIds">;
  if (action === "character") {
    row = {
      id: uid("demo-character"),
      data: JSON.stringify(MARI_CHARACTER),
      comment: "",
      avatarPath: null,
      name: MARI_CHARACTER.name,
      favorite: false,
      createdAt: now,
      updatedAt: now,
    };
    [list, table] = [state.characters, "characters"];
    result = {
      status: "created",
      resource: { kind: "character", id: row.id, label: MARI_CHARACTER.name },
      changedFields: ["name", "description", "personality", "first_mes"],
      summary: `Created ${MARI_CHARACTER.name}`,
      reason: "You asked for a cozy café character.",
      changes: (["description", "personality", "first_mes"] as const).map((field) => ({
        field,
        kind: "text" as const,
        before: "",
        after: MARI_CHARACTER[field],
      })),
    };
  } else {
    const template = state.lorebookEntries.find((e) => e.lorebookId === DEMO_SEED_IDS.lorebookId) ?? {};
    row = {
      ...template,
      id: uid("demo-entry"),
      lorebookId: DEMO_SEED_IDS.lorebookId,
      name: MARI_ENTRY.name,
      content: MARI_ENTRY.content,
      keys: MARI_ENTRY.keys,
      createdAt: now,
      updatedAt: now,
    };
    [list, table] = [state.lorebookEntries, "lorebook_entries"];
    result = {
      status: "updated",
      resource: {
        kind: "lorebook",
        id: DEMO_SEED_IDS.lorebookId,
        label: byId(state.lorebooks, DEMO_SEED_IDS.lorebookId)?.name ?? "Lorebook",
      },
      changedFields: ["entries"],
      summary: `Added ${MARI_ENTRY.name}`,
      reason: "You asked for an entry about the lighthouse.",
      changes: [
        {
          field: "entries",
          kind: "list",
          added: [MARI_ENTRY.name],
          edited: [],
          removed: [],
          count: { added: 1, edited: 0, removed: 0 },
          items: [{ name: MARI_ENTRY.name, keys: MARI_ENTRY.keys, text: MARI_ENTRY.content }],
        },
      ],
    };
  }
  list.push(row);
  mariUndo.set(id, () => remove(list, row.id));
  mariPending.push({
    kind: "applied_review",
    id,
    sessionId: mariWorkspaceSessionId(MARI_CHAT_ID),
    command: `${table}.insert`,
    reason: result.reason ?? null,
    operationHash: id,
    requestedAt: now,
    expiresAt: undoUntil,
    affectedTables: { [table]: 1 },
    affectedRows: 1,
    validationStatus: "passed",
    diffPreview: [{ table, id: row.id, action: "insert", before: null, after: row }],
    diffTruncated: false,
  });
  return { ...result, reviewIds: [id], undoUntil };
}

/** Keep or Undo: settle the review and write the outcome onto the card, as the Engine does. */
function mariAnswer(id: string, outcome: "kept" | "undone"): Response {
  const approval = mariPending.find((a) => a.id === id);
  if (!approval) return json({ ok: false, outcome: "state_changed" });
  mariPending = mariPending.filter((a) => a.id !== id);
  if (outcome === "undone") mariUndo.get(id)?.();
  mariUndo.delete(id);
  for (const message of state.messages) {
    const results = message.extra?.mariWorkspaceActionResults as MariWorkspaceActionResult[] | undefined;
    for (const result of results ?? []) if (result.reviewIds?.includes(id)) result.outcome = outcome;
  }
  const status = outcome === "kept" ? "kept" : "restored";
  return json({
    ok: true,
    completed: true,
    approval,
    history: { ...approval, status, createdAt: approval.requestedAt, completedAt: nowIso() },
  });
}

function mariPrompt(body: Row, signal: AbortSignal | null): Response {
  const chat = mariChat();
  const text = String(body.message ?? "").trim();
  if (text && !body.existingUserMessageId) state.messages.push(mariMessage("user", text));
  const script = pickMariScript(text);
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let result: MariWorkspaceActionResult | null = null;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (type: string, data?: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, data })}\n\n`));
      const steps: (() => void)[] = [() => send("status", "Reading your request…")];
      const action = script.action;
      if (action) {
        const tool = {
          id: uid("demo-tool"),
          name: "app_data",
          input: action === "character" ? "Create a character" : "Add a lorebook entry",
        };
        steps.push(
          () => send("tool_start", tool),
          () => {
            result = mariApply(action);
            send("tool_end", { ...tool, output: result.summary, isError: false, durationMs: 420 });
          },
        );
      }
      for (const word of script.reply.match(/\S+\s*/g) ?? [script.reply]) steps.push(() => send("token", word));
      steps.push(() => {
        const extra: Row = { mariSuggestions: script.chips };
        if (result) {
          extra.mariWorkspaceActionResults = [result];
          send("metadata", { actionResult: result });
        }
        send("suggestions", script.chips);
        state.messages.push(mariMessage("assistant", script.reply, extra));
        chat.lastMessageAt = chat.updatedAt = nowIso();
        send("done");
        controller.close();
      });
      let i = 0;
      const tick = () => {
        if (signal?.aborted) return;
        steps[i++]!();
        if (i < steps.length) timer = setTimeout(tick, i <= 3 ? 400 : TOKEN_DELAY_MS);
      };
      tick();
    },
    cancel() {
      clearTimeout(timer);
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
}

// --- Routes --------------------------------------------------------------------------------------

const routes: [string, RegExp, Handler][] = [];
const on = (method: string, path: string, handler: Handler) =>
  routes.push([method, new RegExp(`^${path.replace(/:\w+/g, "([^/]+)")}$`), handler]);

function registerRoutes() {
  on("GET", "/docs/language", async () => {
    const docs = await loadDemoDocs();
    return json({
      active: "en",
      configured: true,
      install: null,
      available: [
        {
          code: "en",
          label: "English",
          englishLabel: "English",
          installed: true,
          translated: docs.length,
          total: docs.length,
        },
      ],
      integrity: {
        ok: true,
        unknownLanguage: false,
        activeRootMissing: false,
        packIncomplete: false,
        leftovers: false,
      },
    });
  });
  on("GET", "/docs", async () =>
    json({ root: "docs", language: "en", docs: (await loadDemoDocs()).map(({ content: _content, ...doc }) => doc) }),
  );
  on("GET", "/docs/content", async (_m, url) => {
    const doc = (await loadDemoDocs()).find((row) => row.path === url.searchParams.get("path"));
    return doc ? json(doc) : notFound();
  });
  on("GET", "/docs/search", async (_m, url) => {
    const query = (url.searchParams.get("q") ?? "").trim().slice(0, 200);
    const needle = query.toLowerCase();
    const results =
      needle.length < 2
        ? []
        : (await loadDemoDocs()).flatMap(({ content, ...doc }) => {
            const snippets = content
              .split("\n")
              .flatMap((text, i) => (text.toLowerCase().includes(needle) ? [{ line: i + 1, text }] : []));
            return snippets.length || doc.title.toLowerCase().includes(needle)
              ? [{ ...doc, matches: snippets.length, snippets: snippets.slice(0, 3) }]
              : [];
          });
    return json({ query, language: "en", results });
  });
  on("GET", "/updates/channel", () => json({ channel: "stable" }));
  on("GET", "/capability-packages/catalog", () => json({ schemaVersion: 1, generatedAt: nowIso(), packages: [] }));
  on("GET", "/characters/catalog", (_m, url) => {
    const search = (url.searchParams.get("search") ?? "").toLowerCase();
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit")) || 100));
    const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
    const items = state.characters
      .filter((row) => row.name.toLowerCase().includes(search))
      .map((row) => {
        const data = parseData(row);
        return {
          ...row,
          creator: data.creator ?? "",
          version: data.character_version ?? "",
          tags: data.tags ?? [],
          summary: data.description ?? "",
          explicitSummary: "",
          description: data.description ?? "",
          personality: data.personality ?? "",
          scenario: data.scenario ?? "",
          firstMessage: data.first_mes ?? "",
          creatorNotes: data.creator_notes ?? "",
          tokenEstimate: 0,
          nameColor: null,
          avatarCrop: null,
        };
      });
    return json({
      items: items.slice(offset, offset + limit),
      limit,
      offset,
      hasMore: offset + limit < items.length,
      catalogGeneration: 1,
    });
  });
  on("GET", "/health", () => json({ status: "ok", demo: true }));
  on("POST", "/generate", (_m, _u, body, signal) => generate(body, signal));
  on("GET", "/generate/status/:id", () => json({ active: false, translating: false }));

  // Characters (personas first: "/characters/personas/..." must not match "/characters/:id").
  // Mounted-shell endpoints: the smallest honest answers (empty or unset), shaped like the real server.
  on("GET", "/app-settings/:key", (m) => json({ value: state.settings[decodeURIComponent(m[1]!)] ?? null }));
  on("PUT", "/app-settings/:key", (m, _u, b) => {
    const value = typeof b?.value === "string" ? b.value : null;
    if (value === null) return json({ error: "Invalid value" }, 400);
    state.settings[decodeURIComponent(m[1]!)] = value;
    return json({ value });
  });
  on("GET", "/fonts", () => json([]));
  on("GET", "/themes", () => json([]));
  on("PUT", "/themes/active", () => json(null));
  on("GET", "/capability-packages/installed", () => json([]));
  on("GET", "/capability-packages/updates/pending", () => json([]));
  on("GET", "/capability-packages/rulesets", () => json([]));
  on("GET", "/chats/autonomous-candidates", () => json([]));
  on("GET", "/chats/home-feed", () =>
    json({
      generatedAt: nowIso(),
      recentChats: state.chats
        .filter((c) => c.id !== MARI_CHAT_ID)
        .filter((c) => c.lastMessageAt)
        .sort((a, b) => String(b.lastMessageAt).localeCompare(String(a.lastMessageAt)))
        .slice(0, 8)
        .map((chat) => {
          const last = [...state.messages].reverse().find((x) => x.chatId === chat.id);
          return {
            chat: {
              id: chat.id,
              name: chat.name,
              mode: chat.mode,
              groupId: chat.groupId,
              characterIds: chat.characterIds,
              background: null,
              gameBackgroundTag: null,
              spriteCharacterIds: [],
              spriteDisplayModes: [],
              spriteExpressions: {},
              createdAt: chat.createdAt,
              updatedAt: chat.updatedAt,
              lastMessageAt: chat.lastMessageAt,
            },
            latestMessage: last
              ? {
                  id: last.id,
                  role: last.role,
                  characterId: last.characterId,
                  content: last.content,
                  createdAt: last.createdAt,
                }
              : null,
          };
        }),
    }),
  );
  on("POST", "/connections/refresh-local-context", () => json({ updated: [] }));
  on("GET", "/connections", () => json(state.connections));
  on("GET", "/connections/:id", (m) =>
    json(byId(state.connections, m[1]!) ?? { error: "Not found" }, byId(state.connections, m[1]!) ? 200 : 404),
  );
  on("GET", "/backgrounds", () => json([]));
  on("GET", "/characters", (_m, u) => json(page(state.characters, u)));
  on("POST", "/characters/summaries", (_m, _u, b) =>
    json(
      state.characters
        .filter((c) => (b?.ids as string[] | undefined)?.includes(c.id))
        .map((c) => ({ id: c.id, name: c.name, avatarUrl: c.avatarPath, avatarCrop: null })),
    ),
  );
  on("GET", "/characters/personas/list", (_m, u) => json(page(state.personas, u)));
  on("GET", "/characters/personas/active", () => json(state.personas.find((p) => p.isActive === "true") ?? null));
  on("GET", "/characters/personas", () => json(state.personas));
  on("POST", "/characters/personas", (_m, _u, b) => {
    const row = {
      id: uid("demo-persona"),
      name: "New persona",
      comment: "",
      description: "",
      personality: "",
      scenario: "",
      backstory: "",
      appearance: "",
      avatarPath: null,
      isActive: "false",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      ...b,
    };
    state.personas.push(row);
    return json(row);
  });
  on("PUT", "/characters/personas/:id", (m, _u, b) => {
    const row = byId(state.personas, m[1]!);
    return row ? json(patchRow(row, b)) : notFound();
  });
  on("PUT", "/characters/personas/:id/activate", (m) => {
    const row = byId(state.personas, m[1]!);
    if (!row) return notFound();
    state.personas.forEach((p) => (p.isActive = p === row ? "true" : "false"));
    return json(row);
  });
  on("DELETE", "/characters/personas/:id", (m) =>
    remove(state.personas, m[1]!) ? json({ success: true }) : notFound(),
  );
  on("GET", "/notices", () => json({ notices: [] }));
  on("GET", "/notification-sound", () => json({ configured: false, url: null, updatedAt: null }));
  on("GET", "/csrf/origin-status", () =>
    json({ trusted: true, origin: window.location.origin, source: "demo", code: null, hint: null }),
  );
  on("GET", "/personal-extensions/runtime/client", () => json([]));
  on("POST", "/achievements/track", () => json({ newlyUnlocked: [] }));
  on("GET", "/achievements", () => json({ definitions: [], progress: [], unlockedCount: 0, totalCount: 0 }));
  on("GET", "/game-assets/manifest", () => json({ scannedAt: nowIso(), count: 0, assets: {}, byCategory: {} }));
  on("GET", "/custom-tools/capabilities", () => json({ scriptExecutionEnabled: false }));
  on("GET", "/prompts", () => json(state.presets));
  on("GET", "/prompts/default", () => json(state.presets.find((p) => p.isDefault) ?? null));
  on("GET", "/prompts/:id/full", (m) => {
    const preset = byId(state.presets, m[1]!);
    if (!preset) return notFound();
    const sections = state.promptSections.filter((x) => x.presetId === preset.id);
    return json({ preset, sections, groups: [], choiceBlocks: [] });
  });
  on("PATCH", "/prompts/:id", (m, _u, b) => {
    const row = byId(state.presets, m[1]!);
    return row ? json(patchRow(row, b)) : notFound();
  });
  on("PATCH", "/prompts/:id/sections/:sid", (m, _u, b) => {
    const row = byId(state.promptSections, m[2]!);
    return row ? json(patchRow(row, b)) : notFound();
  });
  on("GET", "/chat-folders", () => json(state.chatFolders));
  on("GET", "/library-folders/:scope", () => json([]));
  // Status reads for panels that ask a real server; the demo answers "off" so they render without errors.
  on("GET", "/access/status", () =>
    json({
      loopbackOnly: true,
      host: "127.0.0.1",
      basicAuth: false,
      adminSecret: false,
      allowlist: false,
      passwordlessPeers: [],
      loginKeepsOpen: [],
      viaProxy: false,
    }),
  );
  // The local model, Professor Mari's workspace and the decision model need a server, so they report "not set up".
  on("GET", "/sidecar/status", () =>
    json({
      status: "not_downloaded",
      config: SIDECAR_DEFAULT_CONFIG,
      modelDownloaded: false,
      modelDisplayName: null,
      modelSize: null,
      runtime: { installed: false, build: null, variant: null, backend: null },
      logPath: null,
      platform: "browser",
      arch: "",
      curatedModels: [],
      inferenceReady: false,
      gpuMemory: null,
      startupError: null,
      failedRuntimeVariant: null,
    }),
  );
  // Professor Mari: the real pane, fed with prewritten answers from ./mari.
  on("GET", "/chats/internal/professor-mari", () => json(mariChat()));
  on("POST", "/chats/internal/professor-mari/restart", () => json(mariChat()));
  on("GET", "/chats/internal/professor-mari/chats", () =>
    json([{ ...mariChat(), messageCount: state.messages.filter((m) => m.chatId === MARI_CHAT_ID).length }]),
  );
  on("POST", "/chats/internal/professor-mari/chats/:id/activate", () => json(mariChat()));
  on("PATCH", "/chats/internal/professor-mari/chats/:id", (_m, _u, b) => json(patchRow(mariChat(), b)));
  on("GET", "/professor-mari/workspace/status", () => {
    const connection = byId(state.connections, DEMO_SEED_IDS.connectionId);
    return json({
      enabled: true,
      piAvailable: false,
      workspace: "",
      dataDir: "",
      tools: [],
      shellSandbox: { available: false, backend: null },
      dbAccess: "server-managed",
      connection: connection
        ? {
            id: connection.id,
            name: connection.name,
            provider: connection.provider,
            model: connection.model,
            maxContext: 0,
          }
        : null,
      skills: [],
      skillDiagnostics: [],
      active: false,
      permissionsMode: DEFAULT_MARI_PERMISSIONS_MODE,
      permissionsModeDefault: DEFAULT_MARI_PERMISSIONS_MODE,
      permissionsModeSource: "default",
      runtimeSelected: DEFAULT_MARI_RUNTIME,
      runtimeActive: DEFAULT_MARI_RUNTIME,
      runtimeNote: null,
      latestUnderstoodRequest: null,
      pendingApprovals: mariPending,
      history: [],
      latestRun: null,
      error: null,
    });
  });
  on("GET", "/professor-mari/workspace/skills", () => json({ skills: [], diagnostics: [] }));
  on("GET", "/professor-mari/workspace/instructions", () => json({ instructions: [] }));
  on("GET", "/professor-mari/workspace/context", () => json({ context: [] }));
  on("PUT", "/professor-mari/workspace/permissions-mode", () => json({ ok: true }));
  on("PUT", "/professor-mari/workspace/runtime", () => json({ ok: true }));
  on("POST", "/professor-mari/workspace/abort", () => json({ ok: true }));
  on("POST", "/professor-mari/workspace/reset", () => {
    state.messages = state.messages.filter((m) => m.chatId !== MARI_CHAT_ID);
    remove(state.chats, MARI_CHAT_ID);
    mariChat();
    return json({ ok: true });
  });
  on("POST", "/professor-mari/workspace/prompt", (_m, _u, b, signal) => mariPrompt(b ?? {}, signal));
  on("POST", "/professor-mari/workspace/approvals/:id/approve", (m) => mariAnswer(m[1]!, "kept"));
  on("POST", "/professor-mari/workspace/approvals/:id/reject", (m) => mariAnswer(m[1]!, "undone"));
  on("GET", "/decision/options", () =>
    json({ selected: null, options: [], calibration: DEFAULT_DECISION_CALIBRATION }),
  );
  on("GET", "/spotify/playlists", () => json({ playlists: [] }));
  on("GET", "/agents/import-policy", () => json({ enabled: false }));
  on("GET", "/agents/runs/:id/custom", () => json([]));
  on("POST", "/game/weather/update", () => json({ changed: false, weather: null }));
  // Same steps as the server's dice route: parse, clamp to the caps, roll.
  on("POST", "/game/dice/roll", (_m, _u, b) => {
    const parsed = parseDiceNotation(String(b?.notation ?? ""));
    return parsed
      ? json({ result: rollParsedDice(clampParsedDiceToLimits(parsed)) })
      : json({ error: "Invalid dice notation" }, 400);
  });
  on("GET", "/game-tile-packs", () => json({ packs: [], builtIn: [], selection: {} }));
  for (const path of [
    "/characters/:id/gallery",
    "/characters/personas/:id/gallery",
    "/custom-emojis",
    "/custom-stickers",
    "/connection-folders",
  ])
    on("GET", path, () => json([]));
  on("GET", "/ui-languages", () => json({ installed: [] }));
  on("GET", "/conversation/status/:id", () => json({ statuses: {} }));
  on("GET", "/decision/thinking-pregeneration", () => json({ enabled: false }));
  on("GET", "/decision/smart-order", () => json({ enabled: false }));
  on("GET", "/decision/prompt-question-limit", () =>
    json({
      limit: DEFAULT_DECISION_PROMPT_QUESTION_LIMIT,
      defaultLimit: DEFAULT_DECISION_PROMPT_QUESTION_LIMIT,
      maxLimit: MAX_DECISION_PROMPT_QUESTION_LIMIT,
    }),
  );
  on("GET", "/game/scene-videos/:id", () => json({ videos: [] }));
  on("GET", "/game/storyboards/:id", () => json({ storyboards: [] }));
  on("GET", "/chats/:id/game-state", (m) => json(state.gameStates.find((g) => g.chatId === m[1]) ?? null));
  // The game screen logs each new location to its journal; the demo keeps no journal.
  on("POST", "/game/journal/entry", () => json({ ok: true }));
  on("GET", "/tts/config", () => json(ttsConfigSchema.parse({})));
  on("GET", "/chats/:id/advanced-memory", () =>
    json({
      settings: DEFAULT_ADVANCED_MEMORY_SETTINGS,
      job: { status: "idle", stage: "idle", completed: 0, total: 0, error: null },
      missingKnowledgeCharacterIds: [],
      records: [],
      helperModel: null,
      summaryModel: null,
      warnings: [],
    }),
  );
  for (const path of [
    "/chat-presets",
    "/regex-scripts",
    "/custom-tools",
    "/agents",
    "/characters/groups/list",
    "/characters/persona-groups/list",
  ]) {
    on("GET", path, () => json([]));
  }
  // Example agents so the Agents panel shows what an installed library looks like.
  on("GET", "/capability-packages/agents", () =>
    json([
      {
        id: "lorebook-keeper",
        name: "Lorebook Keeper",
        description: "Writes new places, people and facts from the story into your lorebook.",
        phase: "post_processing",
        enabledByDefault: true,
        category: "writer",
      },
      {
        id: "illustrator",
        name: "Illustrator",
        description: "Draws a picture of the scene when something worth seeing happens.",
        phase: "post_processing",
        enabledByDefault: false,
        category: "misc",
      },
      {
        id: "music-dj",
        name: "Music DJ",
        description: "Picks music that fits the mood and changes it when the scene turns.",
        phase: "parallel",
        enabledByDefault: false,
        category: "misc",
      },
      {
        id: "world-state",
        name: "World State",
        description: "Keeps track of time, weather and location so the story stays consistent.",
        phase: "post_processing",
        enabledByDefault: true,
        category: "tracker",
      },
      {
        id: "character-tracker",
        name: "Character Tracker",
        description: "Notes who is in the scene, their mood and what they are thinking.",
        phase: "post_processing",
        enabledByDefault: true,
        category: "tracker",
      },
      {
        id: "quest",
        name: "Quest Tracker",
        description: "Keeps your goals and their steps in a list you can check off.",
        phase: "post_processing",
        enabledByDefault: true,
        category: "tracker",
      },
      {
        id: "expression",
        name: "Expression Engine",
        description: "Changes a character's sprite to match the mood of each reply.",
        phase: "post_processing",
        enabledByDefault: true,
        category: "misc",
      },
    ]),
  );
  // Full-body sprites use the Engine's "full_" expression prefix.
  on("GET", "/sprites/:id", (m) => {
    const sprites = DEMO_SPRITES[m[1]!];
    return json(
      (sprites?.expressions ?? []).map((expression) => ({
        expression: `full_${expression}`,
        filename: `${expression}.webp`,
        url: `${import.meta.env.BASE_URL}demo-assets/sprites/${sprites!.slug}/${expression}.webp`,
      })),
    );
  });
  on("POST", "/chats/:id/touch", (m) => json(byId(state.chats, m[1]!) ?? { success: true }));
  on("GET", "/characters/personas/:id", (m) =>
    json(byId(state.personas, m[1]!) ?? { error: "Not found" }, byId(state.personas, m[1]!) ? 200 : 404),
  );
  on("GET", "/characters/:id", (m) =>
    json(byId(state.characters, m[1]!) ?? null, byId(state.characters, m[1]!) ? 200 : 404),
  );
  on("POST", "/characters", (_m, _u, b) => {
    const data = typeof b?.data === "string" ? JSON.parse(b.data) : (b?.data ?? {});
    const row = {
      id: uid("demo-character"),
      data: JSON.stringify(data),
      comment: "",
      avatarPath: null,
      name: data.name ?? "New character",
      favorite: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    state.characters.push(row);
    return json(row);
  });
  on("PATCH", "/characters/:id", (m, _u, b) => {
    const row = byId(state.characters, m[1]!);
    return row ? json(patchRow(row, b)) : notFound();
  });
  on("DELETE", "/characters/:id", (m) => (remove(state.characters, m[1]!) ? json({ success: true }) : notFound()));

  // Chats and messages.
  on("GET", "/chats", () => json(state.chats.filter((c) => c.id !== MARI_CHAT_ID)));
  on("GET", "/chats/:id", (m) =>
    json(byId(state.chats, m[1]!) ?? { error: "Chat not found" }, byId(state.chats, m[1]!) ? 200 : 404),
  );
  on("POST", "/chats", (_m, _u, b) => {
    const row = {
      id: uid("demo-chat"),
      name: "New chat",
      mode: "roleplay",
      characterIds: [],
      groupId: null,
      personaId: null,
      promptPresetId: null,
      connectionId: null,
      connectedChatId: null,
      folderId: null,
      sortOrder: 0,
      lastMessageAt: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      metadata: {},
      ...b,
    };
    state.chats.push(row);
    // Like the real server, a new chat opens with the character's first message.
    const character = byId(state.characters, row.characterIds[0] ?? "");
    const greeting = character ? parseData(character).first_mes : "";
    if (greeting) {
      state.messages.push({
        id: uid("demo-message"),
        chatId: row.id,
        role: "assistant",
        characterId: character!.id,
        content: greeting,
        activeSwipeIndex: 0,
        swipeCount: 0,
        createdAt: nowIso(),
        extra: {},
      });
      row.lastMessageAt = nowIso();
    }
    return json(row);
  });
  on("PATCH", "/chats/:id", (m, _u, b) => {
    const row = byId(state.chats, m[1]!);
    return row ? json(patchRow(row, b)) : notFound();
  });
  on("PATCH", "/chats/:id/metadata", (m, _u, b) => {
    const row = byId(state.chats, m[1]!);
    if (!row) return notFound();
    row.metadata = { ...row.metadata, ...b };
    return json(row);
  });
  on("DELETE", "/chats/:id", (m) => {
    const id = m[1]!;
    generations.get(id)?.abort();
    state.messages = state.messages.filter((x) => x.chatId !== id);
    return remove(state.chats, id) ? json({ success: true }) : notFound();
  });
  on("GET", "/chats/:id/messages", (m, u) => {
    const all = state.messages
      .filter((x) => x.chatId === m[1])
      .sort((a, b) => `${a.createdAt}|${a.id}`.localeCompare(`${b.createdAt}|${b.id}`));
    const before = u.searchParams.get("before"); // "createdAt|id" of the oldest message already loaded
    const older = before ? all.filter((x) => `${x.createdAt}|${x.id}` < before) : all;
    const limit = Number(u.searchParams.get("limit"));
    return json(limit ? older.slice(-limit) : older);
  });
  on("GET", "/chats/:id/message-count", (m) => json({ count: state.messages.filter((x) => x.chatId === m[1]).length }));
  on("POST", "/chats/:id/messages", (m, _u, b) => {
    const row = {
      id: uid("demo-message"),
      chatId: m[1],
      role: "user",
      characterId: null,
      content: "",
      activeSwipeIndex: 0,
      swipeCount: 0,
      createdAt: nowIso(),
      extra: {},
      ...b,
    };
    state.messages.push(row);
    return json(row);
  });
  on("PATCH", "/chats/:id/messages/:mid", (m, _u, b) => {
    const row = byId(state.messages, m[2]!);
    return row ? json(patchRow(row, b)) : notFound();
  });
  on("PATCH", "/chats/:id/messages/:mid/extra", (m, _u, b) => {
    const row = byId(state.messages, m[2]!);
    if (!row) return notFound();
    row.extra = { ...row.extra, ...b };
    return json(row);
  });
  on("DELETE", "/chats/:id/messages/:mid", (m) =>
    remove(state.messages, m[2]!) ? json({ trashed: false, trashedCount: 0 }) : notFound(),
  );

  // Lorebooks.
  on("GET", "/lorebooks", (_m, u) => json(page(state.lorebooks, u)));
  on("GET", "/lorebooks/:id", (m) =>
    json(byId(state.lorebooks, m[1]!) ?? { error: "Not found" }, byId(state.lorebooks, m[1]!) ? 200 : 404),
  );
  on("POST", "/lorebooks", (_m, _u, b) => {
    const row = {
      id: uid("demo-lorebook"),
      name: "New lorebook",
      description: "",
      category: "world",
      enabled: true,
      isGlobal: false,
      characterId: null,
      chatId: null,
      tags: [],
      scanDepth: 2,
      tokenBudget: 2048,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      ...b,
    };
    state.lorebooks.push(row);
    return json(row);
  });
  on("PATCH", "/lorebooks/:id", (m, _u, b) => {
    const row = byId(state.lorebooks, m[1]!);
    return row ? json(patchRow(row, b)) : notFound();
  });
  on("DELETE", "/lorebooks/:id", (m) => {
    state.lorebookEntries = state.lorebookEntries.filter((e) => e.lorebookId !== m[1]);
    return remove(state.lorebooks, m[1]!) ? json({ success: true }) : notFound();
  });
  on("GET", "/lorebooks/:id/entries", (m) => json(state.lorebookEntries.filter((e) => e.lorebookId === m[1])));
  on("POST", "/lorebooks/:id/entries", (m, _u, b) => {
    const row = {
      id: uid("demo-entry"),
      lorebookId: m[1],
      name: "New entry",
      content: "",
      keys: [],
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
      createdAt: nowIso(),
      updatedAt: nowIso(),
      ...b,
    };
    state.lorebookEntries.push(row);
    return json(row);
  });
  on("PATCH", "/lorebooks/:id/entries/:eid", (m, _u, b) => {
    const row = byId(state.lorebookEntries, m[2]!);
    return row ? json(patchRow(row, b)) : notFound();
  });
  on("DELETE", "/lorebooks/:id/entries/:eid", (m) =>
    remove(state.lorebookEntries, m[2]!) ? json({ success: true }) : notFound(),
  );
  on("GET", "/lorebooks/:id/folders", () => json([]));
}

async function handleApi(path: string, init: RequestInit | undefined, url: URL): Promise<Response> {
  const method = (init?.method ?? "GET").toUpperCase();
  const hit = routes.find(([m, re]) => m === method && re.test(path));
  if (!hit) {
    console.debug(`[demo] Unsupported ${method} ${path}`); // path only; request bodies may hold user text
    return json({ error: i18n.t("demo.errors.unsupported"), demo: true }, 501);
  }
  let body: any;
  if (typeof init?.body === "string") {
    try {
      body = JSON.parse(init.body);
    } catch {
      body = undefined;
    }
  }
  return hit[2](path.match(hit[1])!, url, body, init?.signal ?? null);
}

// --- Install -------------------------------------------------------------------------------------

/** Namespace localStorage per demo release so demos on one origin never read each other's keys. */
function isolateLocalStorage() {
  const memory = new Map<string, string>();
  let real: Storage | null = null;
  try {
    real = window.localStorage;
    const probe = `${STORAGE_PREFIX}probe:${crypto.randomUUID()}`;
    real.setItem(probe, "1");
    real.removeItem(probe);
  } catch {
    // Privacy settings can deny browser storage. The demo still works for this page session.
    real = null;
  }
  const ownKeys = () => (real ? Object.keys(real) : [...memory.keys()]).filter((k) => k.startsWith(STORAGE_PREFIX));
  const proxy: Storage = {
    get length() {
      return ownKeys().length;
    },
    key: (i) => ownKeys()[i]?.slice(STORAGE_PREFIX.length) ?? null,
    getItem: (k) => (real ? real.getItem(STORAGE_PREFIX + k) : (memory.get(STORAGE_PREFIX + k) ?? null)),
    setItem: (k, v) => {
      if (real) real.setItem(STORAGE_PREFIX + k, v);
      else memory.set(STORAGE_PREFIX + k, v);
    },
    removeItem: (k) => {
      if (real) real.removeItem(STORAGE_PREFIX + k);
      else memory.delete(STORAGE_PREFIX + k);
    },
    clear: () =>
      ownKeys().forEach((k) => {
        if (real) real.removeItem(k);
        else memory.delete(k);
      }),
  };
  Object.defineProperty(window, "localStorage", { value: proxy, configurable: true });
  // Clear after the previous document's beforeunload persistence has finished. A URL marker also
  // works when privacy settings deny sessionStorage; remove it before the app starts.
  const url = new URL(window.location.href);
  if (url.searchParams.get(RESET_QUERY_KEY) === "1") {
    proxy.clear();
    url.searchParams.delete(RESET_QUERY_KEY);
    window.history.replaceState(window.history.state, "", url.toString());
  }
  // Visitors land in the real chat UI: lessons replace the first-run tour and the What's New dialog.
  // ponytail: the What's New key mirrors its component; importing that component here would load stores too early.
  if (!proxy.getItem(UI_PERSISTENCE.name)) {
    const defaultRoleplayBackground = DEMO_ASSETS.harbor;
    proxy.setItem(
      UI_PERSISTENCE.name,
      JSON.stringify({
        state: {
          hasCompletedOnboarding: true,
          chatWindowIntroDismissed: true,
          chatHelpSeenModes: ["conversation", "roleplay", "game"],
          chatSettingsMoveTipDismissed: true,
          defaultRoleplayBackground,
          // The roleplay column is up to 986px wide; the docked Tracker Panel needs 280px beside it to stay readable,
          // and the open chat list takes about 320px more. Narrower windows keep the tracker bar and a centred chat.
          sidebarOpen: window.innerWidth >= 1760,
          trackerPanelOpen: window.innerWidth >= 1420,
          // Dock the panel left, clear of the window buttons on the right, with the chat beside it.
          trackerPanelSide: "left",
          roleplayChatPosition: window.innerWidth >= 1420 ? "right" : "center",
          // Visitors expect Enter to send, also for "/roll 1d20".
          enterToSendRP: true,
          // The runtime already paces words; the letter typewriter would split *italics* and image markdown.
          streamingSpeed: 100,
          // Conversation chats open as messenger bubbles; roleplay and game keep their own look.
          conversationMessageStyle: "bubble",
        },
        version: UI_PERSISTENCE.version,
      }),
    );
  }
  proxy.setItem("marinara:whats-new:seen-version", APP_VERSION);
  // The demo ships no sound files; muted game audio avoids 404s for every UI click sound.
  if (proxy.getItem("game-audio-muted") === null) proxy.setItem("game-audio-muted", "true");
}

export function installDemoRuntime(): void {
  if (installed) return;
  installed = true;
  state = createSeed();
  registerRoutes();
  isolateLocalStorage();
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = new URL(
      typeof input === "string" || input instanceof URL ? input.toString() : input.url,
      window.location.href,
    );
    if (url.protocol !== "data:" && url.protocol !== "blob:" && url.origin !== window.location.origin) {
      console.debug(`[demo] Blocked external request to ${url.origin}`);
      return json({ error: i18n.t("demo.errors.externalNetworkDisabled"), demo: true }, 403);
    }
    // Same-origin /api/ is the Engine backend, whatever repository prefix the demo is hosted under.
    if (!url.pathname.startsWith("/api/")) return realFetch(input, init);
    // The CSRF shim converts every write into a Request, including its body and abort signal.
    const request = new Request(input, init);
    return handleApi(
      url.pathname.slice(4),
      {
        method: request.method,
        signal: request.signal,
        body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.text(),
      },
      url,
    );
  };
}

/** Restore the seed start: abort streams, drop this demo's own localStorage keys (never others), reload. */
export function resetDemo(): void {
  generations.forEach((run) => run.abort());
  const url = new URL(window.location.href);
  url.searchParams.set(RESET_QUERY_KEY, "1");
  window.location.replace(url.toString());
}
