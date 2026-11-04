import { describe, expect, it } from "vitest";
import {
  createInviteToken,
  hashInviteToken,
  inviteExpiresAt,
  inviteStatus,
  safeReturnTo,
} from "@/lib/invitations";

describe("invite helpers", () => {
  it("creates opaque tokens and stores only hashes", () => {
    const token = createInviteToken();
    const hash = hashInviteToken(token);
    expect(token.length).toBeGreaterThan(20);
    expect(hash).toHaveLength(64);
    expect(hash).not.toBe(token);
  });

  it("expires invites seven days from the supplied time", () => {
    const now = new Date("2026-09-01T00:00:00.000Z");
    expect(inviteExpiresAt(now).toISOString()).toBe("2026-09-08T00:00:00.000Z");
  });

  it("keeps share invites active after an acceptance", () => {
    expect(
      inviteStatus({
        kind: "share",
        acceptedAt: new Date("2026-09-02T00:00:00.000Z"),
        expiresAt: new Date("2026-09-08T00:00:00.000Z"),
      }, new Date("2026-09-03T00:00:00.000Z")),
    ).toBe("active");
  });

  it("marks email invites accepted after one use", () => {
    expect(
      inviteStatus({
        kind: "email",
        acceptedAt: new Date("2026-09-02T00:00:00.000Z"),
        expiresAt: new Date("2026-09-08T00:00:00.000Z"),
      }, new Date("2026-09-03T00:00:00.000Z")),
    ).toBe("accepted");
  });

  it("blocks revoked and expired invites", () => {
    expect(
      inviteStatus({
        kind: "share",
        expiresAt: new Date("2026-09-08T00:00:00.000Z"),
        revokedAt: new Date("2026-09-02T00:00:00.000Z"),
      }, new Date("2026-09-03T00:00:00.000Z")),
    ).toBe("revoked");
    expect(
      inviteStatus({
        kind: "share",
        expiresAt: new Date("2026-09-01T00:00:00.000Z"),
      }, new Date("2026-09-03T00:00:00.000Z")),
    ).toBe("expired");
  });

  it("rejects unsafe auth return paths", () => {
    expect(safeReturnTo("/invite/abc")).toBe("/invite/abc");
    expect(safeReturnTo("https://example.com/invite/abc")).toBe("/trips");
    expect(safeReturnTo("//example.com")).toBe("/trips");
  });
});
