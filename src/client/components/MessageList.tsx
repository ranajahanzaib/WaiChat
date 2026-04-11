import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import type { Message } from "../storage";

interface MessageListProps {
  messages: Message[];
  isStreaming: boolean;
}

export default function MessageList({
  messages,
  isStreaming,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
          className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
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
                  p: ({ children }) => (
                    <p className="mb-2 last:mb-0">{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc list-inside mb-2 space-y-1">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal list-inside mb-2 space-y-1">
                      {children}
                    </ol>
                  ),
                }}
              >
                {m.content}
              </ReactMarkdown>
            ) : (
              <p className="whitespace-pre-wrap">{m.content}</p>
            )}
            {m.role === "assistant" && isStreaming && m.content === "" && (
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </span>
            )}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
