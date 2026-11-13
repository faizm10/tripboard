import { vercel, vercelSettings, type VercelSettings } from "@/lib/vercel-api";

/**
 * Vercel Web Analytics for /admin/platform, read from the Observability
 * metrics API (`POST /metrics/v1`, the same query `vercel metrics` runs).
 * Production page views only. The token needs read access to Observability;
 * a token without it gets "Forbidden", which the page shows as-is.
 */

const CACHE_MS = 60_000;
export const ANALYTICS_DAYS = 30;
const METRIC = "vercel.analytics.page_view.count";

export type AnalyticsRow = { label: string; views: number };

export type WebAnalytics =
  | {
      ok: true;
      views: number;
      visitors: number | null;
      daily: { date: string; views: number; visitors: number }[];
      pages: AnalyticsRow[];
      referrers: AnalyticsRow[];
      countries: AnalyticsRow[];
      devices: AnalyticsRow[];
      fetchedAt: string;
    }
  | { ok: false; error: string };

type Point = { timestamp?: string; dimensions: Record<string, string | null>; values: Record<string, number | null> };
type MetricsResponse = { series?: Point[]; summary: Point[] };

/** Midnight UTC `days` days ago through the end of today, so daily buckets line up. */
export function analyticsWindow(days = ANALYTICS_DAYS, now = new Date()) {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const start = new Date(end.getTime() - days * 86_400_000);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function metricsQuery(settings: Pick<VercelSettings, "projectId" | "teamId">, window: { start: string; end: string }, groupBy?: string, limit = 6) {
  return {
    scope: { ownerId: settings.teamId, projectIds: [settings.projectId] },
    timeRange: window,
    bucketSeconds: 86_400,
    filter: "environment:production",
    metrics: groupBy
      ? { views: { metric: METRIC, aggregation: "count" } }
      : { views: { metric: METRIC, aggregation: "count" }, visitors: { metric: METRIC, aggregation: "unique", dimensions: ["visitorId"] } },
    outputs: groupBy ? ["views"] : ["views", "visitors"],
    ...(groupBy ? { groupBy: [groupBy], seriesSelection: { limit, mode: "exact", rankBy: [{ metric: "views", direction: "desc" }] } } : {}),
  };
}

export function toRows(response: MetricsResponse, dimension: string, fallback: string): AnalyticsRow[] {
  return response.summary
    .map((point) => ({ label: point.dimensions[dimension] || fallback, views: point.values.views ?? 0 }))
    .filter((row) => row.views > 0)
    .sort((a, b) => b.views - a.views);
}

export function toDaily(response: MetricsResponse) {
  return (response.series ?? []).map((point) => ({
    date: (point.timestamp ?? "").slice(0, 10),
    views: point.values.views ?? 0,
    visitors: point.values.visitors ?? 0,
  }));
}

let cached: { at: number; report: WebAnalytics } | null = null;

export async function getWebAnalytics(): Promise<WebAnalytics | null> {
  const settings = await vercelSettings();
  if (!settings) return null;
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.report;
  let report: WebAnalytics;
  try {
    const window = analyticsWindow();
    const query = (groupBy?: string) => vercel<MetricsResponse>("/metrics/v1", settings, {}, metricsQuery(settings, window, groupBy));
    const [totals, pages, referrers, countries, devices] = await Promise.all([
      query(),
      query("route"),
      query("referrerHostname"),
      query("country"),
      query("deviceType"),
    ]);
    report = {
      ok: true,
      views: totals.summary[0]?.values.views ?? 0,
      visitors: totals.summary[0]?.values.visitors ?? null,
      daily: toDaily(totals),
      pages: toRows(pages, "route", "Unknown page"),
      referrers: toRows(referrers, "referrerHostname", "Direct"),
      countries: toRows(countries, "country", "Unknown"),
      devices: toRows(devices, "deviceType", "Unknown"),
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    report = { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
  cached = { at: Date.now(), report };
  return report;
}
