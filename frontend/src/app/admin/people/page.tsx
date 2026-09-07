import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Search, ShieldAlert } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { getAdminViewer, listAdminUsers } from "@/lib/admin";

export const metadata: Metadata = { title: "Admin · People" };
export const dynamic = "force-dynamic";

function date(value: Date | null) {
  return value ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(value) : "No active session";
}

export default async function AdminPeoplePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const admin = await getAdminViewer();
  if (!admin) redirect("/trips");
  const { q = "" } = await searchParams;
  const people = await listAdminUsers(q);
  return <AdminShell active="people" admin={admin}>
    <header className="admin-heading admin-list-heading"><div><p className="eyebrow">People</p><h1>Who is planning.</h1><p>Search identity and account-health information without exposing private trip content.</p></div></header>
    <form className="admin-search" action="/admin/people"><Search size={17} /><input defaultValue={q} name="q" placeholder="Search name or email" type="search" /><button className="button button-ink" type="submit">Search</button></form>
    <section className="admin-table-card" aria-label="People">
      <div className="admin-table-summary"><strong>{people.length} people</strong><span>Latest 100 matching accounts</span></div>
      {people.length ? <div className="admin-table-wrap"><table><thead><tr><th>Person</th><th>Status</th><th>Trips</th><th>Last active</th><th>Joined</th></tr></thead><tbody>{people.map((person) => <tr key={person.id}><td><Link href={`/admin/people/${person.id}`}><strong>{person.name || "Unnamed user"}</strong><span>{person.email}</span></Link></td><td>{person.banned ? <span className="admin-status restricted"><ShieldAlert size={13} /> Restricted</span> : <span className="admin-status">Active</span>}</td><td>{person.tripCount}</td><td>{date(person.lastActiveAt)}</td><td>{date(person.createdAt)}</td></tr>)}</tbody></table></div> : <div className="admin-empty">No people match that search.</div>}
    </section>
  </AdminShell>;
}
