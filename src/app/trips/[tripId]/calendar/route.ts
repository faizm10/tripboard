import { buildTripCalendar } from "@/lib/itinerary";
import { loadVisibleTrip } from "@/lib/trip-access";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const trip = await loadVisibleTrip(tripId);
  if (!trip) return new Response("Trip not found", { status: 404 });
  const filename = `${trip.title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "trip"}.ics`;
  return new Response(buildTripCalendar(trip, new URL(request.url).origin), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
