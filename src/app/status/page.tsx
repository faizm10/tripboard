import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/site/logo";
import { SiteFooter } from "@/components/site/site-footer";
import { StatusBoard } from "@/components/admin/status-board";
import { getUptimeReport } from "@/lib/gcp-monitoring";
import { publicHealth, runHealthChecks } from "@/lib/health";

export const metadata: Metadata = { title: "Status", description: "Whether Tripboard and the services it uses are up right now." };
export const dynamic = "force-dynamic";

export default async function StatusPage() {
  const [health, uptime] = await Promise.all([runHealthChecks(), getUptimeReport()]);
  return (
    <main className="app-page status-page">
      <header className="changelog-header">
        <Logo />
        <Link className="text-link" href="/"><ArrowLeft size={15} /> Back to Tripboard</Link>
      </header>
      <section className="status-shell">
        <p className="eyebrow">status</p>
        <h1>Is Tripboard up?</h1>
        <StatusBoard health={publicHealth(health)} uptime={uptime} />
      </section>
      <SiteFooter />
    </main>
  );
}
