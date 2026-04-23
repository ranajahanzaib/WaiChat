import { Hono } from "hono";
import { cors } from "hono/cors";
import { AVAILABLE_MODELS, generateTitle, streamAiResponse } from "./ai";
import {
  createConversation,
  deleteConversation,
  getConversation,
  getConversations,
  getMessageById,
  getMessages,
  getSetting,
  getSiblingCount,
  saveMessage,
  setSetting,
  updateConversationTimestamp,
  updateConversationTitle,
} from "./db";
import { commitChangesToGitHub, fetchChangedFiles, getChangedFiles } from "./github";
import type { UpdateChannel } from "./manifest";
import { fetchLatestRelease } from "./manifest";
import type { ChatRequest, Env, UpdateQueueMessage } from "./types";
import {
  getUpdateLog,
  getUpdateState,
  logUpdateAttempt,
  updateAfterCommit,
  updateCheckStatus,
} from "./update-db";
import { APP_VERSION } from "./version";

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
      return special[lower] ?? word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");

  const prefix = authorMap[author];
  return prefix ? `${prefix} ${formattedSlug}` : formattedSlug;
}

const app = new Hono<{ Bindings: Env }>();

app.use("/api/*", cors());

// Models - fetched live from Cloudflare API if account ID is set, otherwise hardcoded fallback
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
      },
    );

    if (!res.ok) throw new Error(`Cloudflare API error: ${res.status}`);

    const data = (await res.json()) as {
      result: {
        id: string;
        name: string;
        description: string;
        task: { name: string };
      }[];
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

// Delete a single message (with cascade / soft-delete logic)
app.delete("/api/conversations/:conversationId/messages/:messageId", async (c) => {
  const { conversationId, messageId } = c.req.param();
  const db = c.env.DB;

  try {
    const msg = await getMessageById(db, messageId);
    if (!msg || msg.conversation_id !== conversationId) {
      return c.json({ error: "Message not found" }, 404);
    }

    const deletedIds: string[] = [];
    const softDeletedIds: string[] = [];
    const statements: D1PreparedStatement[] = [];

    if (msg.role === "user") {
      // Deleting a user message also removes the assistant turn below it.
      const allMessages = await getMessages(db, conversationId);
      const userIdx = allMessages.findIndex((m) => m.id === messageId);

      // Find the next assistant original message (no parent_id) after this user message
      for (let i = userIdx + 1; i < allMessages.length; i++) {
        const m = allMessages[i];
        if (m.role === "user") break; // hit the next user turn, stop
        if (m.role === "assistant" && !m.parent_id) {
          // Delete all retry siblings of this assistant message
          const siblings = allMessages.filter((s) => s.parent_id === m.id);
          for (const s of siblings) {
            statements.push(db.prepare("DELETE FROM messages WHERE id = ?").bind(s.id));
            deletedIds.push(s.id);
          }
          // Delete the parent assistant message itself
          statements.push(db.prepare("DELETE FROM messages WHERE id = ?").bind(m.id));
          deletedIds.push(m.id);
          break;
        }
      }

      // Delete the user message
      statements.push(db.prepare("DELETE FROM messages WHERE id = ?").bind(messageId));
      deletedIds.push(messageId);
    } else {
      // Assistant message
      if (msg.parent_id) {
        // This is a retry sibling - hard-delete it
        statements.push(db.prepare("DELETE FROM messages WHERE id = ?").bind(messageId));
        deletedIds.push(messageId);

        // Check if the parent is now orphaned
        const remaining = await getSiblingCount(db, msg.parent_id);
        // remaining includes the message we're about to delete, so check <= 1
        if (remaining <= 1) {
          // Check if parent was soft-deleted
          const parent = await getMessageById(db, msg.parent_id);
          if (parent && parent.deleted_at) {
            // Parent was soft-deleted and has no siblings left - fully remove it
            statements.push(db.prepare("DELETE FROM messages WHERE id = ?").bind(msg.parent_id));
            deletedIds.push(msg.parent_id);
          }
        }
      } else {
        // This is a parent (original) assistant message
        const siblingCount = await getSiblingCount(db, msg.id);
        if (siblingCount > 0) {
          // Has retry siblings - soft-delete (preserve for parent_id references)
          statements.push(
            db
              .prepare("UPDATE messages SET content = '', deleted_at = ? WHERE id = ?")
              .bind(Date.now(), msg.id),
          );
          softDeletedIds.push(msg.id);
        } else {
          // Solo message - hard-delete
          statements.push(db.prepare("DELETE FROM messages WHERE id = ?").bind(msg.id));
          deletedIds.push(msg.id);
        }
      }
    }

    // Execute all mutations in a single batch round-trip
    statements.push(
      db
        .prepare("UPDATE conversations SET updated_at = ? WHERE id = ?")
        .bind(Date.now(), conversationId),
    );
    await db.batch(statements);

    return c.json({ success: true, deletedIds, softDeletedIds });
  } catch (e) {
    console.error("[DELETE /message] error:", e);
    return c.json({ error: "Failed to delete message" }, 500);
  }
});

// Settings
const ALLOWED_SETTING_KEYS = ["system_prompt", "update_channel"];

app.get("/api/settings/:key", async (c) => {
  const key = c.req.param("key");
  if (!ALLOWED_SETTING_KEYS.includes(key)) {
    return c.json({ error: "Invalid setting key" }, 400);
  }
  const value = await getSetting(c.env.DB, key);
  return c.json({ value });
});

app.post("/api/settings/:key", async (c) => {
  const key = c.req.param("key");
  if (!ALLOWED_SETTING_KEYS.includes(key)) {
    return c.json({ error: "Invalid setting key" }, 400);
  }
  const { value } = await c.req.json<{ value: string }>();
  if (typeof value !== "string") return c.json({ error: "Invalid value" }, 400);
  await setSetting(c.env.DB, key, value);
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
  const {
    conversation_id,
    model,
    messages,
    storage_mode,
    system_prompt,
    parent_id,
    user_message_id,
    assistant_message_id,
  } = body;
  const isCloud = storage_mode !== "local";
  const isRetry = !!parent_id;
  const now = Date.now();

  // Prepend system message if provided
  const messagesWithSystem = system_prompt
    ? [{ role: "system" as const, content: system_prompt }, ...messages]
    : messages;

  if (isCloud && !isRetry) {
    // Save user message to D1 (only for new messages, not retries)
    const userMsg = messages[messages.length - 1];
    await saveMessage(c.env.DB, {
      id: user_message_id || crypto.randomUUID(),
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

  const sourceStream = await streamAiResponse(c.env.AI, model as any, messagesWithSystem);

  if (!isCloud) {
    return new Response(sourceStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  }

  // Cloud Mode: Transform stream to capture fullContent and handle abort
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const reader = sourceStream.getReader();
  const decoder = new TextDecoder();
  let fullContent = "";
  let buffer = "";

  const processStream = async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Try writing to client. If client aborted, this will throw.
        try {
          await writer.write(value);
        } catch (e) {
          // Client aborted the connection
          console.log("[/api/chat] Client disconnected");
          await reader.cancel();
          break;
        }

        // Process chunk for saving
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
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
      console.error("[/api/chat] stream error:", e);
    } finally {
      if (fullContent) {
        // Save whatever we got
        try {
          await saveMessage(c.env.DB, {
            id: assistant_message_id || crypto.randomUUID(),
            conversation_id,
            role: "assistant",
            content: fullContent,
            created_at: Date.now(),
            model,
            parent_id: parent_id || undefined,
          });
          await updateConversationTimestamp(c.env.DB, conversation_id);
        } catch (e) {
          console.error("[/api/chat] failed to save message:", e);
        }
      }
      reader.releaseLock();
      try {
        await writer.close();
      } catch {}
    }
  };

  c.executionCtx.waitUntil(processStream());

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
});

// saveAssistantMessage is no longer needed as saving is handled inline with streaming

// Auto-Update API Routes

/** GET /api/updates/status - Current version, last check, recent logs. */
app.get("/api/updates/status", async (c) => {
  try {
    const channel = ((await getSetting(c.env.DB, "update_channel")) || "stable") as UpdateChannel;
    const state = await getUpdateState(c.env.DB, channel);
    const recentLogs = await getUpdateLog(c.env.DB, 5);

    const is_configured = !!(c.env.GITHUB_TOKEN && c.env.GITHUB_REPO);

    return c.json({
      current_version: APP_VERSION,
      latest_version: state?.latest_version ?? null,
      last_check: state?.last_check ?? null,
      last_attempt: state?.last_attempt ?? null,
      status: state?.last_status ?? "up_to_date",
      last_error: state?.last_error ?? null,
      channel,
      is_configured,
      recent_logs: recentLogs,
    });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

/**
 * Compares two SemVer strings.
 * Returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal.
 */
function compareVersions(v1: string, v2: string): number {
  const parse = (v: string) =>
    v
      .replace(/^v/, "")
      .split(/[.-]/)
      .map((s) => (isNaN(Number(s)) ? s : Number(s)));
  const p1 = parse(v1);
  const p2 = parse(v2);
  const len = Math.max(p1.length, p2.length);

  for (let i = 0; i < len; i++) {
    const s1 = p1[i];
    const s2 = p2[i];

    if (s1 === s2) continue;

    // Pre-release precedence: 1.0.0 > 1.0.0-alpha
    if (s1 === undefined) return typeof s2 === "string" ? 1 : -1;
    if (s2 === undefined) return typeof s1 === "string" ? -1 : 1;

    if (typeof s1 === "number" && typeof s2 === "number") {
      if (s1 > s2) return 1;
      if (s1 < s2) return -1;
    } else {
      const str1 = String(s1);
      const str2 = String(s2);
      if (str1 > str2) return 1;
      if (str1 < str2) return -1;
    }
  }
  return 0;
}

/** POST /api/updates/check - Manually check for updates (does NOT queue work). */
app.post("/api/updates/check", async (c) => {
  try {
    // Read channel preference, fetch latest release from upstream
    const channel = ((await getSetting(c.env.DB, "update_channel")) || "stable") as UpdateChannel;
    const release = await fetchLatestRelease(c.env, channel);
    if (!release) {
      // If no releases found on this channel, reset to up_to_date to clear stale "Available" messages
      await updateCheckStatus(c.env.DB, channel, {
        last_check: new Date().toISOString(),
        last_status: "up_to_date",
        latest_version: null,
        last_error: null,
      });
      return c.json({
        message: `No releases found on ${channel} channel`,
        status: "up_to_date",
        current_version: APP_VERSION,
        latest_version: null,
      });
    }

    // Compare against running version: only available if upstream is strictly newer
    const isAvailable = compareVersions(release.version, APP_VERSION) > 0;
    if (!isAvailable) {
      await updateCheckStatus(c.env.DB, channel, {
        last_check: new Date().toISOString(),
        last_status: "up_to_date",
        latest_version: release.version,
        last_error: null,
      });
      return c.json({
        message:
          release.version === APP_VERSION
            ? "Already up to date"
            : `Local version (${APP_VERSION}) is newer than upstream (${release.version})`,
        status: "up_to_date",
        current_version: APP_VERSION,
        latest_version: release.version,
      });
    }

    // Mark as update available
    await updateCheckStatus(c.env.DB, channel, {
      last_check: new Date().toISOString(),
      last_status: "available",
      latest_version: release.version,
      last_error: null,
    });

    return c.json({
      message: `Update available: ${release.version}`,
      status: "available",
      current_version: APP_VERSION,
      latest_version: release.version,
    });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to check for updates" },
      500,
    );
  }
});

/** POST /api/updates/apply - Manually trigger the update process. */
app.post("/api/updates/apply", async (c) => {
  try {
    const channel = ((await getSetting(c.env.DB, "update_channel")) || "stable") as UpdateChannel;
    const state = await getUpdateState(c.env.DB, channel);
    if (!state || state.last_status !== "available" || !state.latest_version) {
      return c.json({ error: "No update available to apply" }, 400);
    }

    // 1. Queue the update job
    await c.env.UPDATE_QUEUE.send({
      type: "update",
      fromVersion: APP_VERSION,
      toVersion: state.latest_version,
      channel,
      triggeredAt: new Date().toISOString(),
    });

    // 2. Update state to "queued"
    await updateCheckStatus(c.env.DB, channel, {
      last_check: new Date().toISOString(),
      last_status: "queued",
      latest_version: state.latest_version,
      last_error: null,
    });

    return c.json({
      message: `Update to ${state.latest_version} queued`,
      status: "queued",
    });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to apply update" },
      500,
    );
  }
});

/** POST /api/updates/rollback - Rollback to a previous version. */
app.post("/api/updates/rollback", async (c) => {
  try {
    const body = await c.req.json<{ version: string }>();
    const { version } = body;

    if (!version) {
      return c.json({ error: "version parameter required" }, 400);
    }

    // TODO: Implement rollback logic.
    // This would fetch a specific release tag, create a commit, and update state.
    return c.json(
      {
        message: "Rollback is not yet implemented",
        error: "Feature coming soon",
      },
      501,
    );
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Rollback failed" }, 500);
  }
});

// Cron Trigger Handler

async function handleScheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
  const startTime = Date.now();
  // Fetch channel first so it's available in the catch block for error logging
  const channel = ((await getSetting(env.DB, "update_channel")) || "stable") as UpdateChannel;

  try {
    console.log("[Cron] Update check starting");

    // Fetch latest release from upstream
    const release = await fetchLatestRelease(env, channel);
    if (!release) {
      console.log(`[Cron] No releases found on ${channel} channel`);
      await updateCheckStatus(env.DB, channel, {
        last_check: new Date().toISOString(),
        last_status: "up_to_date",
        latest_version: null,
        last_error: null,
      });
      return;
    }

    // Compare against running version: only available if upstream is strictly newer
    const isAvailable = compareVersions(release.version, APP_VERSION) > 0;
    if (!isAvailable) {
      console.log(`[Cron] Up to date (Local: ${APP_VERSION}, Upstream: ${release.version})`);
      await updateCheckStatus(env.DB, channel, {
        last_check: new Date().toISOString(),
        last_status: "up_to_date",
        latest_version: release.version,
        last_error: null,
      });
      return;
    }

    console.log(`[Cron] Update available: ${APP_VERSION} → ${release.version}`);

    // Queue the update job
    await env.UPDATE_QUEUE.send({
      type: "update",
      fromVersion: APP_VERSION,
      toVersion: release.version,
      channel,
      triggeredAt: new Date().toISOString(),
    });

    // Update state to "queued"
    await updateCheckStatus(env.DB, channel, {
      last_check: new Date().toISOString(),
      last_status: "queued",
      latest_version: release.version,
      last_error: null,
    });

    const duration = Date.now() - startTime;
    console.log(`[Cron] Job queued. Duration: ${duration}ms`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Cron] Check failed:", errorMessage);

    // Log failure but don't throw - cron should not fail
    try {
      await updateCheckStatus(env.DB, channel, {
        last_check: new Date().toISOString(),
        last_status: "failed",
        last_error: errorMessage.substring(0, 500),
      });
    } catch (dbError) {
      console.error("[Cron] Failed to log error to DB:", dbError);
    }
  }
}

// Queue Consumer Handler

async function handleQueue(batch: MessageBatch<UpdateQueueMessage>, env: Env) {
  for (const message of batch.messages) {
    if (message.body.type === "update") {
      try {
        await performUpdate(env, message.body);
        message.ack();
      } catch (error) {
        // Explicit retry (max 3 times via wrangler.toml max_retries)
        message.retry();
        console.error("[Queue] Update failed, will retry:", error);
      }
    }
  }
}

async function performUpdate(env: Env, job: UpdateQueueMessage) {
  const startTime = Date.now();
  const { fromVersion, toVersion, triggeredAt } = job;

  try {
    console.log(`[Queue] Starting update: ${fromVersion} → ${toVersion}`);

    // Get the diff between current and target version via Compare API
    const changes = await getChangedFiles(env, fromVersion, toVersion);
    console.log(`[Queue] Compare API found ${changes.length} changed files`);

    if (changes.length === 0) {
      console.log("[Queue] No applicable file changes (all excluded). Marking as success.");
      const duration = Date.now() - startTime;
      await updateAfterCommit(env.DB, job.channel, {
        version: toVersion,
        status: "commit_success",
        files_updated: 0,
        duration_ms: duration,
      });
      return;
    }

    // Fetch contents for added/modified files
    const filesToCommit = await fetchChangedFiles(env, changes);
    // Identify exactly what needs to be deleted (removed or renamed files)
    const filesToDelete = changes.flatMap((c) =>
      c.status === "removed"
        ? [c.path]
        : c.status === "renamed" && c.previousPath
          ? [c.previousPath]
          : [],
    );
    console.log(
      `[Queue] Fetched ${filesToCommit.length} files to update, ${filesToDelete.length} to delete`,
    );

    // Commit all changes to the user's GitHub repo
    const totalCommitted = await commitChangesToGitHub(
      env,
      filesToCommit,
      filesToDelete,
      toVersion,
    );
    console.log(`[Queue] Committed ${totalCommitted} changes to GitHub`);

    // Update DB with success
    const duration = Date.now() - startTime;
    await updateAfterCommit(env.DB, job.channel, {
      version: toVersion,
      status: "commit_success",
      files_updated: totalCommitted,
      duration_ms: duration,
    });

    console.log(`[Queue] Update to ${toVersion} complete. Duration: ${duration}ms`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const duration = Date.now() - startTime;

    console.error(`[Queue] Update failed: ${errorMessage}`);

    // Log failure to DB
    await logUpdateAttempt(env.DB, {
      version: toVersion,
      attempted_at: triggeredAt,
      status: "commit_failed",
      error_message: errorMessage.substring(0, 1000),
      duration_ms: duration,
    });

    // Update main state to show failure (with retry info) in UI
    await updateCheckStatus(env.DB, job.channel, {
      last_check: new Date().toISOString(),
      last_status: "failed", // We keep "failed" but the error message will explain the retry
      last_error: `${errorMessage.substring(0, 400)} (Retrying...)`,
    });

    throw error; // Re-throw to trigger retry
  }
}

// Module Worker Export
// Changed from `export default app` (Hono-only) to the full module worker
// format so we can handle cron triggers and queue consumers alongside HTTP.

export default {
  fetch: app.fetch,

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(handleScheduled(event, env, ctx));
  },

  async queue(batch: MessageBatch<UpdateQueueMessage>, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(handleQueue(batch, env));
  },
};
