import type { Model } from "../hooks/useModels";

interface ModelPickerProps {
  models: Model[];
  value: string;
  onChange: (model: string) => void;
  disabled?: boolean;
  className?: string;
}

export default function ModelPicker({
  models,
  value,
  onChange,
  disabled,
  className = "",
}: ModelPickerProps) {
  return (
    <div className={`relative flex items-center ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full appearance-none bg-transparent border-none py-0 pl-0 pr-5 outline-none cursor-pointer text-xs md:text-sm font-medium text-gray-700 dark:text-white/65 hover:text-gray-900 dark:hover:text-white/95 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:ring-0 truncate"
      >
        {models.map((m) => (
          <option
            key={m.id}
            value={m.id}
            // Style the native dropdown options to match the theme
            className="bg-white dark:bg-[#1e1e20] text-gray-900 dark:text-white/95 py-2 font-sans"
          >
            {m.name}
            {m.notice ? ` (${m.notice})` : ""}
          </option>
        ))}
      </select>

      {/* Custom native-feeling dropdown arrow to replace the default OS one */}
      <div className="absolute right-0 pointer-events-none text-gray-400 dark:text-white/40">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          className="w-3.5 h-3.5 stroke-[2.5]"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}
