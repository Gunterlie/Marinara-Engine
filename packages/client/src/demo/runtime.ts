import { APP_VERSION } from "@marinara-engine/shared";
import { i18n } from "../localization/i18n";
import { UI_PERSISTENCE } from "../lib/ui-persistence";
import { createSeed, DEMO_ASSETS } from "./seed";
import { pickDemoReply } from "./scenarios";
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
  messages: Row[];
};
type Handler = (m: RegExpMatchArray, url: URL, body: any, signal: AbortSignal | null) => Response | Promise<Response>;

const STORAGE_PREFIX = `marinara-demo:${APP_VERSION}:${import.meta.env.BASE_URL}:`;
const RESET_QUERY_KEY = "marinara-demo-reset";
const TOKEN_DELAY_MS = 35;

let state!: State; // set by installDemoRuntime / resetDemo
let installed = false;
const generations = new Map<string, AbortController>();

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
  const reply = pickDemoReply(userText || lastUser?.content || "");

  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const sendEvent = (event: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      const send = (type: string, data?: unknown) => sendEvent({ type, data });
      const words = reply.match(/\S+\s*/g) ?? [reply];
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
            extra: {},
          };
          state.messages.push(saved);
        }
        chat.lastMessageAt = chat.updatedAt = nowIso();
        send("message_saved", saved);
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
  on("GET", "/chats/internal/professor-mari/chats", () => json([]));
  on("GET", "/chats/home-feed", () =>
    json({
      generatedAt: nowIso(),
      recentChats: state.chats
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
        .map((c) => ({ id: c.id, name: c.name, avatarPath: c.avatarPath })),
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
  on("GET", "/achievements", () => json({ definitions: [], progress: [], unlockedCount: 0, totalCount: 0 }));
  on("GET", "/game-assets/manifest", () => json({ scannedAt: nowIso(), count: 0, assets: {}, byCategory: {} }));
  on("GET", "/custom-tools/capabilities", () => json({ scriptExecutionEnabled: false }));
  on("GET", "/prompts/default", () => json(null));
  for (const path of [
    "/chat-presets",
    "/chat-folders",
    "/prompts",
    "/regex-scripts",
    "/custom-tools",
    "/agents",
    "/capability-packages/agents",
    "/characters/groups/list",
    "/characters/persona-groups/list",
  ]) {
    on("GET", path, () => json([]));
  }
  on("GET", "/sprites/:id", () => json([]));
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
  on("GET", "/chats", () => json(state.chats));
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
        },
        version: UI_PERSISTENCE.version,
      }),
    );
  }
  proxy.setItem("marinara:whats-new:seen-version", APP_VERSION);
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
