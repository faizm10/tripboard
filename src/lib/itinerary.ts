import type { DayNote, Flight, HotelStay, Place, Trip } from "@/lib/types";

export function addIsoDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export type ItineraryDay = {
  date: string;
  journeys: Flight[];
  hotel: HotelStay | null;
  places: Place[];
  notes: DayNote[];
};

/** Every day of the trip, plus any day a flight or hotel falls on, with what's planned for it in order. */
export function buildItinerary(trip: Pick<Trip, "startDate" | "endDate" | "flights" | "hotels" | "places" | "dayNotes">): { days: ItineraryDay[]; unplanned: Place[] } {
  const dates = new Set<string>();
  if (trip.startDate && trip.endDate) {
    for (let date = trip.startDate; date <= trip.endDate && dates.size < 60; date = addIsoDays(date, 1)) dates.add(date);
  }
  for (const flight of trip.flights) dates.add(flight.plannedDate);
  for (const hotel of trip.hotels) dates.add(hotel.startDate);
  for (const place of trip.places) if (place.plannedDate) dates.add(place.plannedDate);
  const days = [...dates].sort().map((date) => ({
    date,
    journeys: trip.flights.filter((flight) => flight.plannedDate === date).sort((left, right) => left.departureTime.localeCompare(right.departureTime)),
    hotel: trip.hotels.find((hotel) => hotel.startDate <= date && hotel.endDate >= date) ?? null,
    places: trip.places.filter((place) => place.plannedDate === date).sort((left, right) => (left.daySortOrder ?? 0) - (right.daySortOrder ?? 0)),
    notes: trip.dayNotes.filter((note) => note.plannedDate === date).sort((left, right) => left.sortOrder - right.sortOrder),
  }));
  return { days, unplanned: trip.places.filter((place) => !place.plannedDate && place.saved) };
}

function escapeText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Lines over 75 characters continue on the next line with a leading space, per RFC 5545. */
function fold(line: string) {
  const parts: string[] = [];
  for (let rest = line; rest.length; rest = rest.slice(73)) parts.push(rest.slice(0, 73));
  return parts.join("\r\n ");
}

const compactDate = (iso: string) => iso.replaceAll("-", "");
const localTime = (iso: string, time: string) => `${compactDate(iso)}T${time.replace(":", "")}00`;

function journeyLabel(flight: Flight) {
  const mode = flight.mode === "train" ? "Train" : flight.mode === "bus" ? "Bus" : "Flight";
  return `${mode} ${flight.departureAirport} → ${flight.arrivalAirport}${flight.flightNumber ? ` (${flight.flightNumber})` : ""}`;
}

/**
 * A calendar of the trip: timed events for each flight, train, or bus (in local time, which is how
 * bookings list them), an all-day event per hotel stay, and an all-day event per day listing its stops.
 */
export function buildTripCalendar(trip: Trip, origin: string, now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const events: string[][] = [];
  const event = (uid: string, fields: string[]) => events.push(["BEGIN:VEVENT", `UID:${uid}@usetripboard`, `DTSTAMP:${stamp}`, ...fields, "END:VEVENT"]);
  const tripUrl = `${origin}/trips/${trip.id}`;

  for (const flight of trip.flights) {
    event(`journey-${flight.id}`, [
      `DTSTART:${localTime(flight.plannedDate, flight.departureTime)}`,
      `DTEND:${localTime(flight.arrivalDate, flight.arrivalTime)}`,
      `SUMMARY:${escapeText(journeyLabel(flight))}`,
      `LOCATION:${escapeText(flight.departureAirport)}`,
      `DESCRIPTION:${escapeText([flight.airline, flight.flightNumber].filter(Boolean).join(" ") || "Getting there")}`,
    ]);
  }
  for (const hotel of trip.hotels) {
    event(`hotel-${hotel.id}`, [
      `DTSTART;VALUE=DATE:${compactDate(hotel.startDate)}`,
      `DTEND;VALUE=DATE:${compactDate(addIsoDays(hotel.endDate, 1))}`,
      `SUMMARY:${escapeText(`Stay: ${hotel.name}`)}`,
      `LOCATION:${escapeText(hotel.address || hotel.name)}`,
      "TRANSP:TRANSPARENT",
    ]);
  }
  for (const day of buildItinerary(trip).days) {
    if (!day.places.length && !day.notes.length) continue;
    const names = day.places.map((place) => place.name);
    const summary = names.length ? `${trip.title}: ${names.slice(0, 2).join(", ")}${names.length > 2 ? ` +${names.length - 2}` : ""}` : `${trip.title}: day notes`;
    const description = [
      ...day.places.map((place, index) => `${index + 1}. ${place.name}${place.address ? ` · ${place.address}` : ""}${place.note ? ` · ${place.note}` : ""}`),
      ...day.notes.map((note) => `Note: ${note.note}`),
      "",
      `Open in Tripboard: ${tripUrl}`,
    ].join("\n");
    event(`day-${trip.id}-${day.date}`, [
      `DTSTART;VALUE=DATE:${compactDate(day.date)}`,
      `DTEND;VALUE=DATE:${compactDate(addIsoDays(day.date, 1))}`,
      `SUMMARY:${escapeText(summary)}`,
      `DESCRIPTION:${escapeText(description)}`,
      ...(day.places[0]?.address ? [`LOCATION:${escapeText(day.places[0].address)}`] : []),
      `URL:${tripUrl}`,
      "TRANSP:TRANSPARENT",
    ]);
  }

  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Tripboard//Trip calendar//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${escapeText(trip.title)}`, ...events.flat(), "END:VCALENDAR"]
    .map(fold)
    .join("\r\n") + "\r\n";
}
