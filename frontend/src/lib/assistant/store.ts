import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getDatabase } from "@/lib/db";
import { assistantConversations, assistantSettings, assistantUsage, trips } from "@/lib/db/schema";
import type { AssistantMessage } from "@/lib/assistant/tools";
import { isPersistedTripId } from "@/lib/types";

/** Saved chats keep the newest messages only, so one row never grows without bound. */
export const MAX_SAVED_MESSAGES = 100;

export type ConversationSummary = {
  id: string;
  tripId: string;
  tripTitle: string;
  title: string;
  messageCount: number;
  updatedAt: string;
};

export type AssistantUsageSummary = {
  replies30d: number;
  tokens30d: number;
  repliesAllTime: number;
  tokensAllTime: number;
  lastUsedAt: string | null;
  models: Array<{ model: string; replies: number }>;
};

/**
 * The assistant tables ship in migration 0015. Until it runs, reads fall back
 * to defaults and writes are skipped, so the assistant itself keeps working.
 */
function isAssistantSchemaMissing(error: unknown) {
  const message = error instanceof Error ? `${error.message} ${error.cause ?? ""}` : String(error);
  return /assistant_(settings|conversations|usage)|relation .* does not exist/i.test(message);
}

async function tolerant<T>(fallback: T, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (isAssistantSchemaMissing(error)) return fallback;
    throw error;
  }
}

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function conversationTitle(messages: AssistantMessage[]) {
  const firstUser = messages.find((message) => message.role === "user");
  const text = firstUser?.parts.find((part) => part.type === "text")?.text.trim().replace(/\s+/g, " ") ?? "";
  if (!text) return "New chat";
  return text.length > 80 ? `${text.slice(0, 77).trimEnd()}…` : text;
}

export async function getSaveConversations(userId: string) {
  const db = getDatabase();
  if (!db) return false;
  return tolerant(false, async () => {
    const [row] = await db
      .select({ save: assistantSettings.saveConversations })
      .from(assistantSettings)
      .where(eq(assistantSettings.userId, userId))
      .limit(1);
    return row?.save ?? false;
  });
}

export async function setSaveConversations(userId: string, save: boolean) {
  const db = getDatabase();
  if (!db) return;
  await db
    .insert(assistantSettings)
    .values({ userId, saveConversations: save })
    .onConflictDoUpdate({ target: assistantSettings.userId, set: { saveConversations: save, updatedAt: new Date() } });
}

export async function saveConversation(input: { id: string; userId: string; tripId: string; messages: AssistantMessage[] }) {
  const db = getDatabase();
  if (!db || !isPersistedTripId(input.tripId) || !input.messages.length) return;
  const messages = input.messages.slice(-MAX_SAVED_MESSAGES);
  const title = conversationTitle(input.messages);
  await tolerant(undefined, async () => {
    await db
      .insert(assistantConversations)
      .values({ id: input.id, userId: input.userId, tripId: input.tripId, title, messages, messageCount: messages.length })
      .onConflictDoUpdate({
        target: assistantConversations.id,
        set: { title, messages, messageCount: messages.length, updatedAt: new Date() },
        // A chat id belongs to whoever created it; another user can't overwrite it.
        setWhere: eq(assistantConversations.userId, input.userId),
      });
  });
}

export async function listConversations(userId: string, tripId?: string): Promise<ConversationSummary[]> {
  const db = getDatabase();
  if (!db) return [];
  if (tripId && !isPersistedTripId(tripId)) return [];
  return tolerant([], async () => {
    const rows = await db
      .select({
        id: assistantConversations.id,
        tripId: assistantConversations.tripId,
        tripTitle: trips.title,
        title: assistantConversations.title,
        messageCount: assistantConversations.messageCount,
        updatedAt: assistantConversations.updatedAt,
      })
      .from(assistantConversations)
      .innerJoin(trips, eq(trips.id, assistantConversations.tripId))
      .where(tripId
        ? and(eq(assistantConversations.userId, userId), eq(assistantConversations.tripId, tripId))
        : eq(assistantConversations.userId, userId))
      .orderBy(desc(assistantConversations.updatedAt))
      .limit(50);
    return rows.map((row) => ({ ...row, updatedAt: toIso(row.updatedAt) }));
  });
}

export async function getConversationMessages(userId: string, id: string): Promise<AssistantMessage[] | null> {
  const db = getDatabase();
  if (!db) return null;
  return tolerant(null, async () => {
    const [row] = await db
      .select({ messages: assistantConversations.messages })
      .from(assistantConversations)
      .where(and(eq(assistantConversations.id, id), eq(assistantConversations.userId, userId)))
      .limit(1);
    return row ? (row.messages as AssistantMessage[]) : null;
  });
}

export async function deleteConversation(userId: string, id: string) {
  const db = getDatabase();
  if (!db) return;
  await tolerant(undefined, async () => {
    await db.delete(assistantConversations).where(and(eq(assistantConversations.id, id), eq(assistantConversations.userId, userId)));
  });
}

export async function deleteAllConversations(userId: string) {
  const db = getDatabase();
  if (!db) return;
  await tolerant(undefined, async () => {
    await db.delete(assistantConversations).where(eq(assistantConversations.userId, userId));
  });
}

export async function recordUsage(input: { userId: string; tripId: string; model: string; inputTokens: number; outputTokens: number }) {
  const db = getDatabase();
  if (!db) return;
  await tolerant(undefined, async () => {
    await db.insert(assistantUsage).values({
      userId: input.userId,
      tripId: isPersistedTripId(input.tripId) ? input.tripId : null,
      model: input.model,
      inputTokens: Math.max(0, Math.round(input.inputTokens)),
      outputTokens: Math.max(0, Math.round(input.outputTokens)),
    });
  });
}

const emptyUsage: AssistantUsageSummary = { replies30d: 0, tokens30d: 0, repliesAllTime: 0, tokensAllTime: 0, lastUsedAt: null, models: [] };

export async function getUsageSummary(userId: string): Promise<AssistantUsageSummary> {
  const db = getDatabase();
  if (!db) return emptyUsage;
  return tolerant(emptyUsage, async () => {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const tokens = sql<number>`coalesce(sum(${assistantUsage.inputTokens} + ${assistantUsage.outputTokens}), 0)::int`;
    const [allTime] = await db
      .select({ replies: sql<number>`count(*)::int`, tokens, lastUsedAt: sql<Date | null>`max(${assistantUsage.createdAt})` })
      .from(assistantUsage)
      .where(eq(assistantUsage.userId, userId));
    const [recent] = await db
      .select({ replies: sql<number>`count(*)::int`, tokens })
      .from(assistantUsage)
      .where(and(eq(assistantUsage.userId, userId), gte(assistantUsage.createdAt, since)));
    const models = await db
      .select({ model: assistantUsage.model, replies: sql<number>`count(*)::int` })
      .from(assistantUsage)
      .where(and(eq(assistantUsage.userId, userId), gte(assistantUsage.createdAt, since)))
      .groupBy(assistantUsage.model)
      .orderBy(desc(sql`count(*)`))
      .limit(5);
    return {
      replies30d: Number(recent?.replies ?? 0),
      tokens30d: Number(recent?.tokens ?? 0),
      repliesAllTime: Number(allTime?.replies ?? 0),
      tokensAllTime: Number(allTime?.tokens ?? 0),
      lastUsedAt: allTime?.lastUsedAt ? toIso(allTime.lastUsedAt) : null,
      models: models.map((row) => ({ model: row.model, replies: Number(row.replies) })),
    };
  });
}
