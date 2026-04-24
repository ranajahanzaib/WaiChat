import type { UpdateChannel } from "./manifest";
// Core Chat Types

export interface Env {
  AI: Ai;
  DB: D1Database;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;

  // Auto-update bindings
  UPDATE_QUEUE: Queue<UpdateQueueMessage>;
  GITHUB_TOKEN: string;
  GITHUB_REPO: string; // "owner/repo"
}

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
  deleted_at?: number;
}

export interface ChatRequest {
  conversation_id: string;
  model: string;
  messages: { role: "user" | "assistant"; content: string }[];
  storage_mode: "cloud" | "local";
  system_prompt?: string;
  parent_id?: string;
  user_message_id?: string;
  assistant_message_id?: string;
}

// Auto-Update Types

export interface UpdateQueueMessage {
  type: "update";
  fromVersion: string;
  toVersion: string;
  channel: UpdateChannel;
  triggeredAt: string;
}
