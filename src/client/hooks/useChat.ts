import { useState, useCallback, useMemo, useEffect } from "react";
import type { Conversation, Message, StorageMode } from "../storage";
import { createStorage } from "../storage";

interface UseChatReturn {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  messages: Message[];
  isStreaming: boolean;
  error: string | null;
  loadConversations: () => Promise<void>;
  selectConversation: (id: string) => Promise<void>;
  newConversation: (model: string) => Promise<Conversation>;
  deleteConversation: (id: string) => Promise<void>;
  clearConversation: () => void;
  sendMessage: (
    content: string,
    model: string,
    conversationId: string,
    storageMode: StorageMode,
    systemPrompt?: string,
  ) => Promise<void>;
}

export function useChat(storageMode: StorageMode): UseChatReturn {
  const storage = useMemo(() => createStorage(storageMode), [storageMode]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setActiveConversation(null);
    setMessages([]);
    setError(null);
    setIsStreaming(false);
  }, [storageMode]);

  const loadConversations = useCallback(async () => {
    try {
      const data = await storage.getConversations();
      setConversations(data);
    } catch {
      setError("Failed to load conversations");
    }
  }, [storage]);

  const selectConversation = useCallback(
    async (id: string) => {
      try {
        const data = await storage.getConversation(id);
        if (!data) return;
        setActiveConversation(data.conversation);
        setMessages(data.messages);
      } catch {
        setError("Failed to load conversation");
      }
    },
    [storage],
  );

  const newConversation = useCallback(
    async (model: string): Promise<Conversation> => {
      const conversation = await storage.createConversation(model);
      setConversations((prev) => [conversation, ...prev]);
      setActiveConversation(conversation);
      setMessages([]);
      return conversation;
    },
    [storage],
  );

  const deleteConversation = useCallback(
    async (id: string) => {
      await storage.deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversation?.id === id) {
        setActiveConversation(null);
        setMessages([]);
      }
    },
    [storage, activeConversation],
  );

  const clearConversation = useCallback(() => {
    setActiveConversation(null);
    setMessages([]);
    setError(null);
  }, []);

  const sendMessage = useCallback(
    async (
      content: string,
      model: string,
      conversationId: string,
      storageMode: StorageMode,
      systemPrompt?: string,
    ) => {
      if (isStreaming) return;
      setError(null);

      const userMessage: Message = {
        id: crypto.randomUUID(),
        conversation_id: conversationId,
        role: "user",
        content,
        created_at: Date.now(),
      };

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        conversation_id: conversationId,
        role: "assistant",
        content: "",
        created_at: Date.now(),
        model,
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsStreaming(true);

      try {
        const allMessages = [...messages, userMessage].map(({ role, content }) => ({
          role,
          content,
        }));

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversation_id: conversationId,
            model,
            messages: allMessages,
            storage_mode: storageMode,
            system_prompt: systemPrompt || undefined,
          }),
        });

        if (!res.ok || !res.body) {
          console.error("[sendMessage] bad response", res.status);
          throw new Error("Chat request failed");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = "";
        let buffer = "";

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
              if (token) {
                fullContent += token;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessage.id ? { ...m, content: fullContent } : m,
                  ),
                );
              }
            } catch {}
          }
        }

        await storage.saveMessage({ conversation_id: conversationId, role: "user", content });
        await storage.saveMessage({
          conversation_id: conversationId,
          role: "assistant",
          content: fullContent,
          model,
        });

        if (messages.length === 0 && storageMode === "local") {
          try {
            const res = await fetch("/api/title", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ message: content }),
            });
            const data = (await res.json()) as { title: string };
            const title = data.title ?? content.split(" ").slice(0, 5).join(" ");
            await storage.updateConversationTitle(conversationId, title);
            setConversations((prev) =>
              prev.map((c) => (c.id === conversationId ? { ...c, title } : c)),
            );
          } catch {
            const title = content.split(" ").slice(0, 5).join(" ");
            await storage.updateConversationTitle(conversationId, title);
            setConversations((prev) =>
              prev.map((c) => (c.id === conversationId ? { ...c, title } : c)),
            );
          }
        }

        if (messages.length === 0 && storageMode === "cloud") {
          setTimeout(async () => {
            try {
              const res = await fetch(`/api/conversations/${conversationId}`);
              if (res.ok) {
                const data = (await res.json()) as { conversation: Conversation };
                setConversations((prev) =>
                  prev.map((c) => (c.id === conversationId ? data.conversation : c)),
                );
              }
            } catch {}
          }, 3000);
        }
      } catch (e) {
        console.error("[sendMessage] error:", e);
        setError("Failed to send message");
        setMessages((prev) => prev.filter((m) => m.id !== assistantMessage.id));
      } finally {
        setIsStreaming(false);
      }
    },
    [isStreaming, messages, storage],
  );

  return {
    conversations,
    activeConversation,
    messages,
    isStreaming,
    error,
    loadConversations,
    selectConversation,
    newConversation,
    deleteConversation,
    clearConversation,
    sendMessage,
  };
}
