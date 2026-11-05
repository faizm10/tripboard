import { getGoogleMapsKey } from "@/lib/google-maps";

/**
 * Transit options between two stops from the Google Routes API. Results are
 * fetched live for the editor and never stored; the saved ride keeps only the
 * user's own departure time and note.
 */

const DAY_MS = 86_400_000;
/** Routes accepts transit departure times from 7 days ago to 100 days ahead. */
const WINDOW_PAST_MS = 7 * DAY_MS;
const WINDOW_AHEAD_MS = 100 * DAY_MS;

export type TransitStepSummary =
  | { kind: "walk"; minutes: number }
  | {
      kind: "ride";
      line: string;
      vehicle: string;
      color?: string;
      textColor?: string;
      headsign?: string;
      from: string;
      to: string;
      departs?: string;
      arrives?: string;
      stops?: number;
    };

export type TransitOption = {
  minutes: number;
  departs?: string;
  arrives?: string;
  fare?: string;
  transfers: number;
  steps: TransitStepSummary[];
};

export type TransitOptionsResult = {
  options: TransitOption[];
  /** False when the trip date was outside Google's timetable window, so times are for today. */
  timedForTrip: boolean;
};

type LatLng = { latitude?: number; longitude?: number };
type LocalTime = { time?: { text?: string }; timeZone?: string };
type GoogleStep = {
  travelMode?: string;
  staticDuration?: string;
  transitDetails?: {
    stopDetails?: { departureStop?: { name?: string }; arrivalStop?: { name?: string } };
    localizedValues?: { departureTime?: LocalTime; arrivalTime?: LocalTime };
    headsign?: string;
    stopCount?: number;
    transitLine?: {
      name?: string;
      nameShort?: string;
      color?: string;
      textColor?: string;
      vehicle?: { name?: { text?: string }; type?: string };
    };
  };
};
type GoogleRoute = {
  duration?: string;
  legs?: Array<{ steps?: GoogleStep[] }>;
  localizedValues?: { transitFare?: { text?: string } };
};

const seconds = (duration?: string) => Number.parseFloat(duration ?? "0") || 0;
const latLng = ([longitude, latitude]: [number, number]): { location: { latLng: LatLng } } => ({ location: { latLng: { latitude, longitude } } });

/** Collapses Google's steps into rides and walks, merging back-to-back walks. */
export function summarizeTransitRoute(route: GoogleRoute): TransitOption | null {
  const steps: TransitStepSummary[] = [];
  for (const step of route.legs?.flatMap((leg) => leg.steps ?? []) ?? []) {
    const details = step.transitDetails;
    if (step.travelMode === "TRANSIT" && details) {
      const line = details.transitLine;
      steps.push({
        kind: "ride",
        line: line?.nameShort || line?.name || "Transit",
        vehicle: line?.vehicle?.name?.text || "Transit",
        color: line?.color,
        textColor: line?.textColor,
        headsign: details.headsign,
        from: details.stopDetails?.departureStop?.name ?? "",
        to: details.stopDetails?.arrivalStop?.name ?? "",
        departs: details.localizedValues?.departureTime?.time?.text,
        arrives: details.localizedValues?.arrivalTime?.time?.text,
        stops: details.stopCount,
      });
      continue;
    }
    const minutes = Math.round(seconds(step.staticDuration) / 60);
    const last = steps.at(-1);
    if (last?.kind === "walk") last.minutes += minutes;
    else if (minutes > 0) steps.push({ kind: "walk", minutes });
  }
  const rides = steps.filter((step) => step.kind === "ride");
  if (!rides.length) return null;
  return {
    minutes: Math.max(1, Math.round(seconds(route.duration) / 60)),
    departs: rides[0].departs,
    arrives: rides.at(-1)?.arrives,
    fare: route.localizedValues?.transitFare?.text,
    transfers: rides.length - 1,
    steps,
  };
}

/** UTC offset in seconds at a stop, from the Google Time Zone API. */
async function utcOffsetSeconds([longitude, latitude]: [number, number], approximateMs: number, key: string) {
  const endpoint = new URL("https://maps.googleapis.com/maps/api/timezone/json");
  endpoint.searchParams.set("location", `${latitude},${longitude}`);
  endpoint.searchParams.set("timestamp", String(Math.floor(approximateMs / 1000)));
  endpoint.searchParams.set("key", key);
  const response = await fetch(endpoint, { cache: "no-store" });
  if (!response.ok) return null;
  const body = (await response.json()) as { status?: string; rawOffset?: number; dstOffset?: number };
  return body.status === "OK" ? (body.rawOffset ?? 0) + (body.dstOffset ?? 0) : null;
}

/**
 * Turns the trip day and an optional "HH:MM" local time into the RFC3339
 * departure Google expects, or null when it falls outside the timetable window.
 */
export function departureTimestamp(date: string, time: string, offsetSeconds: number, now = Date.now()) {
  const wallClockAsUtc = Date.parse(`${date}T${time || "09:00"}:00Z`);
  if (!Number.isFinite(wallClockAsUtc)) return null;
  const instant = wallClockAsUtc - offsetSeconds * 1000;
  if (instant < now - WINDOW_PAST_MS || instant > now + WINDOW_AHEAD_MS) return null;
  return new Date(instant).toISOString();
}

export async function googleTransitOptions(input: {
  from: [number, number];
  to: [number, number];
  date: string;
  departureTime: string;
}): Promise<TransitOptionsResult | null> {
  const key = getGoogleMapsKey();
  if (!key) return null;
  const offset = await utcOffsetSeconds(input.from, Date.parse(`${input.date}T12:00:00Z`), key).catch(() => null);
  const departure = offset === null ? null : departureTimestamp(input.date, input.departureTime, offset);
  const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "routes.duration,routes.localizedValues.transitFare,routes.legs.steps.travelMode,routes.legs.steps.staticDuration,routes.legs.steps.transitDetails",
    },
    body: JSON.stringify({
      origin: latLng(input.from),
      destination: latLng(input.to),
      travelMode: "TRANSIT",
      computeAlternativeRoutes: true,
      languageCode: "en",
      ...(departure ? { departureTime: departure } : {}),
    }),
    cache: "no-store",
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { routes?: GoogleRoute[] };
  const options = (body.routes ?? []).flatMap((route) => summarizeTransitRoute(route) ?? []).slice(0, 3);
  return { options, timedForTrip: Boolean(departure) };
}
