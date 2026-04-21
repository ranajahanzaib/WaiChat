import type { Conversation, Message } from "./types";

export async function getConversations(db: D1Database): Promise<Conversation[]> {
  const { results } = await db
    .prepare("SELECT * FROM conversations ORDER BY updated_at DESC")
    .all<Conversation>();
  return results;
}

export async function getConversation(db: D1Database, id: string): Promise<Conversation | null> {
  return db.prepare("SELECT * FROM conversations WHERE id = ?").bind(id).first<Conversation>();
}

export async function createConversation(
  db: D1Database,
  conversation: Conversation,
): Promise<void> {
  await db
    .prepare(
      "INSERT INTO conversations (id, title, model, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(
      conversation.id,
      conversation.title,
      conversation.model,
      conversation.created_at,
      conversation.updated_at,
    )
    .run();
}

export async function updateConversationTitle(
  db: D1Database,
  id: string,
  title: string,
): Promise<void> {
  await db
    .prepare("UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?")
    .bind(title, Date.now(), id)
    .run();
}

export async function updateConversationTimestamp(db: D1Database, id: string): Promise<void> {
  await db
    .prepare("UPDATE conversations SET updated_at = ? WHERE id = ?")
    .bind(Date.now(), id)
    .run();
}

export async function deleteConversation(db: D1Database, id: string): Promise<void> {
  await db.prepare("DELETE FROM conversations WHERE id = ?").bind(id).run();
}

export async function getMessages(db: D1Database, conversationId: string): Promise<Message[]> {
  const { results } = await db
    .prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC")
    .bind(conversationId)
    .all<Message>();
  return results;
}

export async function saveMessage(db: D1Database, message: Message): Promise<void> {
  await db
    .prepare(
      "INSERT INTO messages (id, conversation_id, role, content, created_at, model, parent_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      message.id,
      message.conversation_id,
      message.role,
      message.content,
      message.created_at,
      message.model || null,
      message.parent_id || null,
    )
    .run();
}
