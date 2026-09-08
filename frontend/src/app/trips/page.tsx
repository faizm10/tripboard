import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { TripCard } from "@/components/trip-card";
import { getViewer } from "@/lib/auth";
import { demoTrips } from "@/lib/demo-data";
import { listViewerTrips, toTripViewer } from "@/lib/trips";
import { isPersistedTripId } from "@/lib/types";

export const metadata: Metadata = { title: "Your trips" };
export const dynamic = "force-dynamic";

export default async function TripsPage() {
  const viewer = await getViewer();
  if (!viewer || viewer.restricted) redirect("/sign-in?restricted=1");

  const firstName = viewer.name?.split(" ")[0] ?? "Traveller";
  const trips = viewer.demo ? demoTrips : await listViewerTrips(toTripViewer(viewer));

  return (
    <main className="app-page">
      <AppHeader demo={viewer.demo} email={viewer.email} image={viewer.image} name={viewer.name ?? firstName} />
      <section className="trips-shell">
        <div className="trips-heading">
          <div className="trips-heading-copy">
            <p className="eyebrow">your trips</p>
            <h1>
              Where to next,
              <br />
              {firstName}?
            </h1>
          </div>
          <div className="trips-heading-note">
            <p>
              {trips.length === 0 && !viewer.demo
                ? "Start with a place and keep the shortlist here."
                : "A quiet index of everywhere you are considering."}
            </p>
            <Link className="button button-ink" href="/trips/new">
              {trips.length === 0 && !viewer.demo ? "Start a trip" : "New trip"} <Plus size={17} />
            </Link>
          </div>
        </div>
        <div className="trip-index-list">
          {trips.length === 0 && !viewer.demo ? (
            <div className="trips-empty">
              <p className="eyebrow">No trips yet</p>
              <h2>Your map is empty.</h2>
              <p>Create a trip, save the first place, and it will live here with your account.</p>
            </div>
          ) : (
            trips.map((trip, index) => (
              <TripCard
                canDelete={
                  isPersistedTripId(trip.id) &&
                  trip.collaborators.some((person) => person.id === viewer.id && person.role === "owner")
                }
                index={index}
                key={trip.id}
                trip={trip}
              />
            ))
          )}
          <Link className="new-trip-card" href="/trips/new">
            <span>
              <Plus size={22} />
            </span>
            <div>
              <p className="eyebrow">Blank trip</p>
              <h2>Start somewhere new</h2>
            </div>
          </Link>
        </div>
        {viewer.demo ? (
          <p className="demo-note">Demo mode · Connect Neon and provider keys for live accounts, places, and maps.</p>
        ) : null}
      </section>
    </main>
  );
}
