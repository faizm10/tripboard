import Link from "next/link";
import { ArrowUpRight, CalendarDays, MapPinned, UsersRound } from "lucide-react";
import type { AdminRange, AwaitedAdminDashboard } from "@/lib/admin-types";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(value);
}

function RangePicker({ days }: { days: AdminRange }) {
  return <div className="admin-range" aria-label="Analytics date range">
    {[7, 30, 90].map((value) => <Link aria-current={value === days ? "page" : undefined} className={value === days ? "active" : undefined} href={`/admin?days=${value}`} key={value}>{value}d</Link>)}
  </div>;
}

export function AdminDashboard({ dashboard }: { dashboard: AwaitedAdminDashboard }) {
  const { metrics, trend, days, activity } = dashboard;
  const maximum = Math.max(1, ...trend.flatMap((point) => [point.users, point.trips]));
  const cards = [
    { label: "Registered people", value: formatNumber(metrics.registered), note: `+${metrics.newUsers} in ${days} days`, icon: UsersRound },
    { label: "Active people", value: formatNumber(metrics.activeUsers), note: "With a current session", icon: CalendarDays },
    { label: "Trips started", value: formatNumber(metrics.newTrips), note: `${metrics.collaborationRate}% planned together`, icon: MapPinned },
    { label: "Places saved", value: formatNumber(metrics.savedPlaces), note: `${metrics.invitationAcceptanceRate}% invite acceptance`, icon: ArrowUpRight },
  ];
  return <>
    <header className="admin-heading">
      <div><p className="eyebrow">Operations pulse</p><h1>The trip in motion.</h1><p>First-party signals from the people making plans on Tripboard.</p></div>
      <RangePicker days={days} />
    </header>
    <section className="admin-metrics" aria-label="Key metrics">
      {cards.map(({ label, value, note, icon: Icon }) => <article className="admin-metric" key={label}><Icon size={18} /><p>{label}</p><strong>{value}</strong><small>{note}</small></article>)}
    </section>
    <section className="admin-grid">
      <article className="admin-card admin-chart-card">
        <div className="admin-card-heading"><div><p className="eyebrow">Daily movement</p><h2>People and trips</h2></div><span><i className="users" /> People <i className="trips" /> Trips</span></div>
        <div className="admin-chart" aria-label={`Daily user and trip activity for the last ${days} days`}>
          {trend.map((point, index) => <div className="admin-bar-set" key={point.day} title={`${point.day}: ${point.users} people, ${point.trips} trips`}>
            <span className="admin-bar users" style={{ height: `${Math.max(point.users ? 10 : 2, (point.users / maximum) * 100)}%` }} />
            <span className="admin-bar trips" style={{ height: `${Math.max(point.trips ? 10 : 2, (point.trips / maximum) * 100)}%` }} />
            {index === 0 || index === trend.length - 1 || index === Math.floor(trend.length / 2) ? <small>{new Date(`${point.day}T00:00:00Z`).toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" })}</small> : null}
          </div>)}
        </div>
      </article>
      <article className="admin-card admin-activity-card">
        <div className="admin-card-heading"><div><p className="eyebrow">Live log</p><h2>Recent movement</h2></div><Link href="/admin/people">People <ArrowUpRight size={14} /></Link></div>
        <ol className="admin-activity-list">{activity.length ? activity.map((item) => <li key={item.id}><span>{item.kind}</span><strong>{item.title}</strong><p>{item.detail}</p><time>{formatDate(item.createdAt)}</time></li>) : <li className="admin-empty">No platform activity in this range.</li>}</ol>
      </article>
    </section>
  </>;
}
