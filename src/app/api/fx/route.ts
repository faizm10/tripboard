import { z } from "zod";

const querySchema = z.object({ from: z.string().regex(/^[A-Z]{3}$/), to: z.string().regex(/^[A-Z]{3}$/) });

/** Today's reference rate (European Central Bank, via Frankfurter) for converting an expense into the trip currency. */
export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) return Response.json({ error: "Choose two currencies." }, { status: 400 });
  const { from, to } = parsed.data;
  if (from === to) return Response.json({ rate: 1 });
  try {
    const response = await fetch(`https://api.frankfurter.dev/v1/latest?base=${from}&symbols=${to}`, { next: { revalidate: 3600 } });
    if (!response.ok) throw new Error(`Frankfurter ${response.status}`);
    const body = await response.json() as { rates?: Record<string, number>; date?: string };
    const rate = body.rates?.[to];
    if (!rate) throw new Error("No rate");
    return Response.json({ rate, date: body.date }, { headers: { "Cache-Control": "public, max-age=3600" } });
  } catch {
    return Response.json({ error: `Couldn’t look up ${from} to ${to}. Type the rate in instead.` }, { status: 502 });
  }
}
