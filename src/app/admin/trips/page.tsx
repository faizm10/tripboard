import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { getAdminViewer, listAdminTrips } from "@/lib/admin";

export const metadata: Metadata = { title: "Admin · Trips" };
export const dynamic = "force-dynamic";

function date(value: Date) { return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(value); }

export default async function AdminTripsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const admin = await getAdminViewer();
  if (!admin) redirect("/trips");
  const { q = "" } = await searchParams;
  const tripRows = await listAdminTrips(q);
  return <AdminShell active="trips" admin={admin}>
    <header className="admin-heading admin-list-heading"><div><p className="eyebrow">Trips</p><h1>Boards on the map.</h1><p>Operational trip metadata only. Notes, source links, and itinerary details stay private.</p></div></header>
    <form className="admin-search" action="/admin/trips"><Search size={17} /><input defaultValue={q} name="q" placeholder="Search title or destination" type="search" /><button className="button button-ink" type="submit">Search</button></form>
    <section className="admin-table-card" aria-label="Trips">
      <div className="admin-table-summary"><strong>{tripRows.length} trips</strong><span>Latest 100 matching boards</span></div>
      {tripRows.length ? <div className="admin-table-wrap"><table><thead><tr><th>Trip</th><th>Owner</th><th>Members</th><th>Places</th><th>Created</th></tr></thead><tbody>{tripRows.map((trip) => <tr key={trip.id}><td><strong>{trip.title}</strong><span>{trip.destination}</span></td><td><strong>{trip.ownerName}</strong><span>{trip.ownerEmail || "No email recorded"}</span></td><td>{trip.memberCount}</td><td>{trip.placeCount}</td><td>{date(trip.createdAt)}</td></tr>)}</tbody></table></div> : <div className="admin-empty">No trips match that search.</div>}
    </section>
  </AdminShell>;
}
