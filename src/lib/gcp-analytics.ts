import { accessToken, gcpSettings, monitoring, type SeriesResponse } from "@/lib/gcp-monitoring";

/**
 * Google API traffic, latency and quota use for the Tripboard project, read
 * from Cloud Monitoring with the same read-only service account as the
 * uptime history. Feeds /admin/platform.
 */

export const TRAFFIC_DAYS = 30;
const CACHE_MS = 60_000;

const SERVICE_NAMES: Record<string, string> = {
  "places.googleapis.com": "Places (New)",
  "geocoding-backend.googleapis.com": "Geocoding",
  "routes.googleapis.com": "Routes",
  "timezone-backend.googleapis.com": "Time Zone",
  "monitoring.googleapis.com": "Cloud Monitoring",
};

const QUOTA_NAMES: Record<string, string> = {
  AutocompletePlacesRequest: "Autocomplete",
  SearchTextRequest: "Text search",
  GetPlaceRequest: "Place details",
  GetPhotoMediaRequest: "Photos",
};

export type TrafficDay = { date: string; ok: number; errors: number };
export type ServiceTraffic = { service: string; name: string; requests: number; today: number; errors: number; errorRate: number | null; p95Ms: number | null };
export type QuotaUse = { metric: string; name: string; used: number; limit: number | null };

export type GcpAnalytics =
  | { ok: true; projectId: string; daily: TrafficDay[]; services: ServiceTraffic[]; quotas: QuotaUse[]; quotaResetsAt: string; fetchedAt: string }
  | { ok: false; projectId: string; error: string };

function pointValue(point: { value: { doubleValue?: number; int64Value?: string } }) {
  return point.value.doubleValue ?? Number(point.value.int64Value ?? 0);
}

/** Daily Google quotas reset at midnight Pacific time. */
export function pacificMidnight(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit", timeZoneName: "longOffset" })
      .formatToParts(now).map((part) => [part.type, part.value]),
  );
  const [, sign, hours, minutes] = /GMT([+-])(\d{2}):?(\d{2})?/.exec(parts.timeZoneName) ?? [, "-", "08", "00"];
  const offsetMs = (sign === "-" ? -1 : 1) * (Number(hours) * 60 + Number(minutes ?? 0)) * 60_000;
  return new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) - offsetMs);
}

/** Folds request_count series (per service and response class) into daily ok/error bars and per-service totals. */
export function foldTraffic(body: SeriesResponse, days = TRAFFIC_DAYS, now = new Date()) {
  const daily = Array.from({ length: days }, (_, index) => ({
    date: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1 - index))).toISOString().slice(0, 10),
    ok: 0,
    errors: 0,
  }));
  const byDate = new Map(daily.map((day) => [day.date, day]));
  const services = new Map<string, { requests: number; today: number; errors: number; latest: number }>();
  for (const series of body.timeSeries ?? []) {
    const service = series.resource?.labels.service ?? "unknown";
    const failed = /^[45]xx$/.test(series.metric.labels.response_code_class ?? "");
    const totals = services.get(service) ?? { requests: 0, today: 0, errors: 0, latest: 0 };
    for (const point of series.points ?? []) {
      const value = pointValue(point);
      const time = Date.parse(point.interval.endTime);
      const day = byDate.get(new Date(time - 1).toISOString().slice(0, 10));
      if (day) day[failed ? "errors" : "ok"] += value;
      totals.requests += value;
      if (failed) totals.errors += value;
      // Points arrive newest first; the newest window is the last 24 hours.
      if (time >= totals.latest) {
        if (time > totals.latest) totals.today = 0;
        totals.latest = time;
        totals.today += value;
      }
    }
    services.set(service, totals);
  }
  return { daily, services };
}

let cached: { at: number; report: GcpAnalytics } | null = null;

