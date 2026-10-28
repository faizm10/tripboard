import { searchPlaces } from "@/lib/place-search";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const near = url.searchParams.get("near")?.trim() || "Lisbon, Portugal";

  const outcome = await searchPlaces(query, near);
  if (!outcome.ok) return Response.json({ error: outcome.error }, { status: 502 });
  const { results, demo, provider } = outcome;
  return Response.json(provider ? { results, demo, provider } : { results, demo }, { headers: { "Cache-Control": "no-store" } });
}
