import { getViewer } from "@/lib/auth";
import { getTrip } from "@/lib/demo-data";
import { getViewerTrip, toTripViewer } from "@/lib/trips";
import type { Trip } from "@/lib/types";

/** The same access rule as the trip page: a member's own trip, otherwise the public demo. */
export async function loadVisibleTrip(tripId: string): Promise<Trip | null> {
  const viewer = await getViewer();
  if (viewer?.restricted) return null;
  if (viewer && !viewer.demo) {
    const trip = await getViewerTrip(tripId, toTripViewer(viewer));
    if (trip) return trip;
  }
  if (tripId === "nyc-weekender" || viewer?.demo) return getTrip(tripId);
  return null;
}
