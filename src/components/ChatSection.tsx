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
  refundQuestion,
  MAX_QUESTIONS_PER_DAY,
  OUT_OF_QUOTA_MESSAGE,
} from "@/lib/rate-limit";

/** Warm, guest-facing copy shown when a concierge reply fails to come back. */
const CHAT_ERROR_MESSAGE =
  "Sorry — I couldn't reach the concierge just now. That one's on me, so it didn't " +
  "use up a question. Give it another try in a moment.";

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
  // Tracks whether the in-flight send was optimistically counted against quota,
  // so the slot is refunded exactly once if the request ultimately fails.
  const pendingChargedRef = useRef(false);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { outOfQuota },
    }),
    // Refund the optimistic quota charge when a send fails, so a failed
    // question never costs the guest a slot.
    onError: () => {
      if (pendingChargedRef.current) {
        pendingChargedRef.current = false;
        setRemaining(refundQuestion());
      }
    },
    // Send succeeded — keep the charge.
    onFinish: () => {
      pendingChargedRef.current = false;
    },
  });

  const isLoading = status === "submitted" || status === "streaming";
  const isError = status === "error";

  // Auto-scroll to the latest message (including the error bubble)
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, isError]);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isLoading || outOfQuota) return;

    // Record question before sending so the UI updates immediately.
    // Mark it pending so a failed send can refund the slot (see the status effect).
    const newRemaining = recordQuestion();
    setRemaining(newRemaining);
    pendingChargedRef.current = true;
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

        {/* Error bubble — surfaced when the concierge reply fails */}
        {isError && (
          <div
            className="chat-message chat-message--assistant chat-message--error"
            role="alert"
          >
            <div className="chat-message__avatar" aria-hidden="true">🏡</div>
            <div className="chat-message__bubble chat-message__bubble--error">
              {CHAT_ERROR_MESSAGE}
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
