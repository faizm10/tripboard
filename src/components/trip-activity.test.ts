import { describe, expect, it } from "vitest";
import { unseenSince, type ActivityItem } from "@/components/trip-activity";

const item = (id: string, actorId: string): ActivityItem => ({ id, actorId, actorName: actorId, summary: "added a place", createdAt: "2026-05-01T00:00:00Z" });

describe("unseen activity", () => {
  const items = [item("c", "ana"), item("b", "me"), item("a", "ana")];

  it("shows nothing until the first load sets the baseline", () => {
    expect(unseenSince(items, undefined, "me")).toEqual([]);
  });

  it("returns other people's changes newer than the baseline", () => {
    expect(unseenSince(items, "a", "me").map((entry) => entry.id)).toEqual(["c"]);
    expect(unseenSince(items, "c", "me")).toEqual([]);
  });

  it("treats everything as new when the trip had no activity on open", () => {
    expect(unseenSince(items, null, "me").map((entry) => entry.id)).toEqual(["c", "a"]);
  });
});
