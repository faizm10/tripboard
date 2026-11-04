import { sql } from "drizzle-orm";
import { APP_VERSION } from "@/lib/changelog";
import { getDatabase } from "@/lib/db";
import { checkSchemaHealth } from "@/lib/db/schema-health";
import { envValue, neonAuthSettings } from "@/lib/env";

export type CheckStatus = "operational" | "degraded" | "down" | "not_configured";
export type OverallStatus = "operational" | "degraded" | "down";

export type HealthCheck = {
  id: "app" | "database" | "schema" | "auth" | "maps" | "places" | "assistant";
  label: string;
  status: CheckStatus;
  /** False when the check only confirms a key is set, without calling the provider. */
  probed: boolean;
  /** A failed critical check takes the whole site down; the rest only degrade it. */
  critical: boolean;
  latencyMs?: number;
  /** Admin-only explanation. Never sent from the public endpoint. */
  detail?: string;
};

export type HealthReport = {
  status: OverallStatus;
  version: string;
  checkedAt: string;
  checks: HealthCheck[];
};

/** Probes slower than this still count as working, but the service shows as degraded. */
const SLOW_MS = 1500;
const TIMEOUT_MS = 5000;

async function timed<T>(work: () => Promise<T>) {
  const started = performance.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      work(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`Timed out after ${TIMEOUT_MS}ms`)), TIMEOUT_MS); }),
    ]);
    return { result, latencyMs: Math.round(performance.now() - started) };
  } finally {
    clearTimeout(timer);
  }
}

/** One retry absorbs a cold start (a waking Neon compute or auth server) so a single slow first call isn't reported as an outage. */
async function withRetry<T>(work: () => Promise<T>) {
  try {
    return await timed(work);
  } catch {
    return timed(work);
  }
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function configured(id: HealthCheck["id"], label: string, set: boolean, detail: string): HealthCheck {
  return { id, label, status: set ? "operational" : "not_configured", probed: false, critical: false, detail: set ? detail : "No key set, so this feature is off." };
}

async function databaseCheck(): Promise<HealthCheck> {
  const base = { id: "database", label: "Database", probed: true, critical: true } as const;
  const db = getDatabase();
  if (!db) return { ...base, status: "not_configured", detail: "DATABASE_URL isn't set, so trips are demo data." };
  try {
    const { latencyMs } = await withRetry(() => db.execute(sql`select 1`));
    return { ...base, status: latencyMs > SLOW_MS ? "degraded" : "operational", latencyMs, detail: latencyMs > SLOW_MS ? "Answering slowly. Neon may be waking from suspend." : "Neon Postgres answered." };
  } catch (error) {
    return { ...base, status: "down", detail: message(error) };
  }
}

async function schemaCheck(): Promise<HealthCheck> {
  const base = { id: "schema", label: "Database schema", probed: true, critical: false } as const;
  try {
    const health = await checkSchemaHealth();
    if (!health) return { ...base, status: "not_configured", detail: "No database to compare against." };
    const missing = [...health.tables, ...health.columns];
    return missing.length
      ? { ...base, status: "degraded", detail: `Missing: ${missing.join(", ")}. Run the newest SQL in drizzle/.` }
      : { ...base, status: "operational", detail: "Every table and column the code expects exists." };
  } catch (error) {
    return { ...base, status: "down", detail: message(error) };
  }
}

async function authCheck(): Promise<HealthCheck> {
  const base = { id: "auth", label: "Sign-in", probed: true, critical: true } as const;
  const settings = neonAuthSettings();
  if (!settings) return { ...base, status: "not_configured", detail: "Neon Auth isn't set up, so everyone uses the demo account." };
  try {
    // Any answer below 500 means the auth server is up and routing requests; a 5xx throws so it gets one retry.
    const { latencyMs } = await withRetry(async () => {
      const response = await fetch(`${settings.baseUrl.replace(/\/$/, "")}/ok`, { cache: "no-store" });
      if (response.status >= 500) throw new Error(`Neon Auth answered ${response.status}.`);
    });
    return { ...base, status: latencyMs > SLOW_MS ? "degraded" : "operational", latencyMs, detail: "Neon Auth answered." };
  } catch (error) {
    return { ...base, status: "down", detail: message(error) };
  }
}

export function overallStatus(checks: Pick<HealthCheck, "status" | "critical">[]): OverallStatus {
  if (checks.some((check) => check.critical && check.status === "down")) return "down";
  if (checks.some((check) => check.status === "down" || check.status === "degraded")) return "degraded";
  return "operational";
}

/**
 * Checks Tripboard and the services it depends on. `scope: "app"` skips every
 * outside call, for frequent uptime probes that shouldn't keep Neon awake.
 */
export async function runHealthChecks({ scope = "full" }: { scope?: "full" | "app" } = {}): Promise<HealthReport> {
  const app: HealthCheck = { id: "app", label: "Web app", status: "operational", probed: true, critical: true, detail: `Serving v${APP_VERSION}.` };
  const checks: HealthCheck[] = scope === "app" ? [app] : [
    app,
    ...(await Promise.all([databaseCheck(), schemaCheck(), authCheck()])),
    configured("maps", "Maps and directions", Boolean(envValue("NEXT_PUBLIC_MAPBOX_TOKEN")), "Mapbox token set."),
    configured("places", "Place search", Boolean(envValue("GOOGLE_MAPS_API_KEY") || envValue("FOURSQUARE_API_KEY")), envValue("GOOGLE_MAPS_API_KEY") ? "Google Places key set." : "Foursquare key set (Google key missing)."),
    configured("assistant", "Trip assistant", Boolean(envValue("OPENROUTER_API_KEY")), "OpenRouter key set."),
  ];
  return { status: overallStatus(checks), version: APP_VERSION, checkedAt: new Date().toISOString(), checks };
}

/** The shape served to anyone: statuses only, no error text or schema names. */
export function publicHealth(report: HealthReport) {
  return {
    ...report,
    checks: report.checks.map(({ id, label, status, probed, latencyMs }) => ({ id, label, status, probed, latencyMs })),
  };
}
