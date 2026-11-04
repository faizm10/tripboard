import { createHash, randomBytes } from "node:crypto";

export const INVITE_TTL_DAYS = 7;

export type InviteStatusInput = {
  expiresAt: Date;
  revokedAt?: Date | null;
  acceptedAt?: Date | null;
  kind: "email" | "share";
};

export function createInviteToken() {
  return randomBytes(32).toString("base64url");
}

export function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function inviteExpiresAt(now = new Date()) {
  return new Date(now.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export function inviteStatus(invite: InviteStatusInput, now = new Date()) {
  if (invite.revokedAt) return "revoked";
  if (invite.expiresAt.getTime() < now.getTime()) return "expired";
  if (invite.kind === "email" && invite.acceptedAt) return "accepted";
  return "active";
}

export function isSafeReturnTo(value?: string | null) {
  return Boolean(value && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\"));
}

export function safeReturnTo(value?: string | null, fallback = "/trips") {
  return isSafeReturnTo(value) ? value! : fallback;
}
