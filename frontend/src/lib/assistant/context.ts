import type { Trip } from "@/lib/types";

const MAX_PLACES = 120;

function dayLabel(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

/**
 * A compact plain-text picture of the trip for the model. Plain lines read
 * better than JSON for small free models and cost far fewer tokens.
 */
export function describeTrip(trip: Trip) {
  const lines: string[] = [];
  lines.push(`Trip: ${trip.title}`);
  lines.push(`Destination: ${trip.destination}`);
  lines.push(`Dates: ${trip.startDate && trip.endDate ? `${trip.startDate} to ${trip.endDate}` : "not set yet"}`);
  lines.push(`Travellers: ${trip.collaborators.map((person) => person.name).join(", ") || "just the viewer"}`);

  const cityName = new Map(trip.cities.map((city) => [city.id, city.name]));
  if (trip.cities.length) {
    lines.push("", "City stops:");
    for (const city of [...trip.cities].sort((a, b) => a.sortOrder - b.sortOrder)) {
      const dates = city.startDate ? ` (${city.startDate}${city.endDate ? ` to ${city.endDate}` : ""})` : "";
      lines.push(`- ${city.name}${city.country ? `, ${city.country}` : ""}${dates}`);
    }
  }

  if (trip.hotels.length) {
    lines.push("", "Hotels:");
    for (const hotel of trip.hotels) lines.push(`- ${hotel.name}, ${hotel.address} (${hotel.startDate} to ${hotel.endDate})`);
  }

  if (trip.flights.length) {
    lines.push("", "Getting there:");
    for (const flight of trip.flights) {
      const label = [flight.airline, flight.flightNumber].filter(Boolean).join(" ") || flight.mode || "flight";
      lines.push(`- ${label}: ${flight.departureAirport} ${flight.plannedDate} ${flight.departureTime} -> ${flight.arrivalAirport} ${flight.arrivalDate} ${flight.arrivalTime}`);
    }
  }

  const places = trip.places.slice(0, MAX_PLACES);
  const planned = places.filter((place) => place.plannedDate);
  const unplanned = places.filter((place) => !place.plannedDate);
  const describe = (place: Trip["places"][number]) => {
    const city = place.cityId ? cityName.get(place.cityId) : undefined;
    const note = place.note ? ` — note: ${place.note}` : "";
    return `${place.name} [${place.category}]${place.neighborhood ? `, ${place.neighborhood}` : ""}${city ? ` (${city})` : ""}${note}`;
  };

  if (planned.length) {
    lines.push("", "Day plan:");
    const byDay = new Map<string, typeof planned>();
    for (const place of planned) byDay.set(place.plannedDate!, [...(byDay.get(place.plannedDate!) ?? []), place]);
    for (const [date, dayPlaces] of [...byDay].sort(([a], [b]) => a.localeCompare(b))) {
      const ordered = dayPlaces.sort((a, b) => (a.daySortOrder ?? 0) - (b.daySortOrder ?? 0));
      lines.push(`${dayLabel(date)} (${date}):`);
      for (const place of ordered) lines.push(`  - ${describe(place)}`);
    }
  }

  lines.push("", unplanned.length ? "Saved places with no day yet:" : "Saved places with no day yet: none");
  for (const place of unplanned) lines.push(`- ${describe(place)}`);
  if (trip.places.length > MAX_PLACES) lines.push(`(…and ${trip.places.length - MAX_PLACES} more places not listed)`);

  const brief = trip.agenda.brief.trim();
  if (brief) lines.push("", `Trip brief: ${brief.slice(0, 1200)}`);
  const todos = trip.agenda.items.filter((item) => !item.completed).slice(0, 30);
  if (todos.length) {
    lines.push("", "Open agenda items:");
    for (const item of todos) lines.push(`- ${item.plannedDate ? `${item.plannedDate}${item.startTime ? ` ${item.startTime}` : ""}: ` : ""}${item.title}`);
  }

  return lines.join("\n");
}

export function assistantInstructions(trip: Trip, today: string) {
  return `You are Tripboard's trip assistant: a warm, sharp local-expert travel planner who lives in a sidebar next to the user's trip board.

Today is ${today}. Everything you know about this trip is below and is current.

<trip>
${describeTrip(trip)}
</trip>

How to help:
- Answer questions about the trip directly from the trip details above (what's planned, gaps, timing, who's coming).
- For any specific venue (restaurant, bar, sight, shop, hotel), call search_places first. Never invent a place or an address.
- Whenever you recommend specific places, present them with suggest_places using ids from your searches, so the user gets cards they can add with one tap. Pick the best 2–5; don't dump every result.
- Give each pick a one-line reason tied to this trip (location near their hotel or other stops, fits a gap in a day, matches their saved places).
- If you suggest a day for a place, use one of the trip's dates in YYYY-MM-DD form.
- You cannot change the trip yourself. Never say you added, moved or removed anything; the user taps "Add" on a card.
- Skip places the trip already has.
- Keep replies short and skimmable on a phone: a sentence or two, then bullets if needed. Use markdown sparingly. No headings.
- If the question is vague, make a sensible assumption and suggest, rather than asking several questions.`;
}
