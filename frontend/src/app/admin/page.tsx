import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin-dashboard";
import { AdminShell } from "@/components/admin-shell";
import { adminRange, getAdminDashboard, getAdminViewer } from "@/lib/admin";
import { checkSchemaHealth } from "@/lib/db/schema-health";

export const metadata: Metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const admin = await getAdminViewer();
  if (!admin) redirect("/trips");
  const { days: rawDays } = await searchParams;
  const [dashboard, schemaHealth] = await Promise.all([
    getAdminDashboard(adminRange(rawDays)),
    checkSchemaHealth().catch(() => null),
  ]);
  if (!dashboard) return null;
  const missing = schemaHealth ? [...schemaHealth.tables, ...schemaHealth.columns] : [];
  return <AdminShell active="overview" admin={admin}>
    {missing.length ? (
      <aside className="admin-schema-warning" role="alert">
        <strong>The database is behind the code.</strong>
        <p>Saving will fail for features that use: {missing.join(", ")}. Run the newest SQL files in <code>frontend/drizzle/</code> on the production branch in Neon.</p>
      </aside>
    ) : null}
    <AdminDashboard dashboard={dashboard} />
  </AdminShell>;
}
