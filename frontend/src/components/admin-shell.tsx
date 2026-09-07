import Link from "next/link";
import { BarChart3, Compass, ShieldCheck, Users } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import type { AdminViewer } from "@/lib/admin";

export function AdminShell({ admin, active, children }: { admin: AdminViewer; active: "overview" | "people" | "trips"; children: React.ReactNode }) {
  return (
    <main className="app-page admin-page">
      <AppHeader email={admin.email} name={admin.name} highlightNav={false} />
      <section className="admin-shell">
        <aside className="admin-rail" aria-label="Admin navigation">
          <div className="admin-rail-intro">
            <span className="admin-signal"><ShieldCheck size={17} /></span>
            <div><p className="eyebrow">Tripboard</p><strong>Control tower</strong></div>
          </div>
          <nav className="admin-nav">
            <Link className={active === "overview" ? "active" : undefined} href="/admin"><BarChart3 size={16} /> Overview</Link>
            <Link className={active === "people" ? "active" : undefined} href="/admin/people"><Users size={16} /> People</Link>
            <Link className={active === "trips" ? "active" : undefined} href="/admin/trips"><Compass size={16} /> Trips</Link>
          </nav>
          <p className="admin-rail-note">Private operations view<br />for {admin.email}</p>
        </aside>
        <div className="admin-content">{children}</div>
      </section>
    </main>
  );
}
