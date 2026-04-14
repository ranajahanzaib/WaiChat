import type { Model } from "../hooks/useModels";

interface ModelPickerProps {
  models: Model[];
  value: string;
  onChange: (model: string) => void;
  disabled?: boolean;
}

export default function ModelPicker({ models, value, onChange, disabled }: ModelPickerProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full truncate text-sm bg-transparent border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-gray-700 dark:text-gray-300 outline-none cursor-pointer hover:border-gray-300 dark:hover:border-gray-600 transition-colors disabled:opacity-50"
    >
      {models.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </select>
  );
}
