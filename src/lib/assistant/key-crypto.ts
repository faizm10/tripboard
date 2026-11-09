import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

const VERSION = "v1";
const IV_BYTES = 12;

function derivedKey(secret: string) {
  return Buffer.from(hkdfSync("sha256", secret, Buffer.alloc(0), "tripboard:assistant-api-keys:v1", 32));
}

/**
 * Encrypts an API key with AES-256-GCM. `context` is authenticated with it, so
 * a stored value copied onto another user or provider fails to decrypt.
 */
export function encryptApiKey(plaintext: string, context: string, secret: string) {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", derivedKey(secret), iv);
  cipher.setAAD(Buffer.from(context));
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), body.toString("base64url")].join(".");
}

/** Throws when the value was tampered with or the secret or context doesn't match. */
export function decryptApiKey(stored: string, context: string, secret: string) {
  const [version, iv, tag, body] = stored.split(".");
  if (version !== VERSION || !iv || !tag || !body) throw new Error("Unrecognised encrypted key format.");
  const decipher = createDecipheriv("aes-256-gcm", derivedKey(secret), Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
}
