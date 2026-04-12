import { useEffect, useRef, useState } from "react";
import type { Model } from "../hooks/useModels";
import type { StorageMode } from "../storage";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  storageMode: StorageMode;
  onStorageModeChange: (mode: StorageMode) => void;
  defaultModel: string;
  onDefaultModelChange: (model: string) => void;
  systemPrompt: string;
  onSystemPromptChange: (prompt: string) => void;
  models: Model[];
  onClearConversations: (mode: StorageMode) => void;
}

export default function SettingsModal({
  open,
  onClose,
  storageMode,
  onStorageModeChange,
  defaultModel,
  onDefaultModelChange,
  systemPrompt,
  onSystemPromptChange,
  models,
  onClearConversations,
}: SettingsModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Local draft state — only committed on Save
  const [draftStorageMode, setDraftStorageMode] = useState<StorageMode>(storageMode);
  const [draftModel, setDraftModel] = useState(defaultModel);
  const [draftSystemPrompt, setDraftSystemPrompt] = useState(systemPrompt);

  // Sync draft with props when modal opens
  useEffect(() => {
    if (open) {
      setDraftStorageMode(storageMode);
      setDraftModel(defaultModel);
      setDraftSystemPrompt(systemPrompt);
    }
  }, [open, storageMode, defaultModel, systemPrompt]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleCancel();
    };
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  if (!open) return null;

  const handleSave = () => {
    onStorageModeChange(draftStorageMode);
    onDefaultModelChange(draftModel);
    onSystemPromptChange(draftSystemPrompt);
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) handleCancel(); }}
    >
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-xl mx-4 overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 shrink-0">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Settings</h2>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-8">

          {/* Preferences */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-600 mb-4">
              Preferences
            </h3>
            <div className="space-y-5">

              {/* Storage mode */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Storage
                </label>
                <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  {(["cloud", "local"] as StorageMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setDraftStorageMode(mode)}
                      className={`flex-1 py-2 text-sm font-medium transition-colors ${
                        draftStorageMode === mode
                          ? "bg-indigo-600 text-white"
                          : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                      }`}
                    >
                      {mode === "cloud" ? "☁️ Cloud (D1)" : "💾 Local (Browser)"}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-600">
                  {draftStorageMode === "cloud"
                    ? "Conversations saved to Cloudflare D1. Persists across devices."
                    : "Conversations saved in your browser. Never leaves your device."}
                </p>
              </div>

              {/* Default model */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Default Model
                </label>
                <select
                  value={draftModel}
                  onChange={(e) => setDraftModel(e.target.value)}
                  className="w-full text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-700 dark:text-gray-300 outline-none focus:border-indigo-500 transition-colors"
                >
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              {/* System prompt */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  System Prompt
                </label>
                <textarea
                  value={draftSystemPrompt}
                  onChange={(e) => setDraftSystemPrompt(e.target.value)}
                  placeholder="You are a helpful assistant..."
                  rows={4}
                  className="w-full text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:border-indigo-500 transition-colors resize-none"
                />
                <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-600">
                  Applied to all new conversations.
                </p>
              </div>
            </div>
          </section>

          {/* Conversations */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-600 mb-4">
              Conversations
            </h3>
            <div className="space-y-3">

              {/* Cloud */}
              <div className="flex items-center justify-between py-3 px-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">☁️ Cloud (D1)</p>
                  <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">Stored in Cloudflare D1</p>
                </div>
                <button
                  onClick={() => {
                    if (confirm("Delete all cloud conversations? This cannot be undone.")) {
                      onClearConversations("cloud");
                    }
                  }}
                  className="text-xs font-medium text-red-500 hover:text-red-600 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg px-3 py-1.5 transition-colors"
                >
                  Clear
                </button>
              </div>

              {/* Local */}
              <div className="flex items-center justify-between py-3 px-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">💾 Local (Browser)</p>
                  <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">Stored in browser localStorage</p>
                </div>
                <button
                  onClick={() => {
                    if (confirm("Delete all local conversations? This cannot be undone.")) {
                      onClearConversations("local");
                    }
                  }}
                  className="text-xs font-medium text-red-500 hover:text-red-600 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg px-3 py-1.5 transition-colors"
                >
                  Clear
                </button>
              </div>

            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex gap-3 shrink-0">
          <button
            onClick={handleCancel}
            className="flex-1 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
