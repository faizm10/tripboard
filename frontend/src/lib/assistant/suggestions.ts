import type { HotelStay } from "@/lib/types";
import type { AssistantMessage, AssistantPick } from "@/lib/assistant/tools";

/** An assistant pick as it appears on the map, lettered in the order the chat suggested it. */
export type MapSuggestion = AssistantPick & { label: string };

const MAX_SUGGESTIONS = 26;

/** A, B, … Z. Letters keep AI pins distinct from the numbered day stops. */
export function suggestionLabel(index: number) {
  return String.fromCharCode(65 + (index % 26));
}

/**
 * Every place the assistant has suggested in this chat, oldest first, once
 * each. The same pick in a later reply keeps its first letter so the card and
 * the pin always agree.
 */
export function collectSuggestions(messages: AssistantMessage[]): MapSuggestion[] {
  const seen = new Map<string, MapSuggestion>();
  for (const message of messages) {
    if (message.role !== "assistant") continue;
    for (const part of message.parts) {
      if (part.type !== "tool-suggest_places" || part.state !== "output-available") continue;
      for (const pick of part.output.places ?? []) {
        if (!pick?.fsqPlaceId || !Array.isArray(pick.coordinates)) continue;
        if (seen.has(pick.fsqPlaceId)) continue;
        if (seen.size >= MAX_SUGGESTIONS) return [...seen.values()];
        seen.set(pick.fsqPlaceId, { ...pick, label: suggestionLabel(seen.size) });
      }
    }
  }
  return [...seen.values()];
}

/** Great-circle distance in metres between two [lng, lat] points. */
export function distanceMeters([lng1, lat1]: [number, number], [lng2, lat2]: [number, number]) {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(a));
}

/** Beyond this the hotel is in another town, so the distance says nothing useful. */
const MAX_HOTEL_DISTANCE = 30_000;

export function hotelDistanceLabel(fromHotel?: { name: string; meters: number } | null, { short = false } = {}) {
  if (!fromHotel || fromHotel.meters > MAX_HOTEL_DISTANCE) return "";
  return `${formatDistance(fromHotel.meters)} from ${short ? "hotel" : fromHotel.name}`;
}

export function formatDistance(meters: number) {
  if (meters < 950) return `${Math.max(50, Math.round(meters / 50) * 50)} m`;
  return `${(meters / 1000).toFixed(meters < 9_500 ? 1 : 0)} km`;
}

/**
 * The hotel a pick should be measured from: the one booked on its planned
 * day, otherwise whichever hotel is closest.
 */
export function nearestHotel(coordinates: [number, number], hotels: HotelStay[], day?: string | null) {
  const onDay = day ? hotels.find((hotel) => hotel.startDate <= day && hotel.endDate >= day) : undefined;
  const candidates = onDay ? [onDay] : hotels;
  let best: { name: string; meters: number } | null = null;
  for (const hotel of candidates) {
    const meters = distanceMeters(coordinates, hotel.coordinates);
    if (!best || meters < best.meters) best = { name: hotel.name, meters: Math.round(meters) };
  }
  return best;
}
