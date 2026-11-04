export const GOOGLE_AUTH_CHANNEL = "tripboard-google-auth";
export const GOOGLE_AUTH_MESSAGE = "tripboard:google-complete";
export const SESSION_VERIFIER_PARAM = "neon_auth_session_verifier";

export type GoogleAuthMessage = {
  type: typeof GOOGLE_AUTH_MESSAGE;
  verifier?: string | null;
};

function safeAuthReturnTo(value: string) {
  return value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : "/trips";
}

export function tripsUrlWithVerifier(verifier?: string | null, returnTo = "/trips") {
  const safeReturnTo = safeAuthReturnTo(returnTo);
  if (!verifier) return safeReturnTo;
  const params = new URLSearchParams({ [SESSION_VERIFIER_PARAM]: verifier });
  const separator = safeReturnTo.includes("?") ? "&" : "?";
  return `${safeReturnTo}${separator}${params.toString()}`;
}
