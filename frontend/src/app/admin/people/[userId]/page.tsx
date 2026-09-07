import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ShieldAlert, ShieldCheck } from "lucide-react";
import { restoreUser, suspendUser } from "@/app/admin/actions";
import { AdminShell } from "@/components/admin-shell";
import { getAdminUser, getAdminViewer } from "@/lib/admin";

export const metadata: Metadata = { title: "Admin · Person" };
export const dynamic = "force-dynamic";

function date(value: Date) { return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(value); }

export default async function AdminPersonPage({ params }: { params: Promise<{ userId: string }> }) {
  const admin = await getAdminViewer();
  if (!admin) redirect("/trips");
  const { userId } = await params;
  const result = await getAdminUser(userId);
  if (!result) notFound();
  const { user, trips: userTrips, audit } = result;
  const isSelf = user.id === admin.id;
  return <AdminShell active="people" admin={admin}>
    <Link className="admin-back" href="/admin/people"><ArrowLeft size={15} /> People</Link>
    <header className="admin-person-heading"><div><p className="eyebrow">Account record</p><h1>{user.name || "Unnamed user"}</h1><p>{user.email}</p></div><span className={`admin-status ${user.banned ? "restricted" : ""}`}>{user.banned ? <ShieldAlert size={15} /> : <ShieldCheck size={15} />}{user.banned ? "Restricted" : "Active"}</span></header>
    <section className="admin-person-grid"><article className="admin-card"><p className="eyebrow">Account</p><dl className="admin-detail-list"><div><dt>Joined</dt><dd>{date(user.createdAt)}</dd></div><div><dt>Last active</dt><dd>{user.lastActiveAt ? date(user.lastActiveAt) : "No active session"}</dd></div><div><dt>Trip memberships</dt><dd>{user.tripCount}</dd></div>{user.banReason ? <div><dt>Restriction reason</dt><dd>{user.banReason}</dd></div> : null}</dl></article>
      <article className="admin-card admin-action-card"><p className="eyebrow">Access control</p><h2>{user.banned ? "Restore access" : "Restrict access"}</h2>{isSelf ? <p className="admin-empty">The sole administrator cannot change their own access.</p> : user.banned ? <form action={restoreUser}><input name="userId" type="hidden" value={user.id} /><p>Restore this person’s ability to access protected Tripboard pages.</p><button className="button button-ink" type="submit">Restore access</button></form> : <form action={suspendUser}><input name="userId" type="hidden" value={user.id} /><label className="field-label"><span>Reason</span><textarea name="reason" required rows={3} placeholder="Why is this access being restricted?" /></label><button className="button button-ink" type="submit">Restrict access</button></form>}</article></section>
    <section className="admin-card admin-person-section"><p className="eyebrow">Trip memberships</p>{userTrips.length ? <ul className="admin-plain-list">{userTrips.map((trip) => <li key={trip.id}><strong>{trip.title}</strong><span>{trip.destination} · created {date(trip.createdAt)}</span></li>)}</ul> : <p className="admin-empty">No trip memberships.</p>}</section>
    <section className="admin-card admin-person-section"><p className="eyebrow">Access history</p>{audit.length ? <ul className="admin-plain-list">{audit.map((entry) => <li key={entry.id}><strong>{entry.action === "suspend" ? "Access restricted" : "Access restored"}</strong><span>{entry.reason} · {date(entry.createdAt)}</span></li>)}</ul> : <p className="admin-empty">No administrative access changes.</p>}</section>
  </AdminShell>;
}
