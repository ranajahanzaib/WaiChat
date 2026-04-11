const MODELS = [
  { id: "@cf/meta/llama-3.1-8b-instruct", name: "Llama 3.1 8B" },
  { id: "@cf/mistral/mistral-7b-instruct-v0.2", name: "Mistral 7B" },
  { id: "@cf/qwen/qwen1.5-14b-chat-awq", name: "Qwen 1.5 14B" },
  {
    id: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
    name: "DeepSeek R1 32B",
  },
] as const;

interface ModelPickerProps {
  value: string;
  onChange: (model: string) => void;
  disabled?: boolean;
}

export default function ModelPicker({
  value,
  onChange,
  disabled,
}: ModelPickerProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="text-sm bg-transparent border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-gray-700 dark:text-gray-300 outline-none cursor-pointer hover:border-gray-300 dark:hover:border-gray-600 transition-colors disabled:opacity-50"
    >
      {MODELS.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </select>
  );
}
