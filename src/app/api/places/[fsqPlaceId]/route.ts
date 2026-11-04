import { demoSearchResults } from "@/lib/demo-data";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ fsqPlaceId: string }> }) {
  const { fsqPlaceId } = await params;
  const apiKey = process.env.FOURSQUARE_API_KEY;
  if (!apiKey) {
    const place = demoSearchResults.find((item) => item.fsqPlaceId === fsqPlaceId);
    return place
      ? Response.json({ place, demo: true }, { headers: { "Cache-Control": "no-store" } })
      : Response.json({ error: "Place not found." }, { status: 404 });
  }
  const response = await fetch(
    `https://places-api.foursquare.com/places/${encodeURIComponent(fsqPlaceId)}?fields=fsq_place_id,name,location,latitude,longitude,categories,hours,rating`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        "X-Places-Api-Version": "2025-06-17",
      },
      cache: "no-store",
    },
  );
  if (!response.ok) return Response.json({ error: "Place details are unavailable." }, { status: response.status });
  return Response.json({ place: await response.json(), demo: false }, { headers: { "Cache-Control": "no-store" } });
}
