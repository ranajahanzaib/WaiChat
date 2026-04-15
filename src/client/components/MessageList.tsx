import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { Message } from "../storage";

interface MessageListProps {
  messages: Message[];
  isStreaming: boolean;
}

// Helper component to parse and format <think>...</think> blocks
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
        className="group border border-gray-200 dark:border-gray-700 rounded-lg bg-white/50 dark:bg-black/20"
      >
        <summary className="flex items-center gap-2 px-4 py-2 cursor-pointer text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 select-none list-none">
          <svg
            className="w-4 h-4 transition-transform group-open:rotate-90"
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
            <span className="flex gap-0.5 ml-1">
              <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
            </span>
          ) : (
            <button
              onClick={handleCopyThought}
              className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          )}
        </summary>
        <div className="px-4 pb-3 pt-1 text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap border-t border-gray-100 dark:border-gray-800 italic">
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
            <pre className="bg-gray-900 dark:bg-black text-gray-100 rounded-lg p-3 overflow-x-auto my-2 text-xs">
              <code>{children}</code>
            </pre>
          ) : (
            <code className="bg-gray-200 dark:bg-gray-700 rounded px-1 py-0.5 text-xs font-mono">
              {children}
            </code>
          );
        },
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
        ol: ({ children }) => (
          <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export default function MessageList({ messages, isStreaming }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
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

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-600">
        <p className="text-sm">Send a message to get started</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {messages.map((m) => (
        <div
          key={m.id}
          className={`group flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
        >
          <div
            className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${
              m.role === "user"
                ? "bg-indigo-600 text-white rounded-br-sm"
                : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-sm"
            }`}
          >
            {m.role === "assistant" ? (
              <ThoughtParser content={m.content} />
            ) : (
              <p className="whitespace-pre-wrap">{m.content}</p>
            )}

            {/* Show streaming indicator OR model attribution */}
            {m.role === "assistant" &&
              (isStreaming && m.content === "" ? (
                <span className="inline-flex gap-1 mt-2">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                </span>
              ) : (
                m.model && (
                  <div className="mt-3 text-[10px] text-gray-400 dark:text-gray-500 font-mono tracking-wide uppercase">
                    {m.model.split("/").pop()}
                  </div>
                )
              ))}
          </div>

          {/* Master Message Copy Button */}
          {m.content && (
            <button
              onClick={() => handleCopy(m.id, m.content)}
              className="mt-1.5 px-2 py-1 text-[11px] font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 transition-opacity flex items-center gap-1 cursor-pointer"
              aria-label="Copy message"
            >
              {copiedId === m.id ? (
                <>
                  <span className="text-green-500 dark:text-green-400">✓</span> Copied
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
