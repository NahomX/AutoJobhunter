/**
 * Contract B — /api/chat streaming route.
 *
 * Receives: POST { messages: UIMessage[], outOfQuota?: boolean }
 * Returns:  a UI message stream response compatible with the AI SDK useChat hook.
 *
 * ─── Model swap (dev → prod) ────────────────────────────────────────────────
 * The model is selected by getLanguageModel() in src/lib/config.ts.
 *   • MODEL_PROVIDER=ollama  (default / dev)  → local Ollama instance
 *   • MODEL_PROVIDER=anthropic (prod)          → Claude Haiku via ANTHROPIC_API_KEY
 * Change only the env var in your deployment secrets — zero code changes needed.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * ─── Out-of-quota path ──────────────────────────────────────────────────────
 * The daily rate limit is soft/client-side (localStorage, see src/lib/rate-limit.ts).
 * As a defensive server-side cooperation measure, if the client signals
 * `outOfQuota: true` in the POST body, the route returns the warm
 * OUT_OF_QUOTA_MESSAGE without making any model call.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * ─── AI SDK v6 API notes ────────────────────────────────────────────────────
 * • useChat sends UIMessage[] (not the old CoreMessage[]).
 * • convertToModelMessages() converts UIMessage[] → ModelMessage[] (async in v6).
 * • streamText().toUIMessageStreamResponse() produces the SSE envelope that
 *   useChat's default HttpChatTransport consumes.
 * • For the out-of-quota path, createUIMessageStream + createUIMessageStreamResponse
 *   lets us emit a single synthetic assistant text message without a model call.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * export const runtime = 'nodejs' is required: Ollama uses native HTTP which
 * is not available in the Edge runtime.
 */

import {
  streamText,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
} from "ai";
import type { UIMessage } from "ai";
import { getLanguageModel } from "@/lib/config";
import { buildSystemPrompt } from "@/lib/system-prompt";
import { buildTools } from "@/lib/tools";
import { OUT_OF_QUOTA_MESSAGE } from "@/lib/rate-limit";
import guideData from "@/data/guide.json";
import type { Guide } from "@/lib/guide";

export const runtime = "nodejs";

// Cast the imported JSON to the shared Guide type (validated by TypeScript).
const guide = guideData as Guide;

// Build the system prompt once at module load — it's derived purely from the
// static guide.json so it never changes at runtime.
const SYSTEM_PROMPT = buildSystemPrompt(guide);

// Build the tool set once at module load — tools are also guide-derived.
// Each request passes the same tools instance to streamText.
const tools = buildTools(guide);

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json()) as {
    messages: UIMessage[];
    outOfQuota?: boolean;
  };
  const { messages, outOfQuota } = body;

  // ── Out-of-quota cooperative path ─────────────────────────────────────────
  // If the client signals the guest has exhausted today's questions, return
  // the warm "back tomorrow" message WITHOUT making a model call.
  // This saves API costs and keeps the UX consistent with the client-side cap.
  if (outOfQuota === true) {
    // Use createUIMessageStream to emit a single assistant text message as a
    // proper UI message stream that useChat can consume.
    const stream = createUIMessageStream({
      execute({ writer }) {
        // Write the start marker, a text part, and the finish marker.
        writer.write({ type: "start", messageId: "quota-msg" });
        writer.write({ type: "text-start", id: "quota-text" });
        writer.write({ type: "text-delta", id: "quota-text", delta: OUT_OF_QUOTA_MESSAGE });
        writer.write({ type: "text-end", id: "quota-text" });
        writer.write({ type: "finish" });
      },
    });
    return createUIMessageStreamResponse({ stream });
  }

  // ── Normal path — stream from the model ───────────────────────────────────
  // AI SDK v6: convertToModelMessages converts UIMessage[] (what useChat sends)
  // into the ModelMessage[] that streamText accepts.  It is async in v6.
  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    // Model selection: Ollama in dev, Claude Haiku in prod.
    // Change MODEL_PROVIDER env var to swap — no code changes needed.
    model: getLanguageModel(),
    system: SYSTEM_PROMPT,
    messages: modelMessages,

    // Wire the directions tool so the model can emit Google Maps links.
    // AI SDK executes the tool's `execute` function server-side and
    // returns the result as a tool message before the model continues.
    tools,
  });

  // toUIMessageStreamResponse() produces the SSE envelope that the AI SDK
  // useChat hook (HttpChatTransport) consumes on the client.
  // NOTE: toTextStreamResponse() is NOT compatible with useChat in v6.
  return result.toUIMessageStreamResponse();
}
