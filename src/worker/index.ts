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

const app = new Hono<{ Bindings: Env }>();

app.use("/api/*", cors());

// Models
app.get("/api/models", (c) => c.json(AVAILABLE_MODELS));

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

app.delete("/api/conversations/:id", async (c) => {
  await deleteConversation(c.env.DB, c.req.param("id"));
  return c.json({ success: true });
});

// Chat (streaming)
app.post("/api/chat", async (c) => {
  const body = await c.req.json<ChatRequest>();
  const { conversation_id, model, messages, storage_mode } = body;
  const isCloud = storage_mode !== "local";
  const now = Date.now();

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
        updateConversationTitle(c.env.DB, conversation_id, title),
      );
    }
  }
  const stream = await streamAiResponse(c.env.AI, model as any, messages);

  if (isCloud) {
    const [streamForClient, streamForSave] = stream.tee();

    // Save assistant message and update title/timestamp after stream ends
    const savePromise = saveAssistantMessage(
      c.env.DB,
      conversation_id,
      streamForSave,
    ).then(() => updateConversationTimestamp(c.env.DB, conversation_id));

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
  stream: ReadableStream,
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
          if (json.response) fullContent += json.response;
        } catch {}
      }
    }
  } catch (e) {
    console.error("[saveAssistantMessage] stream error:", e);
  } finally {
    reader.releaseLock();
  }

  console.log("[saveAssistantMessage] saving, length:", fullContent.length);

  if (fullContent) {
    await db
      .prepare(
        "INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(
        crypto.randomUUID(),
        conversationId,
        "assistant",
        fullContent,
        Date.now(),
      )
      .run();
  }
}

export default app;
