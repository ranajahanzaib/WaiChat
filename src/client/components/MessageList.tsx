import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { Message } from "../storage";

interface MessageListProps {
  messages: Message[];
  isStreaming: boolean;
  onSelectPrompt: (prompt: string) => void;
  onRetry?: (messageId: string) => void;
  activeVersions: Record<string, string>;
  onVersionChange?: (parentId: string, messageId: string) => void;
}

function ThoughtParser({ content }: { content: string }) {
  const [elapsed, setElapsed] = useState(0);
  const [copied, setCopied] = useState(false);

  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("waichat:thought-open") !== "false";
    }
    return true;
  });

  const THINK_START = "<think>";
  const THINK_END = "</think>";
  const lowerContent = content.toLowerCase();
  const thinkStartIndex = lowerContent.indexOf(THINK_START);
  const thinkEndIndex = lowerContent.indexOf(THINK_END);

  const hasThought = thinkStartIndex !== -1;
  const isThinking = hasThought && thinkEndIndex === -1;

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isThinking) {
      interval = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isThinking]);

  if (!hasThought) {
    return <MarkdownRenderer content={content} />;
  }

  const precedingContent = content.substring(0, thinkStartIndex).trim();

  const thoughtContent = isThinking
    ? content.substring(thinkStartIndex + THINK_START.length).trim()
    : content.substring(thinkStartIndex + THINK_START.length, thinkEndIndex).trim();

  const remainingContent = isThinking
    ? ""
    : content.substring(thinkEndIndex + THINK_END.length).trim();

  // Handlers
  const handleCopyThought = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevents the <details> block from toggling when clicking the button
    try {
      await navigator.clipboard.writeText(thoughtContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy thought: ", err);
    }
  };

  const handleToggle = (e: React.SyntheticEvent<HTMLDetailsElement>) => {
    const newState = e.currentTarget.open;
    setIsOpen(newState);
    if (typeof window !== "undefined") {
      localStorage.setItem("waichat:thought-open", String(newState));
    }
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Render any text that the model output before the <think> block */}
      {precedingContent && <MarkdownRenderer content={precedingContent} />}

      <details
        open={isOpen}
        onToggle={handleToggle}
        className="group border-[0.5px] border-black/10 dark:border-white/10 rounded-lg bg-black/5 dark:bg-white/5"
      >
        <summary className="flex items-center gap-2 px-4 py-2.5 cursor-pointer text-[13px] md:text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-white/65 dark:hover:text-white/95 select-none list-none">
          <svg
            className="w-5 h-5 transition-transform group-open:rotate-90"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>

          <span className="flex-1">
            {isThinking ? "Thinking..." : "Thought Process"}
            {/* Only show the timer if it actually counted (live), hide for historical DB loads */}
            {/*
              TODO: For better accuracy, move thinking time measurement to the backend (Cloudflare Worker).
              Record <think>...</think> stream `start_time` and `end_time` and save the duration to a `thought_duration` column in D1/local DB.
            */}
            {!isThinking && elapsed > 0 && (
              <span className="ml-2 font-normal opacity-70">({elapsed}s)</span>
            )}
          </span>

          {isThinking ? (
            <span className="flex gap-1 ml-1">
              <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-white/40 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-white/40 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-white/40 rounded-full animate-bounce [animation-delay:300ms]" />
            </span>
          ) : (
            <button
              onClick={handleCopyThought}
              className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-xs uppercase tracking-wider px-2.5 py-1 rounded bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          )}
        </summary>
        <div className="px-4 pb-4 pt-2 text-xs md:text-sm text-gray-600 dark:text-white/65 whitespace-pre-wrap border-t-[0.5px] border-black/10 dark:border-white/10 italic leading-relaxed">
          {thoughtContent}
        </div>
      </details>

      {/* Render the actual markdown response below the thought block */}
      {remainingContent && <MarkdownRenderer content={remainingContent} />}
    </div>
  );
}

