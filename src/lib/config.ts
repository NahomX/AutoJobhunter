/**
 * Model selection helper — the ONE place that decides which AI provider + model to use.
 *
 * Dev:  set MODEL_PROVIDER=ollama (default) — routes to a local Ollama instance.
 * Prod: set MODEL_PROVIDER=anthropic and ANTHROPIC_API_KEY — routes to Claude Haiku.
 *       Change ANTHROPIC_MODEL to swap to a different Claude model if needed.
 *
 * This module is SERVER-ONLY. Never import it in a client component.
 * The API key is read exclusively from process.env so it is never bundled client-side.
 *
 * To swap dev → prod: change MODEL_PROVIDER from "ollama" to "anthropic" in your
 * deployment environment variables. Zero code changes required.
 */

import { createOllama } from "ollama-ai-provider-v2";
import { anthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

/**
 * Returns the configured language model for the current environment.
 *
 * Configuration (set in .env.local or deployment secrets):
 *   MODEL_PROVIDER=ollama      → uses OLLAMA_MODEL at OLLAMA_BASE_URL
 *   MODEL_PROVIDER=anthropic   → uses ANTHROPIC_MODEL with ANTHROPIC_API_KEY
 */
export function getLanguageModel(): LanguageModel {
  const provider = process.env.MODEL_PROVIDER ?? "ollama";

  if (provider === "anthropic") {
    // Production path: Claude Haiku via Anthropic API.
    // ANTHROPIC_API_KEY is read automatically by @ai-sdk/anthropic from process.env.
    const model = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5";
    return anthropic(model);
  }

  // Default / dev path: local Ollama instance.
  // createOllama accepts provider-level settings (baseURL); the returned provider
  // is then called with the model name to get the LanguageModel instance.
  const baseURL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
  const model = process.env.OLLAMA_MODEL ?? "llama3.2";
  const ollamaProvider = createOllama({ baseURL });

  return ollamaProvider(model);
}
