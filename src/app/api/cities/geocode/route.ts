import { demoCityLocation, type CityLocation } from "@/lib/cities";
import { googleGeocode } from "@/lib/google-maps";

export const dynamic = "force-dynamic";

type MapboxFeature = {
  center?: [number, number];
  bbox?: [number, number, number, number];
};

function locationFromFeature(feature: MapboxFeature | undefined): CityLocation | null {
  const coordinates = feature?.center;
  if (!coordinates || coordinates.length !== 2) return null;
  return {
    coordinates,
    bbox: feature.bbox,
  };
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) {
    return Response.json({ coordinates: null, demo: false }, { headers: { "Cache-Control": "no-store" } });
  }

  const fallback = demoCityLocation(query);
  const google = await googleGeocode(query).catch(() => null);
  if (google) {
    return Response.json(
      { coordinates: google.coordinates, bbox: google.bbox, demo: false, provider: "google" },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const token = process.env.MAPBOX_ACCESS_TOKEN ?? process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) {
    return Response.json(
      { coordinates: fallback?.coordinates ?? null, bbox: fallback?.bbox, demo: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const endpoint = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`);
  endpoint.searchParams.set("access_token", token);
  endpoint.searchParams.set("autocomplete", "false");
  endpoint.searchParams.set("types", "poi,address,place,locality,region");
  endpoint.searchParams.set("limit", "1");
  endpoint.searchParams.set("language", "en");

  const response = await fetch(endpoint, { cache: "no-store" });
  if (!response.ok) {
    return Response.json(
      { coordinates: fallback?.coordinates ?? null, bbox: fallback?.bbox, demo: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const body = (await response.json()) as { features?: MapboxFeature[] };
  const location = locationFromFeature(body.features?.[0]) ?? fallback;
  return Response.json(
    { coordinates: location?.coordinates ?? null, bbox: location?.bbox, demo: false, provider: "mapbox" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
