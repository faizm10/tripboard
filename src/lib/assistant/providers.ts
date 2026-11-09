/** Providers people can connect with their own API key. Safe to import from client components. */
export const OWN_KEY_PROVIDERS = ["openai", "anthropic", "google"] as const;
export type OwnKeyProvider = (typeof OWN_KEY_PROVIDERS)[number];

/** "free" is the shared OpenRouter setup that needs no key from the user. */
export const ASSISTANT_PROVIDERS = ["free", ...OWN_KEY_PROVIDERS] as const;
export type AssistantProvider = (typeof ASSISTANT_PROVIDERS)[number];

export type ProviderModel = { id: string; label: string };

/** The first model in each list is the default. */
export const PROVIDER_INFO: Record<OwnKeyProvider, { name: string; company: string; models: ProviderModel[]; keysUrl: string; placeholder: string }> = {
  openai: {
    name: "ChatGPT",
    company: "OpenAI",
    models: [
      { id: "gpt-6.1-terra", label: "GPT-6.1 Terra" },
      { id: "gpt-6.1-sol", label: "GPT-6.1 Sol" },
      { id: "gpt-6-luna", label: "GPT-6 Luna" },
    ],
    keysUrl: "https://platform.openai.com/api-keys",
    placeholder: "sk-...",
  },
  anthropic: {
    name: "Claude",
    company: "Anthropic",
    models: [
      { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5" },
      { id: "claude-opus-5-5", label: "Claude Opus 5.5" },
      { id: "claude-haiku-5-5", label: "Claude Haiku 5.5" },
    ],
    keysUrl: "https://platform.claude.com/settings/keys",
    placeholder: "sk-ant-...",
  },
  google: {
    name: "Gemini",
    company: "Google",
    models: [
      { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash" },
      { id: "gemini-4-argon", label: "Gemini 4 Argon" },
    ],
    keysUrl: "https://aistudio.google.com/apikey",
    placeholder: "AIza...",
  },
};

export function isOwnKeyProvider(provider: string): provider is OwnKeyProvider {
  return (OWN_KEY_PROVIDERS as readonly string[]).includes(provider);
}

/** Only listed models can be requested; anything else gets the provider's default. */
export function resolveModel(provider: OwnKeyProvider, requested?: string) {
  const { models } = PROVIDER_INFO[provider];
  return models.find((model) => model.id === requested)?.id ?? models[0].id;
}

/** What the chat sends with each message. `model` is only set for own-key providers. */
export type AssistantChoice = { provider: AssistantProvider; model?: string };

/** The dropdown value and remembered form of a choice, like "openai:gpt-6-luna". */
export function choiceValue(choice: AssistantChoice) {
  return choice.model ? `${choice.provider}:${choice.model}` : choice.provider;
}

/** Reads a remembered choice, falling back to the free models once its key is gone. */
export function parseChoice(value: string | null, connected: readonly OwnKeyProvider[] | null): AssistantChoice {
  const [provider, model] = (value ?? "").split(":");
  if (!isOwnKeyProvider(provider) || !connected?.includes(provider)) return { provider: "free" };
  return { provider, model: resolveModel(provider, model) };
}
