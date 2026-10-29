import { describe, expect, it } from "vitest";
import { buildItinerary, buildTripCalendar } from "@/lib/itinerary";
import { getTrip } from "@/lib/demo-data";

const trip = getTrip("nyc-weekender");

describe("itinerary", () => {
  it("lists each trip day with its journeys, hotel, and places in order", () => {
    const { days } = buildItinerary(trip);
    expect(days[0].date).toBe(trip.startDate);
    expect(days.at(-1)!.date >= trip.endDate).toBe(true);
    const planned = days.flatMap((day) => day.places);
    expect(planned.every((place) => place.plannedDate)).toBe(true);
  });
});

describe("trip calendar", () => {
  const ics = buildTripCalendar(trip, "https://usetripboard.vercel.app", new Date("2026-01-01T00:00:00Z"));

  it("is a valid calendar with CRLF line endings and no long lines", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(ics.split("\r\n").every((line) => line.length <= 75)).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(ics.match(/END:VEVENT/g)?.length);
  });

  it("times journeys in local time and makes hotel stays all-day through check-out", () => {
    const flight = trip.flights[0];
    expect(ics).toContain(`DTSTART:${flight.plannedDate.replaceAll("-", "")}T${flight.departureTime.replace(":", "")}00`);
    const hotel = trip.hotels[0];
    expect(ics).toContain(`DTSTART;VALUE=DATE:${hotel.startDate.replaceAll("-", "")}`);
  });

  it("escapes commas and semicolons in text", () => {
    const custom = { ...trip, title: "Rome; Florence, Venice" };
    expect(buildTripCalendar(custom, "https://x.test")).toContain("X-WR-CALNAME:Rome\; Florence\\, Venice");
  });
});
