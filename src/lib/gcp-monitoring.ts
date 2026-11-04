import { createSign } from "node:crypto";
import { envValue } from "@/lib/env";

/**
 * Reads Google Cloud Monitoring uptime checks so /status and /admin/status can
 * show history from probes that run outside Vercel. Setup lives in
 * GCP_INTEGRATION.md at the repo root. Without GCP_PROJECT_ID and
 * GCP_SERVICE_ACCOUNT_KEY everything here returns null and the pages fall
 * back to the live health checks alone.
 */

export const UPTIME_DAYS = 30;
const SCOPE = "https://www.googleapis.com/auth/monitoring.read";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://monitoring.googleapis.com/v3";
const CACHE_MS = 60_000;

type ServiceAccount = { client_email: string; private_key: string };

export type UptimeDay = { date: string; uptime: number | null };
export type UptimeCheck = {
  id: string;
  name: string;
  target: string;
  periodSeconds: number;
  regions: number;
  current: "up" | "down" | "unknown";
  uptime: { day: number | null; week: number | null; month: number | null };
  daily: UptimeDay[];
};
export type UptimeReport =
  | { ok: true; projectId: string; checks: UptimeCheck[]; fetchedAt: string }
  | { ok: false; projectId: string; error: string };

/** Accepts the key file's JSON as-is or base64-encoded, which survives env var UIs that mangle newlines. */
export function parseServiceAccount(raw: string | undefined): ServiceAccount | null {
  if (!raw) return null;
  const text = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  try {
    const parsed = JSON.parse(text) as Partial<ServiceAccount>;
    if (!parsed.client_email || !parsed.private_key) return null;
    return { client_email: parsed.client_email, private_key: parsed.private_key.replace(/\\n/g, "\n") };
  } catch {
    return null;
  }
}

export function gcpSettings() {
  const projectId = envValue("GCP_PROJECT_ID");
  const account = parseServiceAccount(envValue("GCP_SERVICE_ACCOUNT_KEY"));
  if (!projectId || !account) return null;
  return { projectId, account };
}

function base64url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

let token: { value: string; expiresAt: number } | null = null;

export async function accessToken(account: ServiceAccount) {
  if (token && token.expiresAt > Date.now() + 60_000) return token.value;
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(JSON.stringify({ iss: account.client_email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 }));
  const signature = createSign("RSA-SHA256").update(`${header}.${claims}`).sign(account.private_key);
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${header}.${claims}.${base64url(signature)}` }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Google sign-in failed (${response.status}). Check GCP_SERVICE_ACCOUNT_KEY.`);
  const body = await response.json() as { access_token: string; expires_in: number };
  token = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return token.value;
}

export async function monitoring<T>(path: string, bearer: string, params?: URLSearchParams) {
  const response = await fetch(`${API}/${path}${params ? `?${params}` : ""}`, { headers: { Authorization: `Bearer ${bearer}` }, cache: "no-store" });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? `Cloud Monitoring answered ${response.status}.`);
  }
  return response.json() as Promise<T>;
}

type ConfigResponse = {
  uptimeCheckConfigs?: {
    name: string;
    displayName: string;
    period?: string;
    selectedRegions?: string[];
    monitoredResource?: { labels?: Record<string, string> };
    httpCheck?: { path?: string; useSsl?: boolean };
  }[];
};
export type Point = { interval: { endTime: string }; value: { doubleValue?: number; int64Value?: string } };
export type SeriesResponse = { timeSeries?: { metric: { labels: Record<string, string> }; resource?: { labels: Record<string, string> }; points?: Point[] }[] };

