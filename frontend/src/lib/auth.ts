import { createNeonAuth } from "@neondatabase/auth/next/server";
import { eq } from "drizzle-orm";
import { isReadonlyCookieStoreError } from "@/lib/auth-errors";
import { getDatabase } from "@/lib/db";
import { neonAuthUsers } from "@/lib/db/neon-auth-schema";

type Viewer = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  demo: boolean;
  restricted?: boolean;
};

export function isNeonAuthConfigured() {
  return Boolean(process.env.NEON_AUTH_BASE_URL && process.env.NEON_AUTH_COOKIE_SECRET);
}

export function getNeonAuth() {
  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  const secret = process.env.NEON_AUTH_COOKIE_SECRET;
  if (!baseUrl || !secret) return null;
  return createNeonAuth({
    baseUrl,
    cookies: { secret, sessionDataTtl: 300 },
    logLevel: "warn",
  });
}

export async function getViewer(): Promise<Viewer | null> {
  const auth = getNeonAuth();
  if (!auth) {
    return { id: "demo-user", name: "Faiz", email: "demo@tripboard.app", image: undefined, demo: true } satisfies Viewer;
  }
  try {
    const { data } = await auth.getSession();
    if (!data?.user) return null;
    const viewer: Viewer = { ...data.user, demo: false };
    // Neon Auth caches session data. Consult the source-of-truth user row so a
    // newly suspended account loses access on its very next application request.
    const db = getDatabase();
    if (!db) return viewer;
    const [account] = await db
      .select({ banned: neonAuthUsers.banned })
      .from(neonAuthUsers)
      .where(eq(neonAuthUsers.id, viewer.id))
      .limit(1);
    return account?.banned ? { ...viewer, restricted: true } : viewer;
  } catch (error) {
    if (isReadonlyCookieStoreError(error)) return null;
    throw error;
  }
}
