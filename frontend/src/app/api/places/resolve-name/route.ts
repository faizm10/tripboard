import { googlePlaceNameFromAddress } from "@/lib/google-maps";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const address = url.searchParams.get("address")?.trim() ?? "";
  if (address.length < 2 || address.length > 300) {
    return Response.json({ name: null }, { headers: { "Cache-Control": "no-store" } });
  }

  const longitude = Number(url.searchParams.get("lng"));
  const latitude = Number(url.searchParams.get("lat"));
  const coordinates = Number.isFinite(longitude) && Number.isFinite(latitude) ? [longitude, latitude] as [number, number] : undefined;
  const name = await googlePlaceNameFromAddress(address, coordinates).catch(() => null);
  return Response.json({ name }, { headers: { "Cache-Control": "no-store" } });
}
