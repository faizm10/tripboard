import "server-only";
import { and, eq } from "drizzle-orm";
import { decryptApiKey, encryptApiKey } from "@/lib/assistant/key-crypto";
import { isOwnKeyProvider, type OwnKeyProvider } from "@/lib/assistant/providers";
import { tolerant } from "@/lib/assistant/store";
import { getDatabase } from "@/lib/db";
import { assistantApiKeys } from "@/lib/db/schema";
import { aiKeysSecret } from "@/lib/env";

/** What the browser may know about a saved key. The key itself never leaves the server. */
export type SavedApiKey = { provider: OwnKeyProvider; hint: string };

function keyContext(userId: string, provider: OwnKeyProvider) {
  return `${userId}:${provider}`;
}

export async function listApiKeys(userId: string): Promise<SavedApiKey[]> {
  const db = getDatabase();
  if (!db) return [];
  return tolerant([], async () => {
    const rows = await db
      .select({ provider: assistantApiKeys.provider, hint: assistantApiKeys.keyHint })
      .from(assistantApiKeys)
      .where(eq(assistantApiKeys.userId, userId));
    return rows.flatMap((row) => (isOwnKeyProvider(row.provider) ? [{ provider: row.provider, hint: row.hint }] : []));
  });
}

export async function saveApiKey(userId: string, provider: OwnKeyProvider, apiKey: string) {
  const db = getDatabase();
  const secret = aiKeysSecret();
  if (!db || !secret) throw new Error("API keys aren't set up on this server.");
  const encryptedKey = encryptApiKey(apiKey, keyContext(userId, provider), secret);
  const keyHint = apiKey.slice(-4);
  await db
    .insert(assistantApiKeys)
    .values({ userId, provider, encryptedKey, keyHint })
    .onConflictDoUpdate({
      target: [assistantApiKeys.userId, assistantApiKeys.provider],
      set: { encryptedKey, keyHint, updatedAt: new Date() },
    });
  return { provider, hint: keyHint } satisfies SavedApiKey;
}

export async function deleteApiKey(userId: string, provider: OwnKeyProvider) {
  const db = getDatabase();
  if (!db) return;
  await db.delete(assistantApiKeys).where(and(eq(assistantApiKeys.userId, userId), eq(assistantApiKeys.provider, provider)));
}

/** The decrypted key for one request, or null when it's missing or can no longer be read. */
export async function getApiKey(userId: string, provider: OwnKeyProvider) {
  const db = getDatabase();
  const secret = aiKeysSecret();
  if (!db || !secret) return null;
  const stored = await tolerant(null, async () => {
    const [row] = await db
      .select({ encryptedKey: assistantApiKeys.encryptedKey })
      .from(assistantApiKeys)
      .where(and(eq(assistantApiKeys.userId, userId), eq(assistantApiKeys.provider, provider)))
      .limit(1);
    return row?.encryptedKey ?? null;
  });
  if (!stored) return null;
  try {
    return decryptApiKey(stored, keyContext(userId, provider), secret);
  } catch {
    console.error(`[assistant] a saved ${provider} key could not be decrypted`);
    return null;
  }
}
