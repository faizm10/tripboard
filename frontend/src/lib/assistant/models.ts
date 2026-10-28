/**
 * Free OpenRouter models that support tool calling, tried in order. Free
 * models come and go, so production overrides this with OPENROUTER_MODELS
 * (comma separated) instead of a code change. `openrouter/free` goes last:
 * it routes to whichever free model is currently available.
 */
export const DEFAULT_ASSISTANT_MODELS = [
  "google/gemma-4-31b-it:free",
  "nvidia/nemotron-3.5-super-vl:free",
  "openrouter/free",
] as const;

/** A short fallback chain, so a request that every model rejects fails fast. */
const MAX_MODELS = 3;

export function assistantModels(raw = process.env.OPENROUTER_MODELS): string[] {
  const configured = (raw ?? "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);
  const models = configured.length ? configured : [...DEFAULT_ASSISTANT_MODELS];
  return [...new Set(models)].slice(0, MAX_MODELS);
}

/** "google/gemma-4-31b-it:free" -> "gemma-4-31b-it" for the small model label in the panel. */
export function shortModelName(modelId?: string | null) {
  if (!modelId) return "";
  return modelId.split("/").pop()?.replace(/:free$/, "") ?? modelId;
}
