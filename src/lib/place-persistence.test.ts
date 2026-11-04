import { describe, expect, it } from "vitest";
import { resolvePersistedPlaceIds } from "@/lib/place-persistence";

describe("place persistence", () => {
  it("resolves temporary place IDs after their queued saves finish", () => {
    const persistedIds = new Map([
      ["local-1", "11111111-1111-4111-8111-111111111111"],
    ]);

    expect(resolvePersistedPlaceIds([
      "22222222-2222-4222-8222-222222222222",
      "local-1",
    ], persistedIds)).toEqual([
      "22222222-2222-4222-8222-222222222222",
      "11111111-1111-4111-8111-111111111111",
    ]);
  });

  it("does not send a place that has not finished saving to the reorder action", () => {
    expect(() => resolvePersistedPlaceIds(["local-1"], new Map())).toThrow(
      "This place is still being saved. Try moving it again.",
    );
  });
});
