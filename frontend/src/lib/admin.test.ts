import { describe, expect, it } from "vitest";
import { adminRange, isAdminEmail, normalizeAdminEmail, rangeStart } from "@/lib/admin-config";

describe("admin access helpers", () => {
  it("normalizes the single administrator email before comparison", () => {
    const previous = process.env.ADMIN_EMAIL;
    process.env.ADMIN_EMAIL = "faizmustansar10@gmail.com";
    expect(normalizeAdminEmail("  FAIZMUSTANSAR10@GMAIL.COM ")).toBe("faizmustansar10@gmail.com");
    expect(isAdminEmail("  FAIZMUSTANSAR10@GMAIL.COM ")).toBe(true);
    expect(isAdminEmail("traveller@example.com")).toBe(false);
    if (previous === undefined) delete process.env.ADMIN_EMAIL;
    else process.env.ADMIN_EMAIL = previous;
  });

  it("accepts only supported analytics ranges", () => {
    expect(adminRange("7")).toBe(7);
    expect(adminRange("90")).toBe(90);
    expect(adminRange("14")).toBe(30);
    expect(adminRange()).toBe(30);
  });

  it("starts a range at the UTC beginning of its first day", () => {
    const start = rangeStart(7);
    expect(start.getUTCHours()).toBe(0);
    expect(start.getUTCMinutes()).toBe(0);
    expect(start.getUTCSeconds()).toBe(0);
  });
});
