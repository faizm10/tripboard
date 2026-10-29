import type { CityStop, Flight, HotelStay } from "@/lib/types";

/**
 * Picks the days a new hotel stay most likely covers, so people don't have to set
 * each one by hand. A city with its own dates wins; otherwise the stay runs from the
 * start day until the next departure, the next booked hotel, or the end of the trip.
 */
export function suggestHotelRange({ city, dates, flights, hotels, startDate }: {
  city?: CityStop | null;
  dates: string[];
  flights: Pick<Flight, "plannedDate">[];
  hotels: Pick<HotelStay, "id" | "startDate">[];
  startDate: string;
}): { startDate: string; endDate: string } {
  const first = dates[0] ?? startDate;
  const last = dates.at(-1) ?? startDate;
  const clamp = (date: string) => (date < first ? first : date > last ? last : date);

  if (city?.startDate && city.endDate && city.startDate <= city.endDate) {
    return { startDate: clamp(city.startDate), endDate: clamp(city.endDate) };
  }

  const start = startDate || first;
  const nextDeparture = flights.map((flight) => flight.plannedDate).filter((date) => date > start).sort()[0];
  const nextHotelStart = hotels.map((hotel) => hotel.startDate).filter((date) => date > start).sort()[0];
  const candidates = [last, nextDeparture, nextHotelStart && previousDay(nextHotelStart)].filter((date): date is string => Boolean(date) && date! >= start);
  return { startDate: start, endDate: candidates.sort()[0] ?? start };
}

function previousDay(iso: string) {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}
