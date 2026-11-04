import { describe, expect, it, vi } from "vitest";
import {
  fitView,
  projectToPercent,
  projectToPixels,
  staticMapUrl,
  walkingRoute,
  type LngLat,
} from "@/lib/static-map";

const lisbon: LngLat[] = [
  [-9.1544, 38.7367],
  [-9.1507, 38.7162],
  [-9.1349, 38.7107],
  [-9.1256, 38.7151],
];

describe("fitView", () => {
  it("centres on the middle of the points", () => {
    const view = fitView(lisbon, 760, 760, 150);
    expect(view.center[0]).toBeCloseTo(-9.14, 3);
    expect(view.center[1]).toBeCloseTo(38.7237, 3);
  });

  it("keeps every point inside the padded area", () => {
    const width = 760;
    const height = 760;
    const padding = 150;
    const view = fitView(lisbon, width, height, padding);
    for (const point of lisbon) {
      const { x, y } = projectToPixels(point, view, width, height);
      expect(x).toBeGreaterThanOrEqual(padding - 0.5);
      expect(x).toBeLessThanOrEqual(width - padding + 0.5);
      expect(y).toBeGreaterThanOrEqual(padding - 0.5);
      expect(y).toBeLessThanOrEqual(height - padding + 0.5);
    }
  });

  it("zooms out for a wider spread", () => {
    const tight = fitView(lisbon, 760, 760, 150);
    const wide = fitView([...lisbon, [-9.05, 38.66] as LngLat], 760, 760, 150);
    expect(wide.zoom).toBeLessThan(tight.zoom);
  });
});

describe("projectToPercent", () => {
  it("puts the view centre in the middle of the image", () => {
    const view = fitView(lisbon, 760, 760, 150);
    const { top, left } = projectToPercent(view.center, view, 760, 760);
    expect(left).toBeCloseTo(50, 6);
    expect(top).toBeCloseTo(50, 6);
  });

  it("orders points west to east and north to south", () => {
    const view = fitView(lisbon, 760, 760, 150);
    const projected = lisbon.map((point) => projectToPercent(point, view, 760, 760));
    // Gulbenkian is the westernmost and northernmost of the four.
    expect(projected[0].left).toBeLessThan(projected[3].left);
    expect(projected[0].top).toBeLessThan(projected[2].top);
  });
});

describe("staticMapUrl", () => {
  it("requests the given view and suppresses the baked-in attribution", () => {
    const view = { center: [-9.14, 38.7237] as LngLat, zoom: 13.24 };
    const url = staticMapUrl({ view, width: 760, height: 760, token: "tok-123" });
    expect(url).toContain("/styles/v1/mapbox/light-v11/static/");
    expect(url).toContain("-9.140000,38.723700,13.24,0,0");
    expect(url).toContain("/760x760@2x?");
    expect(url).toContain("access_token=tok-123");
    expect(url).toContain("attribution=false");
    expect(url).toContain("logo=false");
  });
});

describe("walkingRoute", () => {
  it("returns geometry and duration from a successful response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        routes: [{ distance: 4200, duration: 3300, geometry: { coordinates: lisbon } }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const route = await walkingRoute(lisbon, "tok");
    expect(route).toEqual({ coordinates: lisbon, durationSeconds: 3300, distanceMeters: 4200 });
    vi.unstubAllGlobals();
  });

  it("returns null rather than throwing when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(walkingRoute(lisbon, "tok")).resolves.toBeNull();
    vi.unstubAllGlobals();
  });

  it("returns null when the response carries no route", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ routes: [] }) }));
    await expect(walkingRoute(lisbon, "tok")).resolves.toBeNull();
    vi.unstubAllGlobals();
  });

  it("skips the request when there are too few points", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(walkingRoute([lisbon[0]], "tok")).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
