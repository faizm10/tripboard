"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { deleteApiKey, listApiKeys, saveApiKey, type SavedApiKey } from "@/lib/assistant/api-keys";
import { isKeyAccepted } from "@/lib/assistant/own-key-model";
import { OWN_KEY_PROVIDERS, PROVIDER_INFO, type OwnKeyProvider } from "@/lib/assistant/providers";
import { getViewer } from "@/lib/auth";
import {
  deleteAllConversations,
  deleteConversation,
  getConversationMessages,
  getSaveConversations,
  listConversations,
  setSaveConversations,
  type ConversationSummary,
} from "@/lib/assistant/store";
import type { AssistantMessage } from "@/lib/assistant/tools";

const idSchema = z.string().min(1).max(64);
const providerSchema = z.enum(OWN_KEY_PROVIDERS);
const apiKeySchema = z.string().trim().min(20).max(512).regex(/^[\x21-\x7e]+$/);

export type SaveApiKeyResult = { ok: true; key: SavedApiKey } | { ok: false; error: string };

/** Saved chats need a real account; demo mode has nowhere to keep them. */
async function requireAccount() {
  const viewer = await getViewer();
  if (!viewer || viewer.restricted || viewer.demo) return null;
  return viewer;
}

export async function loadTripConversations(tripId: unknown): Promise<{ saving: boolean; conversations: ConversationSummary[] }> {
  const viewer = await requireAccount();
  const parsed = idSchema.safeParse(tripId);
  if (!viewer || !parsed.success) return { saving: false, conversations: [] };
  const [saving, conversations] = await Promise.all([
    getSaveConversations(viewer.id),
    listConversations(viewer.id, parsed.data),
  ]);
  return { saving, conversations };
}

export async function loadConversation(id: unknown): Promise<AssistantMessage[] | null> {
  const viewer = await requireAccount();
  const parsed = idSchema.safeParse(id);
  if (!viewer || !parsed.success) return null;
  return getConversationMessages(viewer.id, parsed.data);
}

export async function removeConversation(id: unknown) {
  const viewer = await requireAccount();
  const parsed = idSchema.safeParse(id);
  if (!viewer || !parsed.success) return;
  await deleteConversation(viewer.id, parsed.data);
  revalidatePath("/account");
}

export async function removeAllConversations() {
  const viewer = await requireAccount();
  if (!viewer) return;
  await deleteAllConversations(viewer.id);
  revalidatePath("/account");
}

export async function updateSaveConversations(save: unknown) {
  const viewer = await requireAccount();
  const parsed = z.boolean().safeParse(save);
  if (!viewer || !parsed.success) throw new Error("Sign in to change assistant settings.");
  await setSaveConversations(viewer.id, parsed.data);
  revalidatePath("/account");
  return { saving: parsed.data };
}

/** Which own-key providers the chat can offer. Null means this viewer can't connect any. */
export async function loadConnectedProviders(): Promise<OwnKeyProvider[] | null> {
  const viewer = await requireAccount();
  if (!viewer) return null;
  const keys = await listApiKeys(viewer.id);
  return keys.map((key) => key.provider);
}

export async function saveAssistantApiKey(provider: unknown, apiKey: unknown): Promise<SaveApiKeyResult> {
  const viewer = await requireAccount();
  if (!viewer) return { ok: false, error: "Sign in to save an API key." };
  const parsedProvider = providerSchema.safeParse(provider);
  if (!parsedProvider.success) return { ok: false, error: "That provider isn't supported." };
  const parsedKey = apiKeySchema.safeParse(apiKey);
  if (!parsedKey.success) return { ok: false, error: "That doesn't look like an API key. Paste the whole key." };

  if (!(await isKeyAccepted(parsedProvider.data, parsedKey.data))) {
    return { ok: false, error: `${PROVIDER_INFO[parsedProvider.data].company} didn't accept that key. Check it and try again.` };
  }
  try {
    const key = await saveApiKey(viewer.id, parsedProvider.data, parsedKey.data);
    revalidatePath("/account");
    return { ok: true, key };
  } catch {
    // Deliberately not logged: a database error can quote the values it was given.
    return { ok: false, error: "That key didn't save. Try again." };
  }
}

export async function removeAssistantApiKey(provider: unknown) {
  const viewer = await requireAccount();
  const parsed = providerSchema.safeParse(provider);
  if (!viewer || !parsed.success) throw new Error("Sign in to change assistant settings.");
  await deleteApiKey(viewer.id, parsed.data);
  revalidatePath("/account");
}
