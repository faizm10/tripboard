/**
 * Reads an environment value, treating blanks and the "[SENSITIVE]" placeholder that
 * `vercel env pull` writes for secrets as missing, so local setups fall back to demo mode
 * instead of crashing on a value that only looks configured.
 */
export function envValue(name: string) {
  const value = process.env[name]?.trim();
  if (!value || value === "[SENSITIVE]") return undefined;
  return value;
}

const warned = new Set<string>();
export function warnOnce(key: string, message: string) {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[tripboard] ${message}`);
}

export function databaseUrl() {
  const url = envValue("DATABASE_URL");
  if (!url) return undefined;
  if (!/^postgres(ql)?:\/\//.test(url)) {
    warnOnce("database-url", "DATABASE_URL isn't a postgres:// URL, so the app is running in demo mode.");
    return undefined;
  }
  return url;
}

/** Neon Auth needs a base URL and a cookie secret of at least 32 characters. */
export function neonAuthSettings() {
  const baseUrl = envValue("NEON_AUTH_BASE_URL");
  const secret = envValue("NEON_AUTH_COOKIE_SECRET");
  if (!baseUrl || !secret) return null;
  if (secret.length < 32) {
    warnOnce("auth-secret", "NEON_AUTH_COOKIE_SECRET is shorter than 32 characters, so sign-in is off. Generate one with: openssl rand -base64 32");
    return null;
  }
  return { baseUrl, secret };
}
