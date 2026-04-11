export const AVAILABLE_MODELS = [
  { id: "@cf/meta/llama-3.1-8b-instruct", name: "Llama 3.1 8B" },
  { id: "@cf/mistral/mistral-7b-instruct-v0.2", name: "Mistral 7B" },
  { id: "@cf/qwen/qwen1.5-14b-chat-awq", name: "Qwen 1.5 14B" },
  {
    id: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
    name: "DeepSeek R1 32B",
  },
] as const;

export type ModelId = (typeof AVAILABLE_MODELS)[number]["id"];

export function streamAiResponse(
  ai: Ai,
  model: ModelId,
  messages: { role: "user" | "assistant"; content: string }[],
): Promise<ReadableStream> {
  return ai.run(model, {
    messages,
    stream: true,
    max_tokens: 2048,
  }) as Promise<ReadableStream>;
}

export async function generateTitle(
  ai: Ai,
  firstMessage: string,
): Promise<string> {
  const response = (await ai.run("@cf/meta/llama-3.1-8b-instruct", {
    messages: [
      {
        role: "user",
        content: `Generate a short 4-6 word title for a conversation that starts with this message. Reply with only the title, no quotes, no punctuation at the end:\n\n${firstMessage}`,
      },
    ],
  })) as { response: string };
  return response.response?.trim() ?? "New Conversation";
}
