/**
 * System-level model exclusions.
 * These models are never shown to users regardless of user preferences.
 */

/** Error 5028: Deprecated on 2025-10-01 */
const DEPRECATED_LEGACY: string[] = [
  "@hf/thebloke/deepseek-coder-6.7b-base-awq",
  "@hf/thebloke/deepseek-coder-6.7b-instruct-awq",
  "@cf/qwen/qwen1.5-14b-chat-awq",
  "@hf/thebloke/openhermes-2.5-mistral-7b-awq",
  "@cf/qwen/qwen1.5-1.8b-chat",
  "@cf/qwen/qwen1.5-7b-chat-awq",
  "@hf/nexusflow/starling-lm-7b-beta",
  "@hf/thebloke/neural-chat-7b-v3-1-awq",
  "@cf/fblgit/una-cybertron-7b-v2-bf16",
  "@cf/thebloke/discolm-german-7b-v1-awq",
  "@cf/deepseek-ai/deepseek-math-7b-instruct",
  "@cf/tiiuae/falcon-7b-instruct",
  "@hf/thebloke/zephyr-7b-beta-awq",
  "@cf/openchat/openchat-3.5-0106",
  "@cf/qwen/qwen1.5-0.5b-chat",
  "@cf/tinyllama/tinyllama-1.1b-chat-v1.0",
  "@hf/thebloke/mistral-7b-instruct-v0.1-awq",
  "@hf/thebloke/llama-2-13b-chat-awq",
];

/** Models present in the catalog but consistently unavailable (non-deprecated reasons) */
const UNAVAILABLE: string[] = [
  /** Error 5016: Requires license agreement 'agree' prompt (@todo: Needs to be addressed in a separate issue) */
  "@cf/meta/llama-3.2-11b-vision-instruct",

  /** Error 5006: Incorrect role handling */
  "@cf/meta/llama-guard-3-8b",

  "@cf/meta-llama/llama-2-7b-chat-hf-lora", // 1031

  /** No output response (also deprecating May 30, 2026) */
  "@hf/nousresearch/hermes-2-pro-mistral-7b",

  /** Error 5021/1031: Unlike standard 5021 context limit errors that resolve in a new chat,
   * these models fail even in new sessions, suggesting a different root cause.
   * (also deprecating May 30, 2026) */
  "@cf/microsoft/phi-2",
];

/** Immediately excluded models (e.g. aliased models we want to hide) */
const EXCLUDED_NOW: string[] = [
  "@cf/moonshotai/kimi-k2.5", // Aliased to K2.6 on May 10th
];

/** Models deprecating on May 30th, 2026.
 * Excluded starting May 29th, 2026.
 * Shows a notice before that. */
const DEPRECATING_MAY_2026 = new Set([
  "@hf/meta-llama/meta-llama-3-8b-instruct",
  "@cf/meta/llama-3-8b-instruct",
  "@cf/meta/llama-3-8b-instruct-awq",
  "@cf/meta/llama-3.1-8b-instruct",
  "@cf/meta/llama-3.1-8b-instruct-awq",
  "@cf/meta/llama-3.1-70b-instruct",
  "@cf/meta/llama-2-7b-chat-int8",
  "@cf/meta/llama-2-7b-chat-fp16",
  "@cf/mistral/mistral-7b-instruct-v0.1",
  "@hf/google/gemma-7b-it",
  "@cf/google/gemma-3-12b-it",
  "@hf/nousresearch/hermes-2-pro-mistral-7b",
  "@cf/microsoft/phi-2",
  "@cf/defog/sqlcoder-7b-2",
  "@cf/unum/uform-gen2-qwen-500m",
  "@cf/facebook/bart-large-cnn",
  "@hf/mistral/mistral-7b-instruct-v0.2",
]);

const MAY_29_2026 = new Date("2026-05-29T00:00:00Z").getTime();

/** Static set for quick lookup of always-excluded models */
const ALWAYS_EXCLUDED = new Set([...DEPRECATED_LEGACY, ...UNAVAILABLE, ...EXCLUDED_NOW]);

/** Check if a model should be excluded based on the current date */
export function isModelExcluded(id: string): boolean {
  if (ALWAYS_EXCLUDED.has(id)) return true;

  if (DEPRECATING_MAY_2026.has(id)) {
    return Date.now() >= MAY_29_2026;
  }

  return false;
}

/** Get a notice for a model if it's deprecating soon */
export function getModelNotice(id: string): string | null {
  if (DEPRECATING_MAY_2026.has(id) && Date.now() < MAY_29_2026) {
    return "Deprecating Soon";
  }
  return null;
}

/** Maps error codes to their excluded model IDs */
export const EXCLUDED_BY_ERROR: Record<string, string[]> = {
  "5028": DEPRECATED_LEGACY,
};
