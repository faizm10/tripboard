import { describe, expect, it } from "vitest";
import { foldTraffic, pacificMidnight } from "@/lib/gcp-analytics";

describe("pacificMidnight", () => {
  it("finds the start of the Pacific day in winter and summer", () => {
    expect(pacificMidnight(new Date("2026-11-04T18:00:00Z")).toISOString()).toBe("2026-11-04T08:00:00.000Z");
    expect(pacificMidnight(new Date("2026-07-04T05:00:00Z")).toISOString()).toBe("2026-07-03T07:00:00.000Z");
  });
});

describe("foldTraffic", () => {
  it("splits errors from successes per day and totals each service", () => {
    const point = (end: string, value: number) => ({ interval: { endTime: end }, value: { int64Value: String(value) } });
    const { daily, services } = foldTraffic({
      timeSeries: [
        { resource: { labels: { service: "places.googleapis.com" } }, metric: { labels: { response_code_class: "2xx" } }, points: [point("2026-11-04T18:00:00Z", 90), point("2026-11-03T18:00:00Z", 40)] },
        { resource: { labels: { service: "places.googleapis.com" } }, metric: { labels: { response_code_class: "4xx" } }, points: [point("2026-11-04T18:00:00Z", 10)] },
      ],
    }, 2, new Date("2026-11-04T18:00:00Z"));
    expect(daily).toEqual([{ date: "2026-11-03", ok: 40, errors: 0 }, { date: "2026-11-04", ok: 90, errors: 10 }]);
    expect(services.get("places.googleapis.com")).toMatchObject({ requests: 140, today: 100, errors: 10 });
  });
});
