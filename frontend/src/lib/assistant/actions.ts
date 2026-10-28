"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
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
