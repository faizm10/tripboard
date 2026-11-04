import { describe, expect, it } from "vitest";
import { demoPlaces } from "@/lib/demo-data";
import { buildAppleMapsUrl, buildGoogleMapsDirectionsUrl, buildGoogleMapsUrl } from "@/lib/navigation";

describe("navigation handoff URLs", () => {
  it("builds a Google route with origin, waypoints and destination", () => {
    const url = new URL(buildGoogleMapsUrl(demoPlaces.slice(0, 3), "walking"));
    expect(url.hostname).toBe("www.google.com");
    expect(url.searchParams.get("travelmode")).toBe("walking");
    expect(url.searchParams.get("waypoints")).toContain(",");
  });

  it("maps cycling to a safe Apple Maps handoff", () => {
    const url = new URL(buildAppleMapsUrl(demoPlaces.slice(0, 2), "cycling"));
    expect(url.hostname).toBe("maps.apple.com");
    expect(url.searchParams.get("daddr")).toContain(",");
    expect(url.searchParams.get("dirflg")).toBe("w");
    expect(url.searchParams.get("saddr")).toContain(",");
  });

  it("builds hotel directions from the current location", () => {
    const url = new URL(buildGoogleMapsDirectionsUrl(demoPlaces[0]));
    expect(url.pathname).toContain("/maps/dir/");
    expect(url.searchParams.get("destination")).toContain(",");
  });
});