// Extracted Markdown renderer
function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        code: ({ children, className }) => {
          const isBlock = className?.includes("language-");
          return isBlock ? (
            <pre className="bg-gray-100/80 border-[0.5px] border-black/10 text-gray-900 dark:bg-[#141416]/80 dark:border-white/10 dark:text-white/95 rounded-lg p-4 overflow-x-auto my-3 text-sm">
              <code>{children}</code>
            </pre>
          ) : (
            <code className="bg-black/5 dark:bg-white/10 rounded px-1.5 py-0.5 text-sm font-mono text-[#0A84FF]">
              {children}
            </code>
          );
        },
        p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
        ul: ({ children }) => (
          <ul className="list-disc list-inside mb-3 space-y-1.5">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside mb-3 space-y-1.5">{children}</ol>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

interface DisplayItem {
  type: "user";
  message: Message;
}

interface AssistantGroup {
  type: "assistant";
  parentId: string;
  siblings: Message[];
  activeMessage: Message;
  activeIndex: number;
}

type DisplayEntry = DisplayItem | AssistantGroup;

export default function MessageList({
  messages,
  isStreaming,
  onSelectPrompt,
  onRetry,
  activeVersions,
  onVersionChange,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isUserScrolled = useRef(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Keep track of how many message blocks exist
  const prevMessageCount = useRef(messages.length);

  // Build the display list: group assistant siblings together
  const displayItems = useMemo((): DisplayEntry[] => {
    const items: DisplayEntry[] = [];
    // Map: parentId -> list of sibling messages (including the original)
    const siblingMap = new Map<string, Message[]>();

    // First pass: identify all siblings and group them
    for (const m of messages) {
      if (m.role === "assistant" && m.parent_id) {
        const group = siblingMap.get(m.parent_id) || [];
        group.push(m);
        siblingMap.set(m.parent_id, group);
      }
    }

    // Track which parentIds we've already rendered
    const rendered = new Set<string>();

    for (const m of messages) {
      if (m.role === "user") {
        items.push({ type: "user", message: m });
        continue;
      }

      // Assistant message
      if (m.parent_id) {
        // This is a retry sibling - skip it, it'll be rendered as part of the parent's group
        if (!rendered.has(m.parent_id)) {
          // Edge case: the parent might not exist in messages (shouldn't happen, but be safe)
          // We'll handle it when we encounter the parent
        }
        continue;
      }

      // Original assistant message (no parent_id)
      const parentId = m.id;

      if (rendered.has(parentId)) continue;
      rendered.add(parentId);

      const retrySiblings = siblingMap.get(parentId) || [];
      const allSiblings = [m, ...retrySiblings];

      // Determine active version
      const explicitActive = activeVersions[parentId];
      let activeMessage: Message;
      let activeIndex: number;

      if (explicitActive) {
        const idx = allSiblings.findIndex((s) => s.id === explicitActive);
        if (idx >= 0) {
          activeMessage = allSiblings[idx];
          activeIndex = idx;
        } else {
          // Fallback to latest
          activeMessage = allSiblings[allSiblings.length - 1];
          activeIndex = allSiblings.length - 1;
        }
      } else {
        // Default to latest
        activeMessage = allSiblings[allSiblings.length - 1];
        activeIndex = allSiblings.length - 1;
      }

      items.push({
        type: "assistant",
        parentId,
        siblings: allSiblings,
        activeMessage,
        activeIndex,
      });
    }

    return items;
  }, [messages, activeVersions]);

  // Detects when the user scrolls away from the bottom
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;

    const distanceToBottom = scrollHeight - scrollTop - clientHeight;

    // If the user is more than 20px away from the bottom, they scrolled up. Lock auto-scroll.
    isUserScrolled.current = distanceToBottom > 20;
  };

  useEffect(() => {
    // If a brand new message block was added, a new turn just started.
    // This safely catches both new user prompts and model retries.
    if (messages.length > prevMessageCount.current) {
      isUserScrolled.current = false; // Break the lock!
    }

    // Update the ref for the next render
    prevMessageCount.current = messages.length;

    // Scroll down if we aren't locked
    if (!isUserScrolled.current) {
      bottomRef.current?.scrollIntoView({ behavior: "auto" });
    }
  }, [messages]);

  const handleCopy = async (id: string, content: string) => {
    // Strip <think> tags (even unclosed ones) before copying to clipboard
    const cleanContent = content.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, "").trim();

    try {
      await navigator.clipboard.writeText(cleanContent);
      setCopiedId(id);
      setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  // Pre-calculate the index of the last assistant entry to avoid O(N²) lookups
  const lastAssistantIndex = useMemo(() => {
    for (let i = displayItems.length - 1; i >= 0; i--) {
      if (displayItems[i].type === "assistant") return i;
    }
    return -1;
  }, [displayItems]);

  // Empty State Hero Design
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto w-full">
        <img width="100" height="100" src="/waichat.webp" alt="WaiChat Logo" className="m-4" />
        <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 dark:text-white/95 tracking-tight text-center mb-3">
          Let's explore an idea.
        </h1>
        <p className="text-sm md:text-base text-gray-600 dark:text-white/65 text-center mb-12 max-w-[450px] leading-relaxed">
          Lightning-fast AI at the edge. Powered by Cloudflare for limitless, zero-latency
          conversations.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full max-w-[800px] mb-10">
          <button
            type="button"
            onClick={() =>
              onSelectPrompt(
                "Can you help me refactor this code snippet to be more efficient and readable?\n\n[Paste code here]",
              )
            }
            className="bg-white/60 dark:bg-white/5 border-[0.5px] border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20 hover:bg-white/80 dark:hover:bg-white/10 rounded-xl p-5 text-left cursor-pointer backdrop-blur-md transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(0,0,0,0.05)] dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.15)]"
          >
            <div className="text-[#0A84FF] mb-4">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                className="w-6 h-6 stroke-[1.5]"
              >
                <polyline points="16 18 22 12 16 6"></polyline>
                <polyline points="8 6 2 12 8 18"></polyline>
              </svg>
            </div>
            <div className="text-[15px] md:text-base font-medium text-gray-900 dark:text-white/95 mb-1.5">
              Refactor Code
            </div>
            <div className="text-xs md:text-sm text-gray-500 dark:text-white/40 leading-relaxed">
              Debug, explain, or improve your programming snippets.
            </div>
          </button>
          <button
            type="button"
            onClick={() =>
              onSelectPrompt(
                "Please provide a concise summary of the following text, highlighting the key takeaways:\n\n[Paste text here]",
              )
            }
            className="bg-white/60 dark:bg-white/5 border-[0.5px] border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20 hover:bg-white/80 dark:hover:bg-white/10 rounded-xl p-5 text-left cursor-pointer backdrop-blur-md transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(0,0,0,0.05)] dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.15)]"
          >
            <div className="text-[#0A84FF] mb-4">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                className="w-6 h-6 stroke-[1.5]"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
            </div>
            <div className="text-[15px] md:text-base font-medium text-gray-900 dark:text-white/95 mb-1.5">
              Summarize Texts
            </div>
            <div className="text-xs md:text-sm text-gray-500 dark:text-white/40 leading-relaxed">
              Quickly distill long documents or articles down to the essentials.
            </div>
          </button>
          <button
            type="button"
            onClick={() =>
              onSelectPrompt(
                "I'm curious about [Topic]. Can you explain the core concepts and why they matter?",
              )
            }
            className="bg-white/60 dark:bg-white/5 border-[0.5px] border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20 hover:bg-white/80 dark:hover:bg-white/10 rounded-xl p-5 text-left cursor-pointer backdrop-blur-md transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(0,0,0,0.05)] dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.15)]"
          >
            <div className="text-[#0A84FF] mb-4">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                className="w-6 h-6 stroke-[1.5]"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="2" y1="12" x2="22" y2="12"></line>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
              </svg>
            </div>
            <div className="text-[15px] md:text-base font-medium text-gray-900 dark:text-white/95 mb-1.5">
              Explore Concepts
            </div>
            <div className="text-xs md:text-sm text-gray-500 dark:text-white/40 leading-relaxed">
              Dive into science, physics, history, or anything else you're curious about.
            </div>
          </button>
        </div>
      </div>
    );
  }


  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-black/10 dark:[&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full"
    >
      {displayItems.map((item, idx) => {
        if (item.type === "user") {
          const m = item.message;
          return (
            <div key={m.id} className="group flex flex-col items-end">
              <div className="max-w-[85%] md:max-w-[75%] rounded-[20px] px-5 py-4 text-[15px] md:text-base leading-relaxed bg-[#0A84FF] text-white rounded-br-sm">
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
              {m.content && (
                <button
                  onClick={() => handleCopy(m.id, m.content)}
                  className="mt-2 px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-gray-600 dark:text-white/40 dark:hover:text-white/80 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 transition-opacity flex items-center gap-1.5 cursor-pointer"
                  aria-label="Copy message"
                >
                  {copiedId === m.id ? (
                    <>
                      <span className="text-[#34C759]">✓</span> Copied
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                      Copy
                    </>
                  )}
                </button>
              )}
            </div>
          );
        }

        // Assistant group
        const { parentId, siblings, activeMessage: m, activeIndex } = item;
        const totalVersions = siblings.length;
        const itemIndex = idx;
        const isCurrentlyStreaming = isStreaming && m.content === "" && itemIndex === lastAssistantIndex;

        return (
          <div key={parentId} className="group flex flex-col items-start">
            <div className="max-w-[85%] md:max-w-[75%] rounded-[20px] px-5 py-4 text-[15px] md:text-base leading-relaxed bg-white/60 dark:bg-white/5 border-[0.5px] border-black/10 dark:border-white/10 text-gray-900 dark:text-white/95 rounded-bl-sm backdrop-blur-md">
              {isCurrentlyStreaming ? (
                <span className="inline-flex gap-1 mt-2">
                  <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-white/40 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-white/40 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-white/40 rounded-full animate-bounce [animation-delay:300ms]" />
                </span>
              ) : (
                <ThoughtParser content={m.content} />
              )}

              {!isCurrentlyStreaming && m.model && (
                <div className="mt-3 text-xs text-gray-400 dark:text-white/40 capitalize">
                  {m.model.split("/").pop()?.replaceAll("-", " ")}
                </div>
              )}
            </div>

            {/* Action bar: version navigator + copy + retry */}
            <div className="mt-2 flex items-center gap-1 flex-wrap">
              {totalVersions > 1 && (
                <div className="flex items-center gap-0.5 mr-1">
                  <button
                    onClick={() => {
                      if (activeIndex > 0) {
                        onVersionChange?.(parentId, siblings[activeIndex - 1].id);
                      }
                    }}
                    disabled={activeIndex === 0}
                    className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 dark:text-white/40 dark:hover:text-white/80 disabled:opacity-30 disabled:cursor-default transition-colors cursor-pointer"
                    aria-label="Previous version"
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth="2.5"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <span className="text-xs text-gray-400 dark:text-white/40 font-medium tabular-nums min-w-[2.5rem] text-center select-none">
                    {activeIndex + 1} / {totalVersions}
                  </span>
                  <button
                    onClick={() => {
                      if (activeIndex < totalVersions - 1) {
                        onVersionChange?.(parentId, siblings[activeIndex + 1].id);
                      }
                    }}
                    disabled={activeIndex === totalVersions - 1}
                    className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 dark:text-white/40 dark:hover:text-white/80 disabled:opacity-30 disabled:cursor-default transition-colors cursor-pointer"
                    aria-label="Next version"
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth="2.5"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              )}

              {/* Copy button */}
              {m.content && (
                <button
                  onClick={() => handleCopy(m.id, m.content)}
                  className="px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-gray-600 dark:text-white/40 dark:hover:text-white/80 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 transition-opacity flex items-center gap-1.5 cursor-pointer"
                  aria-label="Copy message"
                >
                  {copiedId === m.id ? (
                    <>
                      <span className="text-[#34C759]">✓</span> Copied
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                      Copy
                    </>
                  )}
                </button>
              )}

              {/* Retry button */}
              {m.content && !isStreaming && onRetry && (
                <button
                  onClick={() => onRetry(m.id)}
                  className="px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-gray-600 dark:text-white/40 dark:hover:text-white/80 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 transition-opacity flex items-center gap-1.5 cursor-pointer"
                  aria-label="Retry response"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Retry
                </button>
              )}
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
