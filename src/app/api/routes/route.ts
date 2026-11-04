import { directionsSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const parsed = directionsSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Invalid route request." }, { status: 400 });
  const { coordinates, mode } = parsed.data;
  const token = process.env.MAPBOX_ACCESS_TOKEN ?? process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) {
    return Response.json({
      demo: true,
      distanceMeters: Math.round(coordinates.length * 1420),
      durationSeconds: Math.round(coordinates.length * (mode === "walking" ? 1020 : mode === "cycling" ? 420 : 300)),
      geometry: { type: "LineString", coordinates },
    });
  }
  const coordinatesPath = coordinates.map(([lng, lat]) => `${lng},${lat}`).join(";");
  const endpoint = `https://api.mapbox.com/directions/v5/mapbox/${mode}/${coordinatesPath}?geometries=geojson&overview=full&access_token=${encodeURIComponent(token)}`;
  const response = await fetch(endpoint, { cache: "no-store" });
  if (!response.ok) return Response.json({ error: "Directions are temporarily unavailable." }, { status: 502 });
  const body = (await response.json()) as { routes?: Array<{ distance: number; duration: number; geometry: unknown }> };
  const route = body.routes?.[0];
  if (!route) return Response.json({ error: "No route found." }, { status: 404 });
  return Response.json({
    demo: false,
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    geometry: route.geometry,
  });
}
