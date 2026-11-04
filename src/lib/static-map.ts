/**
 * Web Mercator helpers for the Mapbox Static Images API.
 *
 * The landing board draws its own pins and route on top of a static basemap, so
 * it needs the same projection Mapbox used to render that image. Center + zoom
 * are chosen here rather than handed to Mapbox as a bounding box, because an
 * explicit view is the only way to reproduce the projection exactly.
 */

export type LngLat = [longitude: number, latitude: number];

export type MapView = { center: LngLat; zoom: number };

const TILE_SIZE = 512;

/** Mapbox caps a requested static image at 1280px per side. */
export const MAX_STATIC_SIZE = 1280;

function mercatorX(longitude: number) {
  return (longitude + 180) / 360;
}

function mercatorY(latitude: number) {
  const radians = (latitude * Math.PI) / 180;
  return (1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2;
}

function longitudeAt(x: number) {
  return x * 360 - 180;
}

function latitudeAt(y: number) {
  return (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;
}

/** Smallest view that fits every point inside `width` x `height` with padding to spare. */
export function fitView(points: LngLat[], width: number, height: number, padding = 72): MapView {
  const xs = points.map(([longitude]) => mercatorX(longitude));
  const ys = points.map(([, latitude]) => mercatorY(latitude));
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 1e-9);
  const spanY = Math.max(maxY - minY, 1e-9);
  const worldSize = Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanY);
  return {
    center: [longitudeAt((minX + maxX) / 2), latitudeAt((minY + maxY) / 2)],
    zoom: Number(Math.log2(worldSize / TILE_SIZE).toFixed(3)),
  };
}

/** Position of a coordinate inside the rendered image, as CSS percentages. */
export function projectToPercent(point: LngLat, view: MapView, width: number, height: number) {
  const worldSize = TILE_SIZE * 2 ** view.zoom;
  const centerX = mercatorX(view.center[0]) * worldSize;
  const centerY = mercatorY(view.center[1]) * worldSize;
  const x = mercatorX(point[0]) * worldSize - centerX + width / 2;
  const y = mercatorY(point[1]) * worldSize - centerY + height / 2;
  return { left: (x / width) * 100, top: (y / height) * 100 };
}

/** Position of a coordinate in the image's own pixel space, for SVG overlays. */
export function projectToPixels(point: LngLat, view: MapView, width: number, height: number) {
  const { left, top } = projectToPercent(point, view, width, height);
  return { x: (left / 100) * width, y: (top / 100) * height };
}

export function staticMapUrl({
  view,
  width,
  height,
  token,
  style = "light-v11",
}: {
  view: MapView;
  width: number;
  height: number;
  token: string;
  style?: string;
}) {
  const { center, zoom } = view;
  const position = `${center[0].toFixed(6)},${center[1].toFixed(6)},${zoom},0,0`;
  const params = new URLSearchParams({
    access_token: token,
    // Attribution is rendered by the page instead, which Mapbox allows.
    attribution: "false",
    logo: "false",
  });
  return `https://api.mapbox.com/styles/v1/mapbox/${style}/static/${position}/${width}x${height}@2x?${params}`;
}

export type WalkingRoute = { coordinates: LngLat[]; durationSeconds: number; distanceMeters: number };

/**
 * Real walking geometry for the board's route line. Returns null on any failure
 * so the board can fall back to a schematic path — a marketing page should never
 * fail to build because a map API had a bad minute.
 */
export async function walkingRoute(points: LngLat[], token: string): Promise<WalkingRoute | null> {
  if (points.length < 2 || points.length > 25) return null;
  const path = points.map(([longitude, latitude]) => `${longitude},${latitude}`).join(";");
  const endpoint = `https://api.mapbox.com/directions/v5/mapbox/walking/${path}?geometries=geojson&overview=full&access_token=${encodeURIComponent(token)}`;
  try {
    const response = await fetch(endpoint, { next: { revalidate: 86400 } });
    if (!response.ok) return null;
    const body = (await response.json()) as {
      routes?: Array<{ distance: number; duration: number; geometry?: { coordinates?: LngLat[] } }>;
    };
    const route = body.routes?.[0];
    const coordinates = route?.geometry?.coordinates;
    if (!route || !coordinates?.length) return null;
    return {
      coordinates,
      durationSeconds: route.duration,
      distanceMeters: route.distance,
    };
  } catch {
    return null;
  }
}
