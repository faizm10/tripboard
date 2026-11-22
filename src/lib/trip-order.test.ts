import { describe, expect, it } from "vitest";
import { daysBetween, sortTrips, spotlightTrip, tripCountdown, tripWhen } from "@/lib/trip-order";

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

  it("counts down to a trip and through it", () => {
    expect(daysBetween("2026-09-26", "2026-10-26")).toBe(30);
    expect(tripCountdown({ startDate: "2026-09-27", endDate: "2026-09-30" }, today)).toBe("Tomorrow");
    expect(tripCountdown({ startDate: "2026-10-06", endDate: "2026-10-09" }, today)).toBe("In 10 days");
    expect(tripCountdown({ startDate: "2026-10-24", endDate: "2026-10-29" }, today)).toBe("In 4 weeks");
    expect(tripCountdown({ startDate: "2027-01-24", endDate: "2027-01-29" }, today)).toBe("In 4 months");
    expect(tripCountdown({ startDate: "2026-09-25", endDate: "2026-09-29" }, today)).toBe("Day 2 of 5");
    expect(tripCountdown({ startDate: "", endDate: "" }, today)).toBe("No dates yet");
  });

  it("leads with the trip that is not over yet", () => {
    const past = { title: "Past", startDate: "2026-04-10", endDate: "2026-04-13" };
    const open = { title: "Open", startDate: "", endDate: "" };
    expect(spotlightTrip(sortTrips([past, open], today), today)).toBe(open);
    expect(spotlightTrip([past], today)).toBeUndefined();
  });
});
