import type { Conversation, DeleteMessageResult, Message, StorageAdapter } from "./index";

export class MemoryStorage implements StorageAdapter {
  private conversations: Conversation[] = [];
  private messages: Map<string, Message[]> = new Map();

  async getConversations(): Promise<Conversation[]> {
    return [...this.conversations].sort((a, b) => b.updated_at - a.updated_at);
  }

  async getConversation(
    id: string,
  ): Promise<{ conversation: Conversation; messages: Message[] } | null> {
    const conversation = this.conversations.find((c) => c.id === id);
    if (!conversation) return null;
    const messages = this.messages.get(id) || [];
    return { conversation, messages: [...messages] };
  }

  async createConversation(model: string): Promise<Conversation> {
    const id = crypto.randomUUID();
    const now = Date.now();
    const conversation: Conversation = {
      id,
      title: "New Chat",
      model,
      created_at: now,
      updated_at: now,
    };
    this.conversations.push(conversation);
    this.messages.set(id, []);
    return conversation;
  }

  async deleteConversation(id: string): Promise<void> {
    this.conversations = this.conversations.filter((c) => c.id !== id);
    this.messages.delete(id);
  }

  async updateConversationModel(id: string, model: string): Promise<void> {
    const conv = this.conversations.find((c) => c.id === id);
    if (conv) {
      conv.model = model;
      conv.updated_at = Date.now();
    }
  }

  async saveMessage(
    message: Omit<Message, "id" | "created_at"> & { id?: string },
  ): Promise<Message> {
    const convId = message.conversation_id;
    const msgs = this.messages.get(convId) || [];

    const fullMessage: Message = {
      ...message,
      id: message.id || crypto.randomUUID(),
      created_at: Date.now(),
    };

    const index = msgs.findIndex((m) => m.id === fullMessage.id);
    if (index >= 0) {
      msgs[index] = fullMessage;
    } else {
      msgs.push(fullMessage);
    }
    this.messages.set(convId, msgs);

    // Update conversation's updated_at
    const conv = this.conversations.find((c) => c.id === convId);
    if (conv) {
      conv.updated_at = fullMessage.created_at;
    }

    return fullMessage;
  }

  async updateConversationTitle(id: string, title: string): Promise<void> {
    const conv = this.conversations.find((c) => c.id === id);
    if (conv) {
      conv.title = title;
      conv.updated_at = Date.now();
    }
  }

  async deleteMessage(conversationId: string, messageId: string): Promise<DeleteMessageResult> {
    const msgs = this.messages.get(conversationId) || [];
    const newMsgs = msgs.filter((m) => m.id !== messageId);
    this.messages.set(conversationId, newMsgs);
    return {
      deletedIds: [messageId],
      softDeletedIds: [],
    };
  }

  async exportConversation(
    id: string,
  ): Promise<{ conversation: Conversation; messages: Message[] } | null> {
    return this.getConversation(id);
  }

  async importConversation(conversation: Conversation, messages: Message[]): Promise<void> {
    this.conversations = this.conversations.filter((c) => c.id !== conversation.id);
    this.conversations.push(conversation);
    this.messages.set(conversation.id, [...messages]);
  }
}
