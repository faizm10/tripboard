import { describe, expect, it } from "vitest";
import { demoCityLocation, filterDemoCities, formatCityLabel } from "@/lib/cities";

describe("city labels", () => {
  it("stores a city with its country", () => {
    expect(formatCityLabel({ name: "Lisbon", country: "Portugal" })).toBe("Lisbon, Portugal");
  });

  it("falls back to the region when there is no country", () => {
    expect(formatCityLabel({ name: "Kyoto", region: "Kyoto Prefecture" })).toBe("Kyoto, Kyoto Prefecture");
  });

  it("filters demo cities as the traveller types", () => {
    expect(filterDemoCities("kyo").map((city) => city.label)).toEqual(["Kyoto, Japan"]);
  });

  it("lets a country stand on its own in demo search", () => {
    expect(filterDemoCities("korea").map((city) => city.label)).toEqual(["South Korea"]);
  });

  it("finds a demo city location from a stored destination", () => {
    expect(demoCityLocation("Kyoto")).toEqual({ coordinates: [135.7681, 35.0116] });
  });
});
