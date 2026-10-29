import { describe, expect, it } from "vitest";
import { describeWeather, formatTemperature, hoursFromFoursquare, hoursFromGoogle, weatherSource } from "@/lib/day-context";

describe("weather", () => {
  it("picks a forecast, recorded weather, or last year's weather depending on the date", () => {
    expect(weatherSource("2026-11-05", "2026-10-29")).toEqual({ kind: "forecast", date: "2026-11-05" });
    expect(weatherSource("2026-10-01", "2026-10-29")).toEqual({ kind: "history", date: "2026-10-01" });
    expect(weatherSource("2027-05-01", "2026-10-29")).toEqual({ kind: "typical", date: "2026-05-01" });
    expect(weatherSource("2028-02-29", "2026-10-29")).toEqual({ kind: "typical", date: "2027-02-28" });
  });

  it("describes codes in plain words and shows °F only where people use it", () => {
    expect(describeWeather(63).label).toBe("Rain");
    expect(formatTemperature(20, "en-US")).toBe("68°");
    expect(formatTemperature(20, "en-CA")).toBe("20°");
  });
});

describe("opening hours", () => {
  const google = ["Monday: Closed", "Tuesday: 10:00 AM – 5:30 PM", "Wednesday: Open 24 hours"];

  it("reads the trip day's line from Google", () => {
    expect(hoursFromGoogle(google, "2026-05-04")).toEqual({ status: "closed", text: "Closed on Mondays" });
    expect(hoursFromGoogle(google, "2026-05-05")).toEqual({ status: "open", text: "Open 10:00 AM – 5:30 PM" });
    expect(hoursFromGoogle(google, "2026-05-06").text).toBe("Open 24 hours");
    expect(hoursFromGoogle(google, "2026-05-07").status).toBe("unknown");
  });

  it("reads Foursquare's numbered days", () => {
    const regular = [{ day: 7, open: "1100", close: "2230" }];
    expect(hoursFromFoursquare(regular, "2026-05-03")).toEqual({ status: "open", text: "Open 11 AM – 10:30 PM" });
    expect(hoursFromFoursquare(regular, "2026-05-04").status).toBe("closed");
  });
});
