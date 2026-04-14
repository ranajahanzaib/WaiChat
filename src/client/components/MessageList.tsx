import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { Message } from "../storage";

interface MessageListProps {
  messages: Message[];
  isStreaming: boolean;
}

export default function MessageList({ messages, isStreaming }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleCopy = async (id: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
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
                  ul: ({ children }) => (
                    <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>
                  ),
                }}
              >
                {m.content}
              </ReactMarkdown>
            ) : (
              <p className="whitespace-pre-wrap">{m.content}</p>
            )}

            {/* Show streaming indicator OR model attribution */}
            {m.role === "assistant" && (
              isStreaming && m.content === "" ? (
                <span className="inline-flex gap-1 mt-2">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                </span>
              ) : (
                m.model && (
                  <div className="mt-3 text-[10px] text-gray-400 dark:text-gray-500 font-mono tracking-wide uppercase">
                    {m.model.split('/').pop()}
                  </div>
                )
              )
            )}
          </div>

          {/* Copy Button */}
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
