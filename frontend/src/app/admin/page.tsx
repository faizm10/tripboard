import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin-dashboard";
import { AdminShell } from "@/components/admin-shell";
import { adminRange, getAdminDashboard, getAdminViewer } from "@/lib/admin";

export const metadata: Metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const admin = await getAdminViewer();
  if (!admin) redirect("/trips");
  const { days: rawDays } = await searchParams;
  const dashboard = await getAdminDashboard(adminRange(rawDays));
  if (!dashboard) return null;
  return <AdminShell active="overview" admin={admin}><AdminDashboard dashboard={dashboard} /></AdminShell>;
}
