import { z } from "zod";
import { hoursFromFoursquare, hoursFromGoogle, type DayHours } from "@/lib/day-context";
import { googleOpeningHours } from "@/lib/google-maps";

export const dynamic = "force-dynamic";

const dateSchema = z.iso.date();
const unknown: DayHours = { status: "unknown", text: "" };

/** Whether a saved place is open on a trip day. Hours are fetched live and not stored, like other place details. */
export async function GET(request: Request, { params }: { params: Promise<{ fsqPlaceId: string }> }) {
  const { fsqPlaceId } = await params;
  const date = dateSchema.safeParse(new URL(request.url).searchParams.get("date"));
  if (!date.success) return Response.json({ error: "Choose a day." }, { status: 400 });
  const headers = { "Cache-Control": "no-store" };

  const google = await googleOpeningHours(fsqPlaceId).catch(() => null);
  if (google) return Response.json(hoursFromGoogle(google, date.data), { headers });

  const apiKey = process.env.FOURSQUARE_API_KEY;
  if (!apiKey || fsqPlaceId.startsWith("demo-")) return Response.json(unknown, { headers });
  const response = await fetch(`https://places-api.foursquare.com/places/${encodeURIComponent(fsqPlaceId)}?fields=hours`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json", "X-Places-Api-Version": "2025-06-17" },
    cache: "no-store",
  }).catch(() => null);
  if (!response?.ok) return Response.json(unknown, { headers });
  const body = await response.json() as { hours?: { regular?: { day: number; open: string; close: string }[] } };
  return Response.json(hoursFromFoursquare(body.hours?.regular, date.data), { headers });
}
