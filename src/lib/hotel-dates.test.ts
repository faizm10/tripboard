import { describe, expect, it } from "vitest";
import { suggestHotelRange } from "@/lib/hotel-dates";

const dates = ["2026-09-18", "2026-09-19", "2026-09-20", "2026-09-21", "2026-09-22"];

describe("hotel stay date suggestions", () => {
  it("covers the rest of the trip when nothing else is booked", () => {
    expect(suggestHotelRange({ dates, flights: [], hotels: [], startDate: "2026-09-18" })).toEqual({ startDate: "2026-09-18", endDate: "2026-09-22" });
  });

  it("uses the city's own dates when it has them", () => {
    const city = { id: "c1", name: "Porto", country: "Portugal", startDate: "2026-09-19", endDate: "2026-09-21", sortOrder: 0 };
    expect(suggestHotelRange({ city, dates, flights: [], hotels: [], startDate: "2026-09-18" })).toEqual({ startDate: "2026-09-19", endDate: "2026-09-21" });
  });

  it("ends on the day of the next departure", () => {
    expect(suggestHotelRange({ dates, flights: [{ plannedDate: "2026-09-20" }], hotels: [], startDate: "2026-09-18" })).toEqual({ startDate: "2026-09-18", endDate: "2026-09-20" });
  });

  it("stops the day before the next hotel begins", () => {
    expect(suggestHotelRange({ dates, flights: [], hotels: [{ id: "h1", startDate: "2026-09-21" }], startDate: "2026-09-18" })).toEqual({ startDate: "2026-09-18", endDate: "2026-09-20" });
  });

  it("ignores departures before the stay starts", () => {
    expect(suggestHotelRange({ dates, flights: [{ plannedDate: "2026-09-18" }], hotels: [], startDate: "2026-09-19" })).toEqual({ startDate: "2026-09-19", endDate: "2026-09-22" });
  });
});
