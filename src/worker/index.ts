import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env, ChatRequest } from "./types";
import { streamAiResponse, generateTitle, AVAILABLE_MODELS } from "./ai";
import {
  getConversations,
  getConversation,
  createConversation,
  updateConversationTitle,
  updateConversationTimestamp,
  deleteConversation,
  getMessages,
  saveMessage,
} from "./db";

function scoreModel(id: string): number {
  let score = 0;

  // Explicit boosts for known latest models
  if (id.includes("gemma-4")) score += 100;
  if (id.includes("kimi-k2")) score += 95;
  if (id.includes("llama-4")) score += 90;
  if (id.includes("qwen3")) score += 85;
  if (id.includes("gpt-oss-120b")) score += 80;
  if (id.includes("llama-3.3")) score += 75;
  if (id.includes("deepseek-r1")) score += 70;
  if (id.includes("qwq")) score += 65;
  if (id.includes("mistral-small-3.1")) score += 60;
  if (id.includes("gpt-oss-20b")) score += 55;

  // General heuristics for everything else
  const versionMatch = id.match(/(\d+)\.\d+/);
  if (versionMatch) score += parseInt(versionMatch[1]) * 2;

  const sizeMatch = id.match(/(\d+)b/i);
  if (sizeMatch) score += parseInt(sizeMatch[1]);

  if (id.includes("fast")) score += 3;
  if (id.includes("fp8")) score += 2;

  // Penalize old models
  if (id.includes("v0.1") || id.includes("v0.2")) score -= 20;
  if (id.includes("llama-2")) score -= 30;
  if (id.includes("1.5b") || id.includes("0.5b") || id.includes("1.1b")) score -= 15;
  if (id.includes("lora")) score -= 10;

  return score;
}

function formatModelName(id: string): string {
  const parts = id.split("/");
  const slug = parts[parts.length - 1];
  const author = parts[parts.length - 2] ?? "";

  // Known author prefixes to prepend
  const authorMap: Record<string, string> = {
    openai: "OpenAI",
    meta: "Meta",
    mistral: "Mistral",
    "deepseek-ai": "DeepSeek",
    qwen: "Qwen",
    google: "Google",
    microsoft: "Microsoft",
  };

  const formattedSlug = slug
    .split("-")
    .map((word) => {
      if (/^\d/.test(word)) return word.toUpperCase();
      const lower = word.toLowerCase();
      const special: Record<string, string> = {
        gpt: "GPT",
        oss: "OSS",
        fp8: "FP8",
        awq: "AWQ",
        llm: "LLM",
        rag: "RAG",
        qwq: "QwQ",
        llama: "Llama",
        mistral: "Mistral",
        deepseek: "DeepSeek",
        instruct: "Instruct",
        fast: "Fast",
        chat: "Chat",
        vision: "Vision",
        coder: "Coder",
        distill: "Distill",
      };
      return special[lower] ?? (word.charAt(0).toUpperCase() + word.slice(1));
    })
    .join(" ");

  const prefix = authorMap[author];
  return prefix ? `${prefix} ${formattedSlug}` : formattedSlug;
}

const app = new Hono<{ Bindings: Env }>();

app.use("/api/*", cors());

let isDbInitialized = false;

async function ensureDbInit(db: D1Database) {
  if (isDbInitialized) return;
  await db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'New Conversation',
      model TEXT NOT NULL,
      storage_mode TEXT NOT NULL DEFAULT 'cloud',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages (conversation_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations (updated_at);
  `);
  isDbInitialized = true;
}

app.use("/api/*", async (c, next) => {
  if (c.env.DB) {
    await ensureDbInit(c.env.DB);
  }
  await next();
});

// Models — fetched live from Cloudflare API if account ID is set, otherwise hardcoded fallback
app.get("/api/models", async (c) => {
  if (!c.env.CLOUDFLARE_ACCOUNT_ID) {
    return c.json(AVAILABLE_MODELS);
  }
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${c.env.CLOUDFLARE_ACCOUNT_ID}/ai/models/search?task=Text+Generation&per_page=100`,
      {
        headers: {
          Authorization: `Bearer ${c.env.CLOUDFLARE_API_TOKEN}`,
        },
      }
    );

    if (!res.ok) throw new Error(`Cloudflare API error: ${res.status}`);

    const data = await res.json() as {
      result: { id: string; name: string; description: string; task: { name: string } }[];
      success: boolean;
    };

    const models = data.result
      .map((m) => ({ id: m.name, name: formatModelName(m.name) }))
      .sort((a, b) => scoreModel(b.id) - scoreModel(a.id));

    return c.json(models);
  } catch (e) {
    console.error("[/api/models] error:", e);
    // Fallback to hardcoded list if API call fails
    return c.json(AVAILABLE_MODELS);
  }
});

