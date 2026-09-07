import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/logo";
import { NewTripForm } from "@/components/new-trip-form";
import { getViewer } from "@/lib/auth";

export const metadata: Metadata = { title: "New trip" };
export const dynamic = "force-dynamic";

export default async function NewTripPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");

  return (
    <main className="form-page">
      <header className="form-page-header">
        <Logo />
        <Link href="/trips">
          <ArrowLeft size={16} /> Back to trips
        </Link>
      </header>
      <div className="form-page-grid">
        <section className="form-intro">
          <p className="eyebrow">new trip</p>
          <h1>Begin with a place.</h1>
          <p>The dates can be rough. The shortlist can grow as the trip becomes real.</p>
          <div className="form-itinerary" aria-hidden="true">
            <span>01</span>
            <i />
            <span>02</span>
            <i />
            <span>03</span>
          </div>
        </section>
        <section className="form-panel">
          <p className="eyebrow">the basics</p>
          <h2>Name the trip.</h2>
          <NewTripForm />
        </section>
      </div>
    </main>
  );
}
