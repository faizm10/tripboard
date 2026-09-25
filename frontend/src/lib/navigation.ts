import type { Place, RouteStop, TravelMode } from "@/lib/types";

export function buildGoogleMapsPlaceUrl(place: Place) {
  const [lng, lat] = place.coordinates;
  const params = new URLSearchParams({ api: "1", query: `${lat},${lng}` });
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

export function buildGoogleMapsDirectionsUrl(destination: Pick<RouteStop, "coordinates">) {
  const [lng, lat] = destination.coordinates;
  return `https://www.google.com/maps/dir/?${new URLSearchParams({ api: "1", destination: `${lat},${lng}` }).toString()}`;
}

/** Transit is a point-to-point handoff; it must never use a multi-stop waypoint route. */
export function buildGoogleMapsLegUrl(
  origin: Pick<RouteStop, "coordinates">,
  destination: Pick<RouteStop, "coordinates">,
  mode: "walking" | "transit",
) {
  const params = new URLSearchParams({
    api: "1",
    origin: `${origin.coordinates[1]},${origin.coordinates[0]}`,
    destination: `${destination.coordinates[1]},${destination.coordinates[0]}`,
    travelmode: mode,
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function buildGoogleMapsUrl(places: Array<Pick<RouteStop, "coordinates">>, mode: TravelMode) {
  const [origin, ...rest] = places;
  const destination = rest.at(-1) ?? origin;
  const waypoints = rest.slice(0, -1);
  const params = new URLSearchParams({
    api: "1",
    origin: `${origin.coordinates[1]},${origin.coordinates[0]}`,
    destination: `${destination.coordinates[1]},${destination.coordinates[0]}`,
    travelmode: mode === "cycling" ? "bicycling" : mode,
  });
  if (waypoints.length) {
    params.set(
      "waypoints",
      waypoints.map((place) => `${place.coordinates[1]},${place.coordinates[0]}`).join("|"),
    );
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function buildAppleMapsUrl(places: Array<Pick<RouteStop, "coordinates">>, mode: TravelMode) {
  const origin = places[0];
  const destination = places[1] ?? origin;
  const params = new URLSearchParams({
    daddr: `${destination.coordinates[1]},${destination.coordinates[0]}`,
    dirflg: mode === "walking" ? "w" : mode === "driving" ? "d" : "w",
  });
  if (places.length > 1) params.set("saddr", `${origin.coordinates[1]},${origin.coordinates[0]}`);
  return `https://maps.apple.com/?${params.toString()}`;
}
