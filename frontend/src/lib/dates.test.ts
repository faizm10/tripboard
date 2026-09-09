import { describe, expect, it } from "vitest";
import { countryFromDestination, formatDateLabel, formatWeekdayDate } from "@/lib/dates";

describe("trip dates", () => {
  it("collapses days in the same month", () => {
    expect(formatDateLabel("2026-09-18", "2026-09-22")).toBe("SEP 18—22");
  });

  it("keeps both months when the trip crosses them", () => {
    expect(formatDateLabel("2026-09-28", "2026-10-02")).toBe("SEP 28—OCT 2");
  });

  it("leaves room for dates that are still open", () => {
    expect(formatDateLabel("", "")).toBe("Dates later");
    expect(formatDateLabel(undefined, undefined)).toBe("Dates later");
  });
});

describe("weekday date labels", () => {
  it("keeps ISO calendar days stable while adding the weekday", () => {
    expect(formatWeekdayDate("2026-09-24")).toBe("Thu · Sep 24");
  });

  it("has a clear fallback when a place has no planned day", () => {
    expect(formatWeekdayDate(null)).toBe("Not scheduled");
  });
});

describe("destination country", () => {
  it("reads the country from a stored city label", () => {
    expect(countryFromDestination("Lisbon, Portugal")).toBe("Portugal");
  });
});
