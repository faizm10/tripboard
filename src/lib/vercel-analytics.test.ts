import { describe, expect, it } from "vitest";
import { analyticsWindow, metricsQuery, toDaily, toRows } from "@/lib/vercel-analytics";

describe("vercel web analytics", () => {
  it("covers whole UTC days ending tomorrow at midnight", () => {
    expect(analyticsWindow(30, new Date("2026-11-12T20:15:00Z"))).toEqual({ start: "2026-10-14T00:00:00.000Z", end: "2026-11-13T00:00:00.000Z" });
  });

  it("asks for production views and unique visitors, or a ranked breakdown", () => {
    const window = { start: "a", end: "b" };
    const totals = metricsQuery({ projectId: "prj", teamId: "team" }, window);
    expect(totals.filter).toBe("environment:production");
    expect(totals.outputs).toEqual(["views", "visitors"]);
    expect(totals).not.toHaveProperty("groupBy");
    const pages = metricsQuery({ projectId: "prj", teamId: "team" }, window, "route", 5);
    expect(pages).toMatchObject({ groupBy: ["route"], outputs: ["views"], seriesSelection: { limit: 5 } });
  });

  it("labels missing dimensions, drops empty rows and sorts by views", () => {
    const rows = toRows({ summary: [
      { dimensions: { referrerHostname: "google.com" }, values: { views: 2 } },
      { dimensions: { referrerHostname: null }, values: { views: 5 } },
      { dimensions: { referrerHostname: "x.com" }, values: { views: 0 } },
    ] }, "referrerHostname", "Direct");
    expect(rows).toEqual([{ label: "Direct", views: 5 }, { label: "google.com", views: 2 }]);
  });

  it("turns the series into daily views and visitors", () => {
    expect(toDaily({ summary: [], series: [{ timestamp: "2026-11-12T00:00:00.000Z", dimensions: {}, values: { views: 3, visitors: null } }] }))
      .toEqual([{ date: "2026-11-12", views: 3, visitors: 0 }]);
  });
});
