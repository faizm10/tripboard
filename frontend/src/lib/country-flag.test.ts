import { describe, expect, it } from "vitest";
import { countryCodeFromName, flagCodeForTrip } from "@/lib/country-flag";

describe("countryCodeFromName", () => {
  it("maps common travel countries", () => {
    expect(countryCodeFromName("South Korea")).toBe("kr");
    expect(countryCodeFromName("Japan")).toBe("jp");
    expect(countryCodeFromName("Portugal")).toBe("pt");
    expect(countryCodeFromName("Canada")).toBe("ca");
  });

  it("reads the country from a city label", () => {
    expect(countryCodeFromName("Lisbon, Portugal")).toBe("pt");
    expect(countryCodeFromName("Tokyo, Japan")).toBe("jp");
  });

  it("understands usual aliases", () => {
    expect(countryCodeFromName("UK")).toBe("gb");
    expect(countryCodeFromName("USA")).toBe("us");
    expect(countryCodeFromName("Korea")).toBe("kr");
  });

  it("returns null when the place is unknown", () => {
    expect(countryCodeFromName("Somewhere made up")).toBeNull();
  });
});

describe("flagCodeForTrip", () => {
  it("prefers the trip country", () => {
    expect(flagCodeForTrip({ country: "Japan", destination: "Tokyo" })).toBe("jp");
  });

  it("falls back through cities and destination", () => {
    expect(
      flagCodeForTrip({
        country: "",
        destination: "Tokyo + 1 city",
        cities: [{ name: "Tokyo", country: "Japan" }],
      }),
    ).toBe("jp");
  });
});
