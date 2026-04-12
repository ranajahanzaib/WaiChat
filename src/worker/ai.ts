export const AVAILABLE_MODELS = [
  { id: "@cf/google/gemma-4-26b-a4b-it", name: "Google Gemma 4 26B" },
  { id: "@cf/moonshotai/kimi-k2.5", name: "Kimi K2.5" },
  {
    id: "@cf/meta/llama-4-scout-17b-16e-instruct",
    name: "Meta Llama 4 Scout 17B",
  },
  { id: "@cf/qwen/qwen3-30b-a3b-fp8", name: "Qwen 3 30B" },
  { id: "@cf/openai/gpt-oss-120b", name: "OpenAI GPT OSS 120B" },
  {
    id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    name: "Meta Llama 3.3 70B",
  },
  {
    id: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
    name: "DeepSeek R1 32B",
  },
  { id: "@cf/qwen/qwq-32b", name: "Qwen QwQ 32B" },
  {
    id: "@cf/mistralai/mistral-small-3.1-24b-instruct",
    name: "Mistral Small 3.1 24B",
  },
  { id: "@cf/openai/gpt-oss-20b", name: "OpenAI GPT OSS 20B" },
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
