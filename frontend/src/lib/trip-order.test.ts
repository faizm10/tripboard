import { describe, expect, it } from "vitest";
import { sortTrips, tripWhen } from "@/lib/trip-order";

const today = "2026-09-26";

describe("trip timing", () => {
  it("treats today as inside the trip, including the first and last day", () => {
    expect(tripWhen({ startDate: "2026-09-26", endDate: "2026-09-30" }, today)).toBe("now");
    expect(tripWhen({ startDate: "2026-09-20", endDate: "2026-09-26" }, today)).toBe("now");
    expect(tripWhen({ startDate: "2026-09-27", endDate: "2026-10-02" }, today)).toBe("upcoming");
    expect(tripWhen({ startDate: "2026-09-01", endDate: "2026-09-25" }, today)).toBe("past");
    expect(tripWhen({ startDate: "", endDate: "" }, today)).toBe("open");
  });

  it("puts a trip that is happening now ahead of later and earlier trips", () => {
    const ordered = sortTrips(
      [
        { title: "Past", startDate: "2026-04-10", endDate: "2026-04-13" },
        { title: "Later", startDate: "2026-11-03", endDate: "2026-11-09" },
        { title: "Now", startDate: "2026-09-25", endDate: "2026-09-30" },
        { title: "Open", startDate: "", endDate: "" },
      ],
      today,
    );
    expect(ordered.map((trip) => trip.title)).toEqual(["Now", "Later", "Open", "Past"]);
  });
});
