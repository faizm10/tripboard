import { Activity, Cloud, Database, Rocket } from "lucide-react";
import { formatUptime } from "@/components/status-board";
import type { DatabaseStats } from "@/lib/admin";
import type { GcpAnalytics } from "@/lib/gcp-analytics";
import type { UptimeReport } from "@/lib/gcp-monitoring";
import type { runtimeDeployment, VercelDeployment, VercelReport } from "@/lib/vercel-api";

const number = new Intl.NumberFormat("en-US");
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

function bytes(value: number) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit += 1; }
  return `${size >= 10 || unit === 0 ? Math.round(size) : size.toFixed(1)} ${units[unit]}`;
}

function duration(ms: number | null) {
  if (ms === null) return "—";
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function percent(value: number | null, digits = 1) {
  return value === null ? "—" : `${(value * 100).toFixed(digits)}%`;
}

function ago(time: number) {
  const minutes = Math.round((Date.now() - time) / 60_000);
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}

function shortDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Daily stacked columns: the first series sits on the baseline, the second (errors) on top. */
function DailyBars({ days, series, label }: { days: { date: string; values: [number, number] }[]; series: [string, string]; label: string }) {
  const maximum = Math.max(1, ...days.map((day) => day.values[0] + day.values[1]));
  return (
    <figure className="platform-chart">
      <div className="platform-legend" aria-hidden="true"><span><i className="primary" /> {series[0]}</span><span><i className="error" /> {series[1]}</span></div>
      <div className="platform-bars" role="img" aria-label={label}>
        {days.map((day, index) => {
          const [first, second] = day.values;
          return (
            <div className="platform-bar-slot" key={day.date}>
              <span className="platform-tip">{shortDate(day.date)}<br />{series[0]}: {number.format(first)}<br />{series[1]}: {number.format(second)}</span>
              <div className="platform-bar">
                {second ? <span className="error" style={{ height: `${(second / maximum) * 100}%` }} /> : null}
                {first ? <span className="primary" style={{ height: `${(first / maximum) * 100}%` }} /> : null}
                {!first && !second ? <span className="empty" /> : null}
              </div>
              {index === 0 || index === days.length - 1 || index === Math.floor(days.length / 2) ? <small>{shortDate(day.date)}</small> : null}
            </div>
          );
        })}
      </div>
      <figcaption className="platform-axis-note">Peak {number.format(maximum)} a day</figcaption>
    </figure>
  );
}

function Setup({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="platform-setup"><strong>{title}</strong><p>{children}</p></div>;
}

function StatePill({ state }: { state: VercelDeployment["state"] }) {
  const tone = state === "READY" ? "operational" : state === "ERROR" ? "down" : state === "CANCELED" ? "not_configured" : "degraded";
  const label = { READY: "Ready", ERROR: "Failed", BUILDING: "Building", QUEUED: "Queued", INITIALIZING: "Starting", CANCELED: "Canceled" }[state];
  return <span className={`status-pill ${tone}`}>{label}</span>;
}

export function PlatformDashboard({ gcp, uptime, vercel, runtime, database }: {
  gcp: GcpAnalytics | null;
  uptime: UptimeReport | null;
  vercel: VercelReport | null;
  runtime: ReturnType<typeof runtimeDeployment>;
  database: DatabaseStats | null;
}) {
  const googleOk = gcp?.ok ? gcp : null;
  const vercelOk = vercel?.ok ? vercel : null;
  const primaryCheck = uptime?.ok ? uptime.checks.find((check) => check.name.includes("app")) ?? uptime.checks[0] : undefined;
  const googleRequests = googleOk ? googleOk.services.reduce((sum, service) => sum + service.requests, 0) : null;
  const googleToday = googleOk ? googleOk.services.reduce((sum, service) => sum + service.today, 0) : null;

  const tiles = [
    { icon: Activity, label: "Uptime, 30 days", value: primaryCheck ? formatUptime(primaryCheck.uptime.month) : "—", note: primaryCheck ? `24h ${formatUptime(primaryCheck.uptime.day)} · ${primaryCheck.current === "up" ? "up now" : primaryCheck.current === "down" ? "down now" : "no recent data"}` : "No uptime checks yet" },
    { icon: Cloud, label: "Google API calls, 30 days", value: googleRequests === null ? "—" : compact.format(googleRequests), note: googleToday === null ? "Connect Google Cloud" : `${number.format(googleToday)} in the last 24h` },
    { icon: Rocket, label: "Deploys, 30 days", value: vercelOk ? number.format(vercelOk.summary.total) : "—", note: vercelOk ? `${percent(vercelOk.summary.successRate, 0)} succeeded · median build ${duration(vercelOk.summary.medianBuildMs)}` : "Connect Vercel" },
    { icon: Database, label: "Database size", value: database ? bytes(database.sizeBytes) : "—", note: database ? `${database.tables.length} largest tables below` : "No database" },
  ];

  return <>
    <header className="admin-heading admin-list-heading">
      <div><p className="eyebrow">Platform</p><h1>Under the hood.</h1><p>Traffic, quotas, deploys and storage across Vercel, Google Cloud and Neon. Refreshes every minute.</p></div>
    </header>

    <section className="admin-metrics" aria-label="Platform summary">
      {tiles.map(({ icon: Icon, label, value, note }) => <article className="admin-metric" key={label}><Icon size={18} /><p>{label}</p><strong>{value}</strong><small>{note}</small></article>)}
    </section>

    <section className="platform-grid">
      <article className="admin-card platform-wide">
        <div className="admin-card-heading"><div><p className="eyebrow">Google Cloud · {gcp?.projectId ?? "not connected"}</p><h2>Google API traffic</h2></div></div>
        {!gcp ? <Setup title="Not connected">Set GCP_PROJECT_ID and GCP_SERVICE_ACCOUNT_KEY. See GCP_INTEGRATION.md.</Setup>
          : !gcp.ok ? <Setup title="Cloud Monitoring failed">{gcp.error}</Setup>
          : <>
            <DailyBars days={gcp.daily.map((day) => ({ date: day.date, values: [day.ok, day.errors] }))} label={`Daily Google API requests over ${gcp.daily.length} days`} series={["Successful", "Errors (4xx/5xx)"]} />
            {gcp.services.length ? (
              <div className="admin-table-wrap"><table className="platform-table"><thead><tr><th>Service</th><th>30 days</th><th>Last 24h</th><th>Error rate</th><th>p95 latency</th></tr></thead>
                <tbody>{gcp.services.map((service) => <tr key={service.service}><td><strong>{service.name}</strong><span>{service.service}</span></td><td>{number.format(service.requests)}</td><td>{number.format(service.today)}</td><td className={service.errorRate && service.errorRate > 0.02 ? "platform-warn" : undefined}>{percent(service.errorRate)}</td><td>{service.p95Ms === null ? "—" : `${Math.round(service.p95Ms)} ms`}</td></tr>)}</tbody></table></div>
            ) : <p className="admin-empty">No Google API calls in this project yet. Traffic appears once production uses the tripboard-ops Maps key.</p>}
          </>}
      </article>

      <article className="admin-card">
        <div className="admin-card-heading"><div><p className="eyebrow">Google Cloud</p><h2>Places quota today</h2></div></div>
        {googleOk ? <>
          <ul className="platform-quotas">{googleOk.quotas.map((quota) => {
            const share = quota.limit ? Math.min(1, quota.used / quota.limit) : 0;
            return <li key={quota.metric}>
              <div><strong>{quota.name}</strong><span>{number.format(quota.used)}{quota.limit ? ` of ${number.format(quota.limit)}` : ""}</span></div>
              <div className="platform-meter" role="meter" aria-label={`${quota.name} quota`} aria-valuemin={0} aria-valuemax={quota.limit ?? 0} aria-valuenow={quota.used}><span className={share >= 0.8 ? "error" : "primary"} style={{ width: `${Math.max(share ? 2 : 0, share * 100)}%` }} /></div>
            </li>;
          })}</ul>
          <p className="platform-footnote">Daily caps reset {new Date(googleOk.quotaResetsAt).toLocaleTimeString("en", { hour: "numeric", minute: "2-digit", timeZoneName: "short" })}. Turns red at 80%.</p>
        </> : <Setup title="Not connected">Quota use appears once Google Cloud is connected.</Setup>}
      </article>

      <article className="admin-card">
        <div className="admin-card-heading"><div><p className="eyebrow">Google Cloud</p><h2>Uptime checks</h2></div></div>
        {uptime?.ok && uptime.checks.length ? <ul className="admin-plain-list">{uptime.checks.map((check) => <li key={check.id}><strong>{check.name}</strong><span>{formatUptime(check.uptime.month)} over 30 days · 7d {formatUptime(check.uptime.week)} · every {Math.round(check.periodSeconds / 60)} min</span></li>)}</ul>
          : <Setup title={uptime && !uptime.ok ? "Cloud Monitoring failed" : "No uptime checks yet"}>{uptime && !uptime.ok ? uptime.error : "Create them with the commands in GCP_INTEGRATION.md once /api/health is live."}</Setup>}
      </article>

      <article className="admin-card platform-wide">
        <div className="admin-card-heading"><div><p className="eyebrow">Vercel{vercelOk ? ` · ${vercelOk.project.name}` : ""}</p><h2>Deployments</h2></div></div>
        {!vercel ? <Setup title="Not connected">Set VERCEL_API_TOKEN, VERCEL_PROJECT_ID and VERCEL_TEAM_ID. See GCP_INTEGRATION.md → Platform analytics.</Setup>
          : !vercel.ok ? <Setup title="Vercel API failed">{vercel.error}</Setup>
          : <>
            <DailyBars days={vercel.summary.daily.map((day) => ({ date: day.date, values: [day.ready, day.failed] }))} label={`Daily deployments over ${vercel.summary.daily.length} days`} series={["Ready", "Failed"]} />
            <div className="admin-table-wrap"><table className="platform-table"><thead><tr><th>Deployment</th><th>State</th><th>Build</th><th>When</th></tr></thead>
              <tbody>{vercel.deployments.slice(0, 12).map((deployment) => <tr key={deployment.id}>
                <td><a href={`https://${deployment.url}`} rel="noreferrer" target="_blank"><strong>{deployment.message ?? deployment.url}</strong></a><span>{deployment.production ? "Production" : "Preview"}{deployment.branch ? ` · ${deployment.branch}` : ""}{deployment.commit ? ` · ${deployment.commit}` : ""}{deployment.creator ? ` · ${deployment.creator}` : ""}</span></td>
                <td><StatePill state={deployment.state} /></td><td>{duration(deployment.buildMs)}</td><td>{ago(deployment.createdAt)}</td>
              </tr>)}</tbody></table></div>
          </>}
      </article>

      <article className="admin-card">
        <div className="admin-card-heading"><div><p className="eyebrow">Vercel</p><h2>This server</h2></div></div>
        <dl className="admin-detail-list">
          <div><dt>Environment</dt><dd>{runtime.environment}</dd></div>
          <div><dt>Region</dt><dd>{runtime.region ?? "local"}</dd></div>
          <div><dt>Commit</dt><dd>{runtime.commit ? `${runtime.commit}${runtime.branch ? ` on ${runtime.branch}` : ""}` : "—"}</dd></div>
          {vercelOk ? <>
            <div><dt>Live production</dt><dd>{vercelOk.production?.commit ?? "—"} · {vercelOk.production ? ago(vercelOk.production.createdAt) : "—"}</dd></div>
            <div><dt>Root directory</dt><dd>{vercelOk.project.rootDirectory || "repo root"}</dd></div>
            <div><dt>Node.js</dt><dd>{vercelOk.project.nodeVersion ?? "—"}</dd></div>
            <div><dt>Domains</dt><dd>{vercelOk.domains.map((domain) => `${domain.name}${domain.verified ? "" : " (unverified)"}`).join(", ") || "—"}</dd></div>
          </> : null}
        </dl>
      </article>

      <article className="admin-card">
        <div className="admin-card-heading"><div><p className="eyebrow">Neon</p><h2>Largest tables</h2></div></div>
        {database ? <div className="admin-table-wrap"><table className="platform-table"><thead><tr><th>Table</th><th>Rows</th><th>Size</th></tr></thead>
          <tbody>{database.tables.map((table) => <tr key={table.name}><td><strong>{table.name}</strong></td><td>{number.format(table.rows)}</td><td>{bytes(table.sizeBytes)}</td></tr>)}</tbody></table></div>
          : <Setup title="No database">DATABASE_URL isn&rsquo;t set.</Setup>}
      </article>
    </section>
  </>;
}
