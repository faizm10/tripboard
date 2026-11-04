import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { StatusBoard } from "@/components/status-board";
import { getAdminViewer } from "@/lib/admin";
import { getUptimeReport } from "@/lib/gcp-monitoring";
import { runHealthChecks } from "@/lib/health";

export const metadata: Metadata = { title: "Admin · Status" };
export const dynamic = "force-dynamic";

export default async function AdminStatusPage() {
  const admin = await getAdminViewer();
  if (!admin) redirect("/trips");
  const [health, uptime] = await Promise.all([runHealthChecks(), getUptimeReport()]);
  return <AdminShell active="status" admin={admin}>
    <header className="admin-heading admin-list-heading"><div><p className="eyebrow">Status</p><h1>Every engine running?</h1><p>Live checks from this server, plus uptime history from Google Cloud Monitoring. The public version lives at <a href="/status">/status</a>.</p></div></header>
    <StatusBoard admin health={health} uptime={uptime} />
  </AdminShell>;
}
