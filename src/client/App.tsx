import { useEffect, useState, useRef } from "react";
import { useChat } from "./hooks/useChat";
import { useModels, DEFAULT_MODEL_ID } from "./hooks/useModels";
import type { StorageMode } from "./storage";
import Sidebar from "./components/Sidebar";
import MessageList from "./components/MessageList";
import ChatInput from "./components/ChatInput";
import ModelPicker from "./components/ModelPicker";
import SettingsModal from "./components/SettingsModal";

const STORAGE_MODE_KEY = "waichat:storage-mode";
const SYSTEM_PROMPT_KEY = "waichat:system-prompt";
const DEFAULT_MODEL_KEY = "waichat:default-model";
const MOBILE_BREAKPOINT = 768;

export default function App() {
  // Track the actual saved preference in localStorage separately
  const [savedStorageMode, setSavedStorageMode] = useState<StorageMode>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_MODE_KEY);
      return stored === "local" ? "local" : "cloud";
    }
    return "cloud";
  });

  // Check the URL for a forced storage mode first, fallback to localStorage
  const [storageMode, setStorageMode] = useState<StorageMode>(() => {
    if (typeof window !== "undefined") {
      const path = window.location.pathname;
      if (path.startsWith("/c/local/")) return "local";
      if (path.startsWith("/c/cloud/")) return "cloud";
    }
    return savedStorageMode;
  });

  const {
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
  } = useChat(storageMode);

  const { models } = useModels();
  const [model, setModel] = useState(
    () => localStorage.getItem(DEFAULT_MODEL_KEY) ?? DEFAULT_MODEL_ID,
  );
  const [systemPrompt, setSystemPrompt] = useState(
    () => localStorage.getItem(SYSTEM_PROMPT_KEY) ?? "",
  );
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Storage dropdown state for mobile-friendly click toggling
  const [storageDropdownOpen, setStorageDropdownOpen] = useState(false);

  // Sidebar state: Open by default on desktop, closed on mobile
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    return typeof window !== "undefined" ? window.innerWidth >= MOBILE_BREAKPOINT : true;
  });

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const initialLoadDone = useRef(false);

  // Safely parse the new URL format on initial render
  useEffect(() => {
    if (initialLoadDone.current) return;

    const path = window.location.pathname;
    if (path.startsWith("/c/")) {
      const parts = path.split("/");
      const mode = parts[2];
      const id = parts[3];

      if ((mode === "cloud" || mode === "local") && id) {
        selectConversation(id);
      } else {
        // Invalid path format, just go back home cleanly
        window.history.replaceState({}, "", "/");
      }
    }

    initialLoadDone.current = true;
  }, [selectConversation]);

  // Handle browser Back/Forward with cross-mode support
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path.startsWith("/c/")) {
        const parts = path.split("/");
        const mode = parts[2] as StorageMode;
        const id = parts[3];

        if ((mode === "cloud" || mode === "local") && id) {
          if (mode !== storageMode) {
            // If the user hits "Back" and it crosses into a different storage mode,
            // the safest way to re-initialize all hooks and state is a hard reload.
            window.location.reload();
            return;
          }
          selectConversation(id);
        } else {
          // Invalid URL format, act as if we hit home
          clearConversation();
          window.history.replaceState({}, "", "/");
        }
      } else {
        clearConversation();
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [selectConversation, clearConversation, storageMode]);

  // Update the URL format to include the storage mode
  useEffect(() => {
    const currentPath = window.location.pathname;
    if (activeConversation) {
      const expectedPath = `/c/${storageMode}/${activeConversation.id}`;
      if (currentPath !== expectedPath) {
        window.history.pushState({}, "", expectedPath);
      }
    } else if (currentPath !== "/") {
      window.history.pushState({}, "", "/");
    }
  }, [activeConversation, storageMode]);

  // Close storage dropdown when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest(".storage-dropdown-container")) {
        setStorageDropdownOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setStorageDropdownOpen(false);
    };

    if (storageDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [storageDropdownOpen]);

  const closeSidebarOnMobile = () => {
    if (window.innerWidth < MOBILE_BREAKPOINT) {
      setSidebarOpen(false);
    }
  };

  const handleSelectConversation = (id: string) => {
    selectConversation(id);
    closeSidebarOnMobile();
  };

  const handleStorageToggle = (next: StorageMode) => {
    setStorageMode(next);
    setSavedStorageMode(next); // Sync saved mode when manually toggled
    localStorage.setItem(STORAGE_MODE_KEY, next);
    setStorageDropdownOpen(false);
  };

  // Wrapper for new chat with mode support
  const handleNew = async (targetMode: StorageMode = storageMode) => {
    if (targetMode !== storageMode) {
      // User opted to return to their default mode. We toggle state and reset home.
      handleStorageToggle(targetMode);
      clearConversation();
      window.history.pushState({}, "", "/");
    } else {
      // Standard new chat in the current mode
      await newConversation(model);
    }
    closeSidebarOnMobile();
  };

  const handleSend = async (content: string) => {
    if (isStreaming) return;
    if (!activeConversation) {
      const convo = await newConversation(model);
      await sendMessage(content, model, convo.id, storageMode, systemPrompt);
    } else {
      await sendMessage(content, model, activeConversation.id, storageMode, systemPrompt);
    }
  };

  const handleDefaultModelChange = (m: string) => {
    setModel(m);
    localStorage.setItem(DEFAULT_MODEL_KEY, m);
  };

  const handleSystemPromptChange = (prompt: string) => {
    setSystemPrompt(prompt);
    localStorage.setItem(SYSTEM_PROMPT_KEY, prompt);
  };

  const handleClearConversations = async (mode: StorageMode) => {
    if (mode === "cloud") {
      await fetch("/api/conversations", { method: "DELETE" });
    } else {
      const keys = Object.keys(localStorage).filter(
        (k) => k.startsWith("waichat:conversations") || k.startsWith("waichat:messages:"),
      );
      keys.forEach((k) => localStorage.removeItem(k));
    }
    await loadConversations();
  };

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {/* Mobile Backdrop Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-20 md:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        conversations={conversations}
        activeId={activeConversation?.id ?? null}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSelect={handleSelectConversation}
        onNew={handleNew}
        onDelete={deleteConversation}
        onSettingsOpen={() => setSettingsOpen(true)}
        currentMode={storageMode}
        savedMode={savedStorageMode}
      />

      <main className="flex flex-col flex-1 min-w-0">
        <header className="flex items-center justify-between px-3 md:px-6 py-3 border-b border-gray-200 dark:border-gray-800 shrink-0 gap-2">
          <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none transition-colors shrink-0"
                aria-label="Open sidebar"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>
            )}
            <div className="flex-1 min-w-0">
              <ModelPicker
                models={models}
                value={model}
                onChange={handleDefaultModelChange}
                disabled={isStreaming}
              />
            </div>
          </div>

          <div className="relative storage-dropdown-container shrink-0">
            <button
              onClick={() => setStorageDropdownOpen(!storageDropdownOpen)}
              className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg px-2 md:px-3 py-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              aria-label="Toggle storage mode"
              aria-expanded={storageDropdownOpen}
              aria-haspopup="true"
            >
              <span className="text-base md:text-sm leading-none">
                {storageMode === "cloud" ? "☁️" : "💾"}
              </span>
              <span className="hidden md:inline">
                {storageMode === "cloud" ? "Cloud" : "Local"}
              </span>
              <svg className="hidden md:block w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
                <path d="M6 8L1 3h10z" />
              </svg>
            </button>

            <div
              role="menu"
              className={`absolute right-0 top-full mt-1 w-56 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden transition-all duration-200 z-10 origin-top-right ${
                storageDropdownOpen
                  ? "opacity-100 scale-100 visible"
                  : "opacity-0 scale-95 invisible"
              }`}
            >
              {(["cloud", "local"] as StorageMode[]).map((mode) => (
                <button
                  key={mode}
                  role="menuitem"
                  onClick={() => handleStorageToggle(mode)}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                    storageMode === mode ? "bg-indigo-50 dark:bg-indigo-950" : ""
                  }`}
                >
                  <span className="text-base mt-0.5">{mode === "cloud" ? "☁️" : "💾"}</span>
                  <div>
                    <p
                      className={`text-sm font-medium ${storageMode === mode ? "text-indigo-600 dark:text-indigo-400" : "text-gray-700 dark:text-gray-300"}`}
                    >
                      {mode === "cloud" ? "Cloud (D1)" : "Local (Browser)"}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">
                      {mode === "cloud"
                        ? "Syncs across devices via Cloudflare D1"
                        : "Stays in your browser, never uploaded"}
                    </p>
                  </div>
                  {storageMode === mode && (
                    <span className="ml-auto text-indigo-600 dark:text-indigo-400 text-xs mt-1">
                      ✓
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </header>

        {error && (
          <div className="mx-6 mt-4 px-4 py-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <MessageList messages={messages} isStreaming={isStreaming} />
        <ChatInput onSend={handleSend} disabled={isStreaming} />
      </main>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        storageMode={storageMode}
        onStorageModeChange={handleStorageToggle}
        defaultModel={model}
        onDefaultModelChange={handleDefaultModelChange}
        systemPrompt={systemPrompt}
        onSystemPromptChange={handleSystemPromptChange}
        models={models}
        onClearConversations={handleClearConversations}
      />
    </div>
  );
}
