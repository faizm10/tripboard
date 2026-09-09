import { describe, expect, it } from "vitest";
import { categoryFromGoogleTypes, cityFromGooglePrediction, nameNeedsAddressLookup, viewportToBbox } from "@/lib/google-maps";

describe("google city predictions", () => {
  it("builds a stored destination from Google's main and secondary text", () => {
    expect(
      cityFromGooglePrediction({
        placeId: "ChIJ",
        structuredFormat: {
          mainText: { text: "Lisbon" },
          secondaryText: { text: "Portugal" },
        },
      }),
    ).toEqual({
      id: "ChIJ",
      name: "Lisbon",
      label: "Lisbon, Portugal",
      region: undefined,
      country: "Portugal",
      kind: "city",
    });
  });

  it("keeps a country as its own destination", () => {
    expect(
      cityFromGooglePrediction(
        {
          placeId: "ChIJcountry",
          types: ["country", "political"],
          structuredFormat: {
            mainText: { text: "South Korea" },
          },
        },
        "country",
      ),
    ).toEqual({
      id: "ChIJcountry",
      name: "South Korea",
      label: "South Korea",
      region: undefined,
      country: "South Korea",
      kind: "country",
    });
  });
});

describe("google place categories", () => {
  it("treats cafes as drink even when they are also food", () => {
    expect(categoryFromGoogleTypes(["cafe", "food", "point_of_interest"], "cafe")).toBe("Drink");
  });

  it("maps tourist attractions to see", () => {
    expect(categoryFromGoogleTypes(["tourist_attraction", "point_of_interest"], "tourist_attraction")).toBe("See");
  });

  it("maps transit stops to transit", () => {
    expect(categoryFromGoogleTypes(["train_station", "transit_station", "point_of_interest"], "train_station")).toBe("Transit");
    expect(categoryFromGoogleTypes(["bus_stop", "point_of_interest"], "bus_stop")).toBe("Transit");
  });
});

describe("address-style place names", () => {
  it("requests a venue lookup only when the saved name is just the address", () => {
    expect(nameNeedsAddressLookup("3-chome-12-16 Ginza", "3 chome 12 16 Ginza")).toBe(true);
    expect(nameNeedsAddressLookup("Ginza Six", "3-chome-12-16 Ginza")).toBe(false);
  });
});

describe("google viewports", () => {
  it("converts a geocoding viewport into a map bbox", () => {
    expect(
      viewportToBbox({
        southwest: { lat: 38.6, lng: -9.3 },
        northeast: { lat: 38.8, lng: -9.0 },
      }),
    ).toEqual([-9.3, 38.6, -9.0, 38.8]);
  });

  it("rejects administrative bounds that are too broad for a city map", () => {
    expect(
      viewportToBbox({
        southwest: { lat: 20.4231216, lng: 136.0696826 },
        northeast: { lat: 35.8984074, lng: 153.9867945 },
      }),
    ).toBeUndefined();
  });
});