/** Fraction of passing probes per check, averaged across regions, one point per `alignSeconds`. */
async function passFractions(projectId: string, bearer: string, start: Date, end: Date, alignSeconds: number) {
  const params = new URLSearchParams({
    filter: 'metric.type="monitoring.googleapis.com/uptime_check/check_passed" AND resource.type="uptime_url"',
    "interval.startTime": start.toISOString(),
    "interval.endTime": end.toISOString(),
    "aggregation.alignmentPeriod": `${alignSeconds}s`,
    "aggregation.perSeriesAligner": "ALIGN_FRACTION_TRUE",
    "aggregation.crossSeriesReducer": "REDUCE_MEAN",
    "aggregation.groupByFields": "metric.label.check_id",
  });
  const body = await monitoring<SeriesResponse>(`projects/${projectId}/timeSeries`, bearer, params);
  const byCheck = new Map<string, { time: number; value: number }[]>();
  for (const series of body.timeSeries ?? []) {
    const points = (series.points ?? [])
      .filter((point) => typeof point.value.doubleValue === "number")
      .map((point) => ({ time: Date.parse(point.interval.endTime), value: point.value.doubleValue as number }));
    byCheck.set(series.metric.labels.check_id, points);
  }
  return byCheck;
}

/** Buckets daily pass fractions into the last `days` UTC dates, oldest first, with null where nothing ran. */
export function dailyUptime(points: { time: number; value: number }[], days: number, now = new Date()): UptimeDay[] {
  const byDate = new Map<string, number[]>();
  for (const point of points) {
    // A point's end time closes the day it covers, so step back a moment to land in that day.
    const date = new Date(point.time - 1).toISOString().slice(0, 10);
    byDate.set(date, [...(byDate.get(date) ?? []), point.value]);
  }
  return Array.from({ length: days }, (_, index) => {
    const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1 - index)));
    const date = day.toISOString().slice(0, 10);
    const values = byDate.get(date);
    return { date, uptime: values?.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null };
  });
}

export function averageUptime(days: UptimeDay[]) {
  const known = days.filter((day): day is { date: string; uptime: number } => day.uptime !== null);
  return known.length ? known.reduce((sum, day) => sum + day.uptime, 0) / known.length : null;
}

let cached: { at: number; report: UptimeReport } | null = null;

export async function getUptimeReport(): Promise<UptimeReport | null> {
  const settings = gcpSettings();
  if (!settings) return null;
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.report;
  const { projectId, account } = settings;
  let report: UptimeReport;
  try {
    const bearer = await accessToken(account);
    const end = new Date();
    const monthStart = new Date(end.getTime() - UPTIME_DAYS * 86_400_000);
    const [configs, daily, recent] = await Promise.all([
      monitoring<ConfigResponse>(`projects/${projectId}/uptimeCheckConfigs`, bearer),
      passFractions(projectId, bearer, monthStart, end, 86_400),
      passFractions(projectId, bearer, new Date(end.getTime() - 20 * 60_000), end, 1200),
    ]);
    const checks = (configs.uptimeCheckConfigs ?? []).map((config): UptimeCheck => {
      const id = config.name.split("/").pop() ?? config.name;
      const days = dailyUptime(daily.get(id) ?? [], UPTIME_DAYS, end);
      const latest = recent.get(id)?.at(-1)?.value;
      const host = config.monitoredResource?.labels?.host ?? "";
      return {
        id,
        name: config.displayName,
        target: `${config.httpCheck?.useSsl === false ? "http" : "https"}://${host}${config.httpCheck?.path ?? "/"}`,
        periodSeconds: Number.parseInt(config.period ?? "60", 10),
        regions: config.selectedRegions?.length || 6,
        current: latest === undefined ? "unknown" : latest >= 0.5 ? "up" : "down",
        uptime: { day: days.at(-1)?.uptime ?? null, week: averageUptime(days.slice(-7)), month: averageUptime(days) },
        daily: days,
      };
    });
    report = { ok: true, projectId, checks, fetchedAt: end.toISOString() };
  } catch (error) {
    report = { ok: false, projectId, error: error instanceof Error ? error.message : String(error) };
  }
  cached = { at: Date.now(), report };
  return report;
}
