"use client";
/**
 * ChatSection — AI concierge chat panel.
 *
 * Uses @ai-sdk/react useChat (v6 API):
 *   - No built-in `input`/`handleInputChange`/`handleSubmit`
 *   - `sendMessage({ text: string })` sends a message
 *   - `status: 'submitted' | 'streaming' | 'ready' | 'error'` for loading state
 *   - `messages: UIMessage[]` — each message has `.role` and `.parts`
 *   - Parts are typed: { type: 'text', text: string } etc.
 *
 * /api/chat returns a UI message stream (toUIMessageStreamResponse()), so we use
 * DefaultChatTransport to decode it. Extra body fields (outOfQuota) are passed
 * via the transport's `body` option.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  getQuestionsRemaining,
  recordQuestion,
  MAX_QUESTIONS_PER_DAY,
  OUT_OF_QUOTA_MESSAGE,
} from "@/lib/rate-limit";

/** Extract plain text from a UIMessage's parts array. */
function getMessageText(
  parts: Array<{ type: string; text?: string }>
): string {
  return parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

export default function ChatSection() {
  // Track questions remaining in local state so UI updates on send.
  // Lazy initializer: runs only on mount (client-side), reads localStorage once.
  const [remaining, setRemaining] = useState<number>(() =>
    getQuestionsRemaining()
  );

  // Input is managed manually (v6 useChat has no built-in input helper)
  const [inputText, setInputText] = useState<string>("");

  // Ref for the messages container so we can auto-scroll
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Whether the guest is out of questions right now
  const outOfQuota = remaining <= 0;

  // Set up the chat. /api/chat returns a UI message stream so we use DefaultChatTransport.
  // We pass outOfQuota in the body so the server can short-circuit gracefully.
  // body is an object merged into the POST body alongside `messages`.
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { outOfQuota },
    }),
  });

  const isLoading = status === "submitted" || status === "streaming";

  // Auto-scroll to the latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isLoading || outOfQuota) return;

    // Record question before sending so the UI updates immediately
    const newRemaining = recordQuestion();
    setRemaining(newRemaining);
    setInputText("");

    await sendMessage({ text });
  }, [inputText, isLoading, outOfQuota, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Send on Enter (not Shift+Enter)
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleSend();
      }
    },
    [handleSend]
  );

  return (
    <section className="chat-section" aria-label="Concierge chat">
      {/* Header */}
      <div className="chat-section__header">
        <h2 className="chat-section__title">Ask your concierge</h2>
        <p className="chat-section__subtitle">
          Answers from your local guide — neighborhood experts only!
        </p>
      </div>

      {/* Questions-left indicator */}
      <div className="quota-indicator" aria-label={`${remaining} of ${MAX_QUESTIONS_PER_DAY} questions remaining today`}>
        <div className="quota-pips" aria-hidden="true">
          {Array.from({ length: MAX_QUESTIONS_PER_DAY }, (_, i) => (
            <span
              key={i}
              className={`quota-pip${i >= remaining ? " quota-pip--empty" : ""}`}
            />
          ))}
        </div>
        <span className={`quota-text${outOfQuota ? " quota-text--zero" : ""}`}>
          {outOfQuota
            ? "No questions left today"
            : `${remaining} of ${MAX_QUESTIONS_PER_DAY} questions left today`}
        </span>
      </div>

      {/* Messages */}
      <div className="chat-messages" aria-live="polite" aria-label="Conversation">
        {messages.length === 0 && (
          <p style={{ fontSize: "0.82rem", color: "#aaa", textAlign: "center", padding: "0.5rem 0" }}>
            Ask anything about the neighborhood, WiFi, or your stay!
          </p>
        )}

        {messages
          .filter((m) => m.role !== "system")
          .map((m) => (
            <div
              key={m.id}
              className={`chat-message chat-message--${m.role}`}
            >
              <div className="chat-message__avatar" aria-hidden="true">
                {m.role === "user" ? "👤" : "🏡"}
              </div>
              <div
                className="chat-message__bubble"
                aria-label={`${m.role === "user" ? "You" : "Concierge"}: ${getMessageText(m.parts as Array<{ type: string; text?: string }>)}`}
              >
                {getMessageText(m.parts as Array<{ type: string; text?: string }>)}
              </div>
            </div>
          ))}

        {/* Typing indicator */}
        {isLoading && (
          <div className="chat-message chat-message--assistant" aria-label="Concierge is typing">
            <div className="chat-message__avatar" aria-hidden="true">🏡</div>
            <div className="chat-message__bubble">
              <div className="typing-indicator">
                <span className="typing-indicator__dot" />
                <span className="typing-indicator__dot" />
                <span className="typing-indicator__dot" />
              </div>
            </div>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="chat-input-area">
        {outOfQuota ? (
          <div className="out-of-quota-msg" role="status">
            {OUT_OF_QUOTA_MESSAGE}
          </div>
        ) : (
          <div className="chat-input-row">
            <label htmlFor="chat-input" className="visually-hidden">
              Ask a question
            </label>
            <textarea
              id="chat-input"
              ref={inputRef}
              className="chat-input"
              placeholder="Ask about the neighborhood, WiFi, things to do…"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              rows={1}
              aria-label="Ask a question"
            />
            <button
              type="button"
              className="chat-send-btn"
              onClick={() => void handleSend()}
              disabled={isLoading || !inputText.trim()}
              aria-label="Send message"
            >
              ↑
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