// Conversations
app.get("/api/conversations", async (c) => {
  const conversations = await getConversations(c.env.DB);
  return c.json(conversations);
});

app.post("/api/conversations", async (c) => {
  const body = await c.req.json<{ model: string }>();
  const now = Date.now();
  const conversation = {
    id: crypto.randomUUID(),
    title: "New Conversation",
    model: body.model,
    created_at: now,
    updated_at: now,
  };
  await createConversation(c.env.DB, conversation);
  return c.json(conversation, 201);
});

app.get("/api/conversations/:id", async (c) => {
  const conversation = await getConversation(c.env.DB, c.req.param("id"));
  if (!conversation) return c.json({ error: "Not found" }, 404);
  const messages = await getMessages(c.env.DB, conversation.id);
  return c.json({ conversation, messages });
});

app.delete("/api/conversations", async (c) => {
  await c.env.DB.prepare("DELETE FROM conversations").run();
  return c.json({ success: true });
});

app.delete("/api/conversations/:id", async (c) => {
  await deleteConversation(c.env.DB, c.req.param("id"));
  return c.json({ success: true });
});

// Title generation (used by local mode)
app.post("/api/title", async (c) => {
  const { message } = await c.req.json<{ message: string }>();
  const title = await generateTitle(c.env.AI, message);
  return c.json({ title });
});
app.post("/api/chat", async (c) => {
  const body = await c.req.json<ChatRequest>();
  const { conversation_id, model, messages, storage_mode, system_prompt } = body;
  const isCloud = storage_mode !== "local";
  const now = Date.now();

  // Prepend system message if provided
  const messagesWithSystem = system_prompt
    ? [{ role: "system" as const, content: system_prompt }, ...messages]
    : messages;

  if (isCloud) {
    // Save user message to D1
    const userMsg = messages[messages.length - 1];
    await saveMessage(c.env.DB, {
      id: crypto.randomUUID(),
      conversation_id,
      role: "user",
      content: userMsg.content,
      created_at: now,
    });

    // Auto-generate title from first user message
    if (messages.length === 1) {
      generateTitle(c.env.AI, userMsg.content).then((title) =>
        updateConversationTitle(c.env.DB, conversation_id, title)
      );
    }
  }
  const stream = await streamAiResponse(c.env.AI, model as any, messagesWithSystem);

  if (isCloud) {
    const [streamForClient, streamForSave] = stream.tee();

    // Save assistant message and update title/timestamp after stream ends
    const savePromise = saveAssistantMessage(c.env.DB, conversation_id, streamForSave)
      .then(() => updateConversationTimestamp(c.env.DB, conversation_id));

    c.executionCtx.waitUntil(savePromise);

    return new Response(streamForClient, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  }

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
});

async function saveAssistantMessage(
  db: D1Database,
  conversationId: string,
  stream: ReadableStream
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let fullContent = "";
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        if (trimmed === "data: [DONE]") continue;
        try {
          const json = JSON.parse(trimmed.slice(6));
          let token: string | undefined;
          if (typeof json.choices?.[0]?.delta?.content === "string") {
            token = json.choices[0].delta.content;
          } else if (typeof json.response === "string") {
            token = json.response;
          }
          if (token) fullContent += token;
        } catch {}
      }
    }
  } catch (e) {
    console.error("[saveAssistantMessage] stream error:", e);
  } finally {
    reader.releaseLock();
  }

  if (fullContent) {
    await db
      .prepare("INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), conversationId, "assistant", fullContent, Date.now())
      .run();
  }
}

export default app;
