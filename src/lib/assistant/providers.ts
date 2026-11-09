/** Providers people can connect with their own API key. Safe to import from client components. */
export const OWN_KEY_PROVIDERS = ["openai", "anthropic", "google"] as const;
export type OwnKeyProvider = (typeof OWN_KEY_PROVIDERS)[number];

/** "free" is the shared OpenRouter setup that needs no key from the user. */
export const ASSISTANT_PROVIDERS = ["free", ...OWN_KEY_PROVIDERS] as const;
export type AssistantProvider = (typeof ASSISTANT_PROVIDERS)[number];

export const PROVIDER_INFO: Record<OwnKeyProvider, { name: string; company: string; model: string; keysUrl: string; placeholder: string }> = {
  openai: {
    name: "ChatGPT",
    company: "OpenAI",
    model: "gpt-6.1-terra",
    keysUrl: "https://platform.openai.com/api-keys",
    placeholder: "sk-...",
  },
  anthropic: {
    name: "Claude",
    company: "Anthropic",
    model: "claude-sonnet-5-5",
    keysUrl: "https://platform.claude.com/settings/keys",
    placeholder: "sk-ant-...",
  },
  google: {
    name: "Gemini",
    company: "Google",
    model: "gemini-3.8-flash",
    keysUrl: "https://aistudio.google.com/apikey",
    placeholder: "AIza...",
  },
};

export function isOwnKeyProvider(provider: string): provider is OwnKeyProvider {
  return (OWN_KEY_PROVIDERS as readonly string[]).includes(provider);
}
