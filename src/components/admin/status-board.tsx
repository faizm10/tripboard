import type { CheckStatus, HealthCheck, HealthReport, OverallStatus } from "@/lib/health";
import type { UptimeCheck, UptimeReport } from "@/lib/gcp-monitoring";

const OVERALL: Record<OverallStatus, string> = {
  operational: "All systems operational",
  degraded: "Some features are degraded",
  down: "Tripboard is having an outage",
};

const CHECK: Record<CheckStatus, string> = {
  operational: "Operational",
  degraded: "Degraded",
  down: "Down",
  not_configured: "Off",
};

export function formatUptime(value: number | null) {
  if (value === null) return "—";
  const percent = value * 100;
  return `${percent >= 99.995 ? "100" : percent.toFixed(2)}%`;
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(iso));
}

function dayTone(uptime: number | null) {
  if (uptime === null) return "none";
  if (uptime >= 0.995) return "up";
  if (uptime >= 0.95) return "partial";
  return "down";
}

type PublicCheck = Pick<HealthCheck, "id" | "label" | "status" | "probed" | "latencyMs"> & { detail?: string };

function UptimeRow({ check, admin }: { check: UptimeCheck; admin: boolean }) {
  return (
    <li className="status-uptime">
      <div className="status-uptime-heading">
        <strong>{check.name}</strong>
        <span className={`status-pill ${check.current === "up" ? "operational" : check.current === "down" ? "down" : "not_configured"}`}>
          {check.current === "up" ? "Up" : check.current === "down" ? "Down" : "No recent data"}
        </span>
      </div>
      {admin ? <p className="status-uptime-meta">{check.target} · every {Math.round(check.periodSeconds / 60)} min from {check.regions} regions</p> : null}
      <div className="status-days" role="img" aria-label={`${formatUptime(check.uptime.month)} uptime over ${check.daily.length} days`}>
        {check.daily.map((day) => <span className={dayTone(day.uptime)} key={day.date} title={`${day.date}: ${formatUptime(day.uptime)}`} />)}
      </div>
      <dl className="status-uptime-stats">
        <div><dt>24 hours</dt><dd>{formatUptime(check.uptime.day)}</dd></div>
        <div><dt>7 days</dt><dd>{formatUptime(check.uptime.week)}</dd></div>
        <div><dt>{check.daily.length} days</dt><dd>{formatUptime(check.uptime.month)}</dd></div>
      </dl>
    </li>
  );
}

function UptimeSection({ uptime, admin }: { uptime: UptimeReport | null; admin: boolean }) {
  if (!uptime) {
    if (!admin) return null;
    return (
      <section className="status-card">
        <p className="eyebrow">Uptime history</p>
        <h2>Connect Google Cloud Monitoring</h2>
        <p className="status-muted">Set <code>GCP_PROJECT_ID</code> and <code>GCP_SERVICE_ACCOUNT_KEY</code> to show uptime from probes that run outside Vercel. Setup steps are in <code>docs/gcp-integration.md</code>.</p>
      </section>
    );
  }
  if (!uptime.ok) {
    return (
      <section className="status-card">
        <p className="eyebrow">Uptime history</p>
        <h2>History is unavailable right now</h2>
        {admin ? <p className="status-muted">Cloud Monitoring ({uptime.projectId}): {uptime.error}</p> : null}
      </section>
    );
  }
  return (
    <section className="status-card">
      <p className="eyebrow">Uptime history</p>
      <h2>Checked from around the world</h2>
      {uptime.checks.length ? (
        <ul className="status-uptime-list">{uptime.checks.map((check) => <UptimeRow admin={admin} check={check} key={check.id} />)}</ul>
      ) : (
        <p className="status-muted">{admin ? `No uptime checks exist in ${uptime.projectId} yet.` : "No history yet."}</p>
      )}
      <p className="status-legend"><span className="up" /> Up <span className="partial" /> Some failures <span className="down" /> Mostly down <span className="none" /> No data</p>
    </section>
  );
}

export function StatusBoard({ health, uptime, admin = false }: { health: Omit<HealthReport, "checks"> & { checks: PublicCheck[] }; uptime: UptimeReport | null; admin?: boolean }) {
  return (
    <div className="status-board">
      <section className={`status-banner ${health.status}`} role="status">
        <span className="status-dot" aria-hidden="true" />
        <div>
          <strong>{OVERALL[health.status]}</strong>
          <p>Checked {formatTime(health.checkedAt)} · v{health.version}</p>
        </div>
      </section>
      <section className="status-card">
        <p className="eyebrow">Right now</p>
        <h2>Services</h2>
        <ul className="status-checks">
          {health.checks.map((check) => (
            <li key={check.id}>
              <div>
                <strong>{check.label}</strong>
                {admin && check.detail ? <p>{check.detail}</p> : null}
              </div>
              <span className="status-check-meta">
                {check.latencyMs !== undefined ? <small>{check.latencyMs} ms</small> : null}
                {admin && !check.probed && check.status === "operational" ? <small>key set, not probed</small> : null}
                <span className={`status-pill ${check.status}`}>{CHECK[check.status]}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
      <UptimeSection admin={admin} uptime={uptime} />
    </div>
  );
}
