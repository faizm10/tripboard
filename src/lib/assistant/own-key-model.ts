import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogle } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { ModelMessage } from "ai";
import type { OwnKeyProvider } from "@/lib/assistant/providers";

export function ownKeyModel(provider: OwnKeyProvider, apiKey: string, modelId: string) {
  switch (provider) {
    // GPT-6 models only call tools through the Responses API; Chat Completions answers 400.
    case "openai":
      return createOpenAI({ apiKey }).responses(modelId);
    case "anthropic":
      return createAnthropic({ apiKey })(modelId);
    case "google":
      return createGoogle({ apiKey })(modelId);
  }
}

const keyChecks: Record<OwnKeyProvider, (apiKey: string) => { url: string; headers: Record<string, string> }> = {
  openai: (apiKey) => ({ url: "https://api.openai.com/v1/models", headers: { Authorization: `Bearer ${apiKey}` } }),
  anthropic: (apiKey) => ({ url: "https://api.anthropic.com/v1/models", headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" } }),
  google: (apiKey) => ({ url: "https://generativelanguage.googleapis.com/v1beta/models", headers: { "x-goog-api-key": apiKey } }),
};

/**
 * Lists models with the key, which costs no tokens. Only a definite "this key
 * is invalid" returns false: a provider outage or a key restricted from
 * listing models shouldn't stop someone saving it. Google answers 400 for a bad key.
 */
export async function isKeyAccepted(provider: OwnKeyProvider, apiKey: string) {
  const { url, headers } = keyChecks[provider](apiKey);
  try {
    const response = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(8_000) });
    return !(response.status === 401 || (provider === "google" && response.status === 400));
  } catch {
    return true;
  }
}

/**
 * OpenAI stores responses by default and then refers back to them by id, which
 * breaks once portableHistory drops reasoning. Sending each turn in full also
 * keeps people's chats off their OpenAI account.
 */
export const ownKeyProviderOptions = { openai: { store: false } };

/** Provider error text can echo part of a key, so anything key-shaped is masked before logging. */
export function redactKeys(text: string) {
  return text.replace(/\b(sk-|AIza)[\w-]{8,}/g, "$1…");
}

/**
 * Makes a chat history safe to send to whichever provider is picked next.
 * Providers disagree on tool call ids (OpenAI caps the length, Anthropic limits
 * the characters), reject blank turns, and Anthropic and Gemini need the
 * conversation to open with a user turn, which trimming old messages can break.
 */
export function portableHistory(messages: ModelMessage[]): ModelMessage[] {
  const ids = new Map<string, string>();
  const portableId = (id: string) => {
    if (!ids.has(id)) ids.set(id, `call_${ids.size + 1}`);
    return ids.get(id)!;
  };

  const portable = messages.flatMap((message): ModelMessage[] => {
    if (message.role === "tool") {
      return [{ ...message, content: message.content.map((part) => (part.type === "tool-result" ? { ...part, toolCallId: portableId(part.toolCallId) } : part)) }];
    }
    if (message.role !== "assistant" || typeof message.content === "string") return [message];
    const content = message.content
      .filter((part) => part.type !== "reasoning" && !(part.type === "text" && !part.text.trim()))
      .map((part) => (part.type === "tool-call" ? { ...part, toolCallId: portableId(part.toolCallId) } : part));
    return content.length ? [{ ...message, content }] : [];
  });

  const firstUser = portable.findIndex((message) => message.role === "user");
  return firstUser > 0 ? portable.slice(firstUser) : portable;
}
