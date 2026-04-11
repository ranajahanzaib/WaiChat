import type { StorageAdapter, Conversation, Message } from "./index";

export class CloudStorage implements StorageAdapter {
  async getConversations(): Promise<Conversation[]> {
    const res = await fetch("/api/conversations");
    if (!res.ok) throw new Error("Failed to fetch conversations");
    return res.json();
  }

  async getConversation(
    id: string,
  ): Promise<{ conversation: Conversation; messages: Message[] } | null> {
    const res = await fetch(`/api/conversations/${id}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error("Failed to fetch conversation");
    return res.json();
  }

  async createConversation(model: string): Promise<Conversation> {
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model }),
    });
    if (!res.ok) throw new Error("Failed to create conversation");
    return res.json();
  }

  async deleteConversation(id: string): Promise<void> {
    const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete conversation");
  }

  async saveMessage(msg: Omit<Message, "id" | "created_at">): Promise<Message> {
    // Messages are saved server-side during /api/chat — nothing to do here
    return {
      ...msg,
      id: crypto.randomUUID(),
      created_at: Date.now(),
    };
  }

  async updateConversationTitle(id: string, title: string): Promise<void> {
    // Title is updated server-side after first message — nothing to do here
  }
}
