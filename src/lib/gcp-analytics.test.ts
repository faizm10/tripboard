import { describe, expect, it } from "vitest";
import { foldQuotas, foldTraffic, pacificMidnight } from "@/lib/gcp-analytics";

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

describe("foldQuotas", () => {
  const row = (service: string, labels: Record<string, string>, value: string) => ({
    resource: { labels: { service } },
    metric: { labels },
    points: [{ interval: { endTime: "2026-11-05T12:00:00Z" }, value: { int64Value: value } }],
  });

  it("matches usage and caps per API, and flags unlimited daily caps", () => {
    const quotas = foldQuotas(
      { timeSeries: [
        row("places.googleapis.com", { quota_metric: "places.googleapis.com/AutocompletePlacesRequest" }, "120"),
        row("routes.googleapis.com", { quota_metric: "routes.googleapis.com/compute_routes_requests" }, "3"),
      ] },
      { timeSeries: [
        row("places.googleapis.com", { limit_name: "AutocompletePlacesRequestPerDayPerProject" }, "3000"),
        row("routes.googleapis.com", { limit_name: "ComputeRoutesRequestsPerDay" }, "9223372036854775807"),
      ] },
    );
    const byName = Object.fromEntries(quotas.map((quota) => [quota.name, quota]));
    expect(byName["Place autocomplete"]).toMatchObject({ used: 120, limit: 3000, uncapped: false });
    expect(byName["Transit routes"]).toMatchObject({ used: 3, limit: null, uncapped: true });
    expect(byName["Time zones"]).toMatchObject({ used: 0, limit: null, uncapped: false });
  });
});
