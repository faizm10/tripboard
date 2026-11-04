import { publicHealth, runHealthChecks } from "@/lib/health";

export const dynamic = "force-dynamic";

/**
 * Public health probe for uptime monitors (see GCP_INTEGRATION.md).
 * Answers 503 only when a critical service is down, so a degraded
 * dependency doesn't page anyone. `?scope=app` skips the database and
 * auth calls for cheap, frequent probes.
 */
export async function GET(request: Request) {
  const scope = new URL(request.url).searchParams.get("scope") === "app" ? "app" : "full";
  const report = await runHealthChecks({ scope });
  return Response.json(publicHealth(report), {
    status: report.status === "down" ? 503 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
