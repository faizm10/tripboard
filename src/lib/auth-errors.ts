export function isReadonlyCookieStoreError(error: unknown) {
  return error instanceof Error && /Cookies can only be modified/i.test(error.message);
}

const UNAVAILABLE = "Sign-in is unavailable right now. Try again in a moment.";

type AuthFailure = { status?: number; code?: string; message?: string; error?: string };

/**
 * Turns a Neon Auth failure into words for the sign-in screen. Outages and
 * provider quota limits (402, 5xx) get a plain "unavailable" note instead of
 * the provider's billing text; anything else keeps its own message.
 */
export function authFailureMessage(failure: AuthFailure | null | undefined, fallback: string) {
  const status = failure?.status ?? 0;
  if (status === 402 || status >= 500 || /QUOTA/i.test(failure?.code ?? "")) return UNAVAILABLE;
  return failure?.message || failure?.error || fallback;
}
