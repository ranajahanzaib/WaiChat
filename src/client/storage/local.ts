import type { StorageAdapter, Conversation, Message } from "./index";

const CONVERSATIONS_KEY = "waichat:conversations";
const MESSAGES_KEY = (id: string) => `waichat:messages:${id}`;

export class LocalStorage implements StorageAdapter {
  private getConversationsRaw(): Conversation[] {
    try {
      return JSON.parse(localStorage.getItem(CONVERSATIONS_KEY) ?? "[]");
    } catch {
      return [];
    }
  }

  private setConversations(conversations: Conversation[]): void {
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
  }

  private getMessagesRaw(conversationId: string): Message[] {
    try {
      return JSON.parse(
        localStorage.getItem(MESSAGES_KEY(conversationId)) ?? "[]",
      );
    } catch {
      return [];
    }
  }

  async getConversations(): Promise<Conversation[]> {
    return this.getConversationsRaw().sort(
      (a, b) => b.updated_at - a.updated_at,
    );
  }

  async getConversation(
    id: string,
  ): Promise<{ conversation: Conversation; messages: Message[] } | null> {
    const conversation = this.getConversationsRaw().find((c) => c.id === id);
    if (!conversation) return null;
    const messages = this.getMessagesRaw(id);
    return { conversation, messages };
  }

  async createConversation(model: string): Promise<Conversation> {
    const now = Date.now();
    const conversation: Conversation = {
      id: crypto.randomUUID(),
      title: "New Conversation",
      model,
      created_at: now,
      updated_at: now,
    };
    const conversations = this.getConversationsRaw();
    conversations.push(conversation);
    this.setConversations(conversations);
    return conversation;
  }

  async deleteConversation(id: string): Promise<void> {
    const conversations = this.getConversationsRaw().filter((c) => c.id !== id);
    this.setConversations(conversations);
    localStorage.removeItem(MESSAGES_KEY(id));
  }

  async saveMessage(msg: Omit<Message, "id" | "created_at">): Promise<Message> {
    const message: Message = {
      ...msg,
      id: crypto.randomUUID(),
      created_at: Date.now(),
    };
    const messages = this.getMessagesRaw(msg.conversation_id);
    messages.push(message);
    localStorage.setItem(
      MESSAGES_KEY(msg.conversation_id),
      JSON.stringify(messages),
    );

    // Update conversation timestamp
    const conversations = this.getConversationsRaw().map((c) =>
      c.id === msg.conversation_id ? { ...c, updated_at: Date.now() } : c,
    );
    this.setConversations(conversations);
    return message;
  }

  async updateConversationTitle(id: string, title: string): Promise<void> {
    const conversations = this.getConversationsRaw().map((c) =>
      c.id === id ? { ...c, title } : c,
    );
    this.setConversations(conversations);
  }
}
