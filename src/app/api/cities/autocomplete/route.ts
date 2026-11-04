import { formatCityLabel, filterDemoCities, type CitySuggestion } from "@/lib/cities";
import { googleCitySuggestions } from "@/lib/google-maps";

export const dynamic = "force-dynamic";

type MapboxFeature = {
  id?: string;
  text?: string;
  place_name?: string;
  center?: [number, number];
  context?: Array<{ id?: string; text?: string }>;
};

function contextPart(feature: MapboxFeature, prefix: string) {
  return feature.context?.find((entry) => entry.id?.startsWith(prefix))?.text;
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return Response.json({ results: [], demo: false });

  const google = await googleCitySuggestions(query).catch(() => null);
  if (google?.length) {
    return Response.json({ results: google, demo: false, provider: "google" }, { headers: { "Cache-Control": "no-store" } });
  }

  const token = process.env.MAPBOX_ACCESS_TOKEN ?? process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) {
    return Response.json({ results: filterDemoCities(query), demo: true }, { headers: { "Cache-Control": "no-store" } });
  }

  const endpoint = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`);
  endpoint.searchParams.set("access_token", token);
  endpoint.searchParams.set("autocomplete", "true");
  endpoint.searchParams.set("types", "place,locality,region,country");
  endpoint.searchParams.set("limit", "6");
  endpoint.searchParams.set("language", "en");

  const response = await fetch(endpoint, { cache: "no-store" });
  if (!response.ok) return Response.json({ error: "City search is temporarily unavailable." }, { status: 502 });

  const body = (await response.json()) as { features?: MapboxFeature[] };
  const seen = new Set<string>();
  const results: CitySuggestion[] = [];
  for (const feature of body.features ?? []) {
    const name = feature.text?.trim();
    if (!name) continue;
    const isCountry = feature.id?.startsWith("country.");
    const region = isCountry ? undefined : contextPart(feature, "region.");
    const country = isCountry ? name : contextPart(feature, "country.");
    const label = isCountry ? name : formatCityLabel({ name, region, country });
    if (seen.has(label)) continue;
    seen.add(label);
    results.push({
      id: feature.id ?? label,
      name,
      label,
      region,
      country,
      kind: isCountry ? "country" : "city",
      coordinates: feature.center,
    });
  }

  return Response.json({ results, demo: false, provider: "mapbox" }, { headers: { "Cache-Control": "no-store" } });
}
