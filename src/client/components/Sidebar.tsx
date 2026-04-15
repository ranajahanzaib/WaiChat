import { useState } from "react";
import type { Conversation, StorageMode } from "../storage";
import ConfirmModal from "./ConfirmModal";

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  onNew: (mode?: StorageMode) => void;
  onDelete: (id: string) => void;
  onSettingsOpen: () => void;
  currentMode: StorageMode;
  savedMode: StorageMode;
}

export default function Sidebar({
  conversations,
  activeId,
  isOpen,
  onClose,
  onSelect,
  onNew,
  onDelete,
  onSettingsOpen,
  currentMode,
  savedMode,
}: SidebarProps) {
  const [pendingDelete, setPendingDelete] = useState<Conversation | null>(null);

  return (
    <>
      <aside
        className={`absolute md:relative z-30 flex flex-col w-64 h-screen bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 shrink-0 transition-all duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full md:-ml-64"
        }`}
      >
        {/* Explicit split-button flow to the Sidebar for "New Chat" actions when a user views a deep link
          that differs from their saved default storage mode. The user can now seamlessly opt to return to
          their default workspace or explicitly create a new chat in the temporary storage mode they are viewing,
          preventing accidental database pollution. */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex flex-col gap-2">
          {currentMode === savedMode ? (
            <button
              onClick={() => onNew(currentMode)}
              className="w-full py-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
            >
              New Chat
            </button>
          ) : (
            <>
              <button
                onClick={() => onNew(savedMode)}
                className="w-full py-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
                title={`Return to your default ${savedMode} workspace`}
              >
                New Chat in {savedMode === "cloud" ? "☁️ Cloud" : "💾 Local"}
              </button>
              <button
                onClick={() => onNew(currentMode)}
                className="w-full py-2 px-4 rounded-lg bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium transition-colors"
                title={`Create a new chat in the current temporary ${currentMode} workspace`}
              >
                New Chat in {currentMode === "cloud" ? "☁️ Cloud" : "💾 Local"}
              </button>
            </>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.length === 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-600 text-center mt-8">
              No conversations yet
            </p>
          )}
          {conversations.map((c) => (
            <div
              key={c.id}
              className={`group flex items-center justify-between rounded-lg px-3 py-2 cursor-pointer text-sm transition-colors ${
                activeId === c.id
                  ? "bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
              onClick={() => onSelect(c.id)}
            >
              <span className="truncate">{c.title}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPendingDelete(c);
                }}
                className="p-1 rounded-md md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 focus-visible:ring-2 focus-visible:ring-red-500 focus:outline-none text-gray-400 cursor-pointer md:hover:text-red-500 active:text-red-500 transition-all ml-2 shrink-0"
                aria-label="Delete conversation"
              >
                ✕
              </button>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <p className="text-base text-gray-400 dark:text-gray-600">WaiChat</p>
          <div className="flex items-center gap-3">
            <button
              onClick={onSettingsOpen}
              className="text-base text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
              aria-label="Open settings"
            >
              ⚙️
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer flex items-center justify-center"
              aria-label="Close sidebar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      <ConfirmModal
        open={pendingDelete !== null}
        title="Delete conversation?"
        description={pendingDelete ? `"${pendingDelete.title}" will be permanently deleted.` : ""}
        confirmLabel="Delete"
        onConfirm={() => {
          if (pendingDelete) onDelete(pendingDelete.id);
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
