import { googleTransitOptions } from "@/lib/transit-routes";
import { transitOptionsSchema } from "@/lib/validators";

const noStore = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const parsed = transitOptionsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid transit request." }, { status: 400, headers: noStore });
  const result = await googleTransitOptions(parsed.data).catch(() => null);
  if (!result) return Response.json({ error: "Transit options are unavailable right now." }, { status: 502, headers: noStore });
  return Response.json(result, { headers: noStore });
}
