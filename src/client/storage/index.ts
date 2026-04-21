export interface Conversation {
  id: string;
  title: string;
  model: string;
  created_at: number;
  updated_at: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: number;
  model?: string;
  parent_id?: string;
}

export interface StorageAdapter {
  getConversations(): Promise<Conversation[]>;
  getConversation(id: string): Promise<{ conversation: Conversation; messages: Message[] } | null>;
  createConversation(model: string): Promise<Conversation>;
  deleteConversation(id: string): Promise<void>;
  saveMessage(message: Omit<Message, "id" | "created_at">): Promise<Message>;
  updateConversationTitle(id: string, title: string): Promise<void>;
}

export type StorageMode = "cloud" | "local";

import { CloudStorage } from "./cloud";
import { LocalStorage } from "./local";

export { CloudStorage } from "./cloud";
export { LocalStorage } from "./local";

export function createStorage(mode: StorageMode): StorageAdapter {
  return mode === "cloud" ? new CloudStorage() : new LocalStorage();
}