export async function getGcpAnalytics(): Promise<GcpAnalytics | null> {
  const settings = gcpSettings();
  if (!settings) return null;
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.report;
  const { projectId, account } = settings;
  let report: GcpAnalytics;
  try {
    const bearer = await accessToken(account);
    const end = new Date();
    const series = (filter: string, start: Date, alignSeconds: number, aligner: string, reducer: string, groupBy: string[]) => {
      const params = new URLSearchParams({
        filter,
        "interval.startTime": start.toISOString(),
        "interval.endTime": end.toISOString(),
        "aggregation.alignmentPeriod": `${Math.max(60, Math.round(alignSeconds))}s`,
        "aggregation.perSeriesAligner": aligner,
        "aggregation.crossSeriesReducer": reducer,
      });
      for (const field of groupBy) params.append("aggregation.groupByFields", field);
      return monitoring<SeriesResponse>(`projects/${projectId}/timeSeries`, bearer, params);
    };
    const quotaStart = pacificMidnight(end);
    const [traffic, latency, quotaUse, quotaLimits] = await Promise.all([
      series('metric.type="serviceruntime.googleapis.com/api/request_count" AND resource.type="consumed_api"',
        new Date(end.getTime() - TRAFFIC_DAYS * 86_400_000), 86_400, "ALIGN_SUM", "REDUCE_SUM", ["resource.label.service", "metric.label.response_code_class"]),
      series('metric.type="serviceruntime.googleapis.com/api/request_latencies" AND resource.type="consumed_api"',
        new Date(end.getTime() - 86_400_000), 86_400, "ALIGN_DELTA", "REDUCE_PERCENTILE_95", ["resource.label.service"]),
      series('metric.type="serviceruntime.googleapis.com/quota/rate/net_usage" AND resource.type="consumer_quota" AND resource.label.service="places.googleapis.com"',
        quotaStart, (end.getTime() - quotaStart.getTime()) / 1000, "ALIGN_SUM", "REDUCE_SUM", ["metric.label.quota_metric"]),
      series('metric.type="serviceruntime.googleapis.com/quota/limit" AND resource.type="consumer_quota" AND resource.label.service="places.googleapis.com"',
        new Date(end.getTime() - 86_400_000), 86_400, "ALIGN_NEXT_OLDER", "REDUCE_MIN", ["metric.label.limit_name"]),
    ]);

    const { daily, services } = foldTraffic(traffic, TRAFFIC_DAYS, end);
    const p95 = new Map((latency.timeSeries ?? []).map((row) => [row.resource?.labels.service ?? "", row.points?.[0] ? pointValue(row.points[0]) * 1000 : null]));
    const limits = new Map<string, number>();
    for (const row of quotaLimits.timeSeries ?? []) {
      // limit_name looks like "SearchTextRequestPerDayPerProject".
      const match = /^(.+)PerDayPerProject$/.exec(row.metric.labels.limit_name ?? "");
      if (match && row.points?.[0]) limits.set(match[1], pointValue(row.points[0]));
    }
    const used = new Map((quotaUse.timeSeries ?? []).map((row) => [
      (row.metric.labels.quota_metric ?? "").split("/").pop() ?? "",
      (row.points ?? []).reduce((sum, point) => sum + pointValue(point), 0),
    ]));

    report = {
      ok: true,
      projectId,
      daily,
      services: [...services.entries()]
        .map(([service, totals]) => ({
          service,
          name: SERVICE_NAMES[service] ?? service.replace(/\.googleapis\.com$/, ""),
          requests: totals.requests,
          today: totals.today,
          errors: totals.errors,
          errorRate: totals.requests ? totals.errors / totals.requests : null,
          p95Ms: p95.get(service) ?? null,
        }))
        .sort((a, b) => b.requests - a.requests),
      quotas: Object.entries(QUOTA_NAMES).map(([metric, name]) => ({ metric, name, used: used.get(metric) ?? 0, limit: limits.get(metric) ?? null })),
      quotaResetsAt: new Date(quotaStart.getTime() + 86_400_000).toISOString(),
      fetchedAt: end.toISOString(),
    };
  } catch (error) {
    report = { ok: false, projectId, error: error instanceof Error ? error.message : String(error) };
  }
  cached = { at: Date.now(), report };
  return report;
}
