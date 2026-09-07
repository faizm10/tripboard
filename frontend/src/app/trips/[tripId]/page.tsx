import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { TripWorkspace } from "@/components/trip-workspace";
import { getViewer } from "@/lib/auth";
import { getTrip } from "@/lib/demo-data";
import { getViewerTrip, toTripViewer } from "@/lib/trips";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ tripId: string }> }): Promise<Metadata> {
  const { tripId } = await params;
  const viewer = await getViewer();
  if (viewer && !viewer.demo) {
    const trip = await getViewerTrip(tripId, toTripViewer(viewer));
    if (trip) return { title: trip.title };
  }
  if (tripId === "lisbon-weekender" || viewer?.demo) {
    return { title: getTrip(tripId).title };
  }
  return { title: "Trip" };
}

export default async function TripPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const viewer = await getViewer();
  const name = viewer?.name ?? "Traveller";

  if (viewer && !viewer.demo) {
    const trip = await getViewerTrip(tripId, toTripViewer(viewer));
    if (trip) {
      return (
        <main className="workspace-page">
          <AppHeader demo={viewer.demo} email={viewer.email} image={viewer.image} name={name} people={trip.collaborators} tripTitle={trip.title} />
          <TripWorkspace mapToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN} trip={trip} viewer={toTripViewer(viewer)} />
        </main>
      );
    }
  }

  if (tripId === "lisbon-weekender" || viewer?.demo) {
    const trip = getTrip(tripId);
    return (
      <main className="workspace-page">
        <AppHeader demo={viewer?.demo} email={viewer?.email} image={viewer?.image} name={name} people={trip.collaborators} tripTitle={trip.title} />
        <TripWorkspace
          mapToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
          trip={trip}
          viewer={viewer ? toTripViewer(viewer) : undefined}
        />
      </main>
    );
  }

  notFound();
}
