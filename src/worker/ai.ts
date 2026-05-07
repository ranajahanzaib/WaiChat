export const AVAILABLE_MODELS = [
  { id: "@cf/google/gemma-4-26b-a4b-it", name: "Google Gemma 4 26B" },
  { id: "@cf/moonshotai/kimi-k2.6", name: "Kimi K2.6" },
  { id: "@cf/meta/llama-4-scout-17b-16e-instruct", name: "Meta Llama 4 Scout 17B" },
  { id: "@cf/qwen/qwen3-30b-a3b-fp8", name: "Qwen 3 30B" },
  { id: "@cf/openai/gpt-oss-120b", name: "OpenAI GPT OSS 120B" },
  { id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", name: "Meta Llama 3.3 70B" },
  { id: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b", name: "DeepSeek R1 32B" },
  { id: "@cf/qwen/qwq-32b", name: "Qwen QwQ 32B" },
  { id: "@cf/mistralai/mistral-small-3.1-24b-instruct", name: "Mistral Small 3.1 24B" },
  { id: "@cf/openai/gpt-oss-20b", name: "OpenAI GPT OSS 20B" },
] as const;

export type ModelId = (typeof AVAILABLE_MODELS)[number]["id"];

export function streamAiResponse(
  ai: Ai,
  model: ModelId,
  messages: { role: "user" | "assistant" | "system"; content: string }[],
): Promise<ReadableStream> {
  return ai.run(model, {
    messages,
    stream: true,
    max_tokens: 2048,
  }) as unknown as Promise<ReadableStream>;
}

export async function generateTitle(ai: Ai, firstMessage: string): Promise<string> {
  try {
    const response = (await ai.run("@cf/meta/llama-4-scout-17b-16e-instruct", {
      messages: [
        {
          role: "user",
          content: `Create a concise, descriptive title (3-6 words) for a chat that starts with the message below. Capture the specific topic or intent. Avoid generic titles like "Chat Inquiry" or "Information Request". Output ONLY the title text without quotes or ending punctuation:\n\n${firstMessage}`,
        },
      ],
    })) as { response: string };

    return (
      response.response
        ?.trim()
        .replace(/^["']|["']$/g, "")
        .replace(/[.!?]$/, "") || "New Conversation"
    );
  } catch (e) {
    console.error("[generateTitle] error:", e);
    return "New Conversation";
  }
}
