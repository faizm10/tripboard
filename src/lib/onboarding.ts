/**
 * Set once someone finishes or skips the welcome flow, so /trips only sends a
 * brand-new account to /welcome the first time. It holds no personal data.
 */
export const ONBOARDED_COOKIE = "tb_onboarded";

export function markOnboarded() {
  document.cookie = `${ONBOARDED_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

/** "Lisbon, Portugal" → "Lisbon trip". */
export function suggestTripTitle(destination: string) {
  const place = destination.split(",")[0]?.trim();
  return place ? `${place} trip` : "";
}
