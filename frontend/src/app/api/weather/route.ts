import { z } from "zod";
import { weatherSource } from "@/lib/day-context";

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  date: z.iso.date(),
});

/** One day's weather near a stop, from Open-Meteo (free, no key). Temperatures are °C; the client converts. */
export async function GET(request: Request) {
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ error: "Need a location and a date." }, { status: 400 });
  const { lat, lng, date } = parsed.data;
  const source = weatherSource(date, new Date().toISOString().slice(0, 10));
  const forecast = source.kind === "forecast";
  const params = new URLSearchParams({
    latitude: lat.toFixed(3), longitude: lng.toFixed(3), timezone: "auto", start_date: source.date, end_date: source.date,
    daily: forecast ? "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max" : "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum",
  });
  const host = forecast ? "https://api.open-meteo.com/v1/forecast" : "https://archive-api.open-meteo.com/v1/archive";
  try {
    const response = await fetch(`${host}?${params}`, { next: { revalidate: forecast ? 3600 : 86_400 } });
    if (!response.ok) throw new Error(`Open-Meteo ${response.status}`);
    const body = await response.json() as { daily?: Record<string, (number | null)[]> };
    const daily = body.daily ?? {};
    const high = daily.temperature_2m_max?.[0];
    const low = daily.temperature_2m_min?.[0];
    if (high == null || low == null) return Response.json({ kind: "none" });
    return Response.json({
      kind: source.kind,
      code: daily.weather_code?.[0] ?? -1,
      high,
      low,
      rainChance: forecast ? daily.precipitation_probability_max?.[0] ?? null : null,
      rainMm: forecast ? null : daily.precipitation_sum?.[0] ?? null,
    }, { headers: { "Cache-Control": `public, max-age=${forecast ? 3600 : 86_400}` } });
  } catch {
    return Response.json({ kind: "none" }, { status: 502 });
  }
}
