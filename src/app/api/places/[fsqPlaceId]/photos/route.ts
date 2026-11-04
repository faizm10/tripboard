import { googlePlacePhotoUrl } from "@/lib/google-maps";
import type { PlacePhoto } from "@/lib/types";

export const dynamic = "force-dynamic";

type FoursquarePhoto = {
  prefix?: string;
  suffix?: string;
  width?: number;
  height?: number;
};

function normalizePhoto(photo: FoursquarePhoto | undefined, placeName: string): PlacePhoto | null {
  if (!photo?.prefix || !photo.suffix) return null;
  return {
    url: `${photo.prefix}600x600${photo.suffix}`,
    width: photo.width ?? 600,
    height: photo.height ?? 600,
    alt: `${placeName} from Foursquare`,
    credit: "Photo via Foursquare",
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ fsqPlaceId: string }> }) {
  const { fsqPlaceId } = await params;
  const apiKey = process.env.FOURSQUARE_API_KEY;
  const placeName = new URL(request.url).searchParams.get("name")?.trim() || "Saved place";

  const googlePhoto = await googlePlacePhotoUrl(fsqPlaceId, placeName).catch(() => null);
  if (googlePhoto) {
    return Response.json({ photo: googlePhoto, demo: false, provider: "google" }, { headers: { "Cache-Control": "no-store" } });
  }

  if (!apiKey || fsqPlaceId.startsWith("demo-")) {
    return Response.json({ photo: null, demo: true }, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const response = await fetch(
      `https://places-api.foursquare.com/places/${encodeURIComponent(fsqPlaceId)}/photos?limit=1&sort=POPULAR`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
          "X-Places-Api-Version": "2025-06-17",
        },
        cache: "no-store",
      },
    );
    if (!response.ok) {
      return Response.json({ photo: null, demo: false }, { headers: { "Cache-Control": "no-store" } });
    }

    const body = (await response.json()) as FoursquarePhoto[] | { results?: FoursquarePhoto[] };
    const first = Array.isArray(body) ? body[0] : body.results?.[0];
    return Response.json(
      { photo: normalizePhoto(first, placeName), demo: false },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ photo: null, demo: false }, { headers: { "Cache-Control": "no-store" } });
  }
}
