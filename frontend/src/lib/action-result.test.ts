import { describe, expect, it } from "vitest";
import { unwrap } from "@/lib/action-result";

describe("action results", () => {
  it("passes successful data through", async () => {
    await expect(unwrap(Promise.resolve({ ok: true as const, data: { id: "a" } }))).resolves.toEqual({ id: "a" });
  });

  it("turns a failed result back into an error with the real message", async () => {
    await expect(unwrap({ ok: false, error: "Those dates overlap another hotel in this city." })).rejects.toThrow("Those dates overlap another hotel in this city.");
  });
});
