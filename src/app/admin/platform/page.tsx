import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { PlatformDashboard } from "@/components/admin/platform-dashboard";
import { getAdminViewer, getDatabaseStats } from "@/lib/admin";
import { getGcpAnalytics } from "@/lib/gcp-analytics";
import { getUptimeReport } from "@/lib/gcp-monitoring";
import { getVercelReport, runtimeDeployment } from "@/lib/vercel-api";

export const metadata: Metadata = { title: "Admin · Platform" };
export const dynamic = "force-dynamic";

export default async function AdminPlatformPage() {
  const admin = await getAdminViewer();
  if (!admin) notFound();
  const [gcp, uptime, vercel, database] = await Promise.all([
    getGcpAnalytics(),
    getUptimeReport(),
    getVercelReport(),
    getDatabaseStats().catch(() => null),
  ]);
  return <AdminShell active="platform" admin={admin}>
    <PlatformDashboard database={database} gcp={gcp} runtime={runtimeDeployment()} uptime={uptime} vercel={vercel} />
  </AdminShell>;
}
