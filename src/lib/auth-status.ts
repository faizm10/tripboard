import { neonAuthSettings } from "@/lib/env";

const OUTAGE_CACHE_MS = 60_000;
let outageCache: { checkedAt: number; unavailable: boolean } | null = null;

/**
 * True when Neon Auth is answering but refusing every sign-in: a 402 when the
 * project is paused over its plan quota, or a 5xx. Cached for a minute so the
 * sign-in pages don't probe on every render. A probe that times out counts as
 * available, so a slow network never hides the form.
 */
export async function isSignInUnavailable() {
  const settings = neonAuthSettings();
  if (!settings) return false;
  if (outageCache && Date.now() - outageCache.checkedAt < OUTAGE_CACHE_MS) return outageCache.unavailable;
  let unavailable = false;
  try {
    const response = await fetch(`${settings.baseUrl.replace(/\/$/, "")}/ok`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3_000),
    });
    unavailable = response.status === 402 || response.status >= 500;
  } catch {
    unavailable = false;
  }
  outageCache = { checkedAt: Date.now(), unavailable };
  return unavailable;
}
