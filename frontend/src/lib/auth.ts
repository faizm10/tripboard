import { createNeonAuth } from "@neondatabase/auth/next/server";
import { isReadonlyCookieStoreError } from "@/lib/auth-errors";

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

export async function getViewer() {
  const auth = getNeonAuth();
  if (!auth) {
    return { id: "demo-user", name: "Faiz", email: "demo@tripboard.app", image: undefined, demo: true };
  }
  try {
    const { data } = await auth.getSession();
    if (!data?.user) return null;
    return { ...data.user, demo: false };
  } catch (error) {
    if (isReadonlyCookieStoreError(error)) return null;
    throw error;
  }
}
