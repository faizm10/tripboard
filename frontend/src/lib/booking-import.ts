import { z } from "zod";
import type { JourneyMode } from "@/lib/types";

export type ImportedJourney = {
  mode: JourneyMode;
  plannedDate: string;
  arrivalDate: string;
  airline: string;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  departureTime: string;
  arrivalTime: string;
};

export type ImportedHotel = { name: string; address: string; startDate: string; endDate: string };
export type ImportedBookings = { journeys: ImportedJourney[]; hotels: ImportedHotel[] };

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const clockTime = /^([01]?\d|2[0-3]):([0-5]\d)$/;

// Lenient on purpose: free models drift on field names and formats, so we normalize after parsing.
const text = z.unknown().transform((value) => (typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : ""));
const replySchema = z.object({
  journeys: z.array(z.object({
    mode: text, departureDate: text, arrivalDate: text, carrier: text, number: text,
    from: text, to: text, departureTime: text, arrivalTime: text,
  }).partial()).catch([]).default([]),
  hotels: z.array(z.object({ name: text, address: text, checkIn: text, checkOut: text }).partial()).catch([]).default([]),
});

export function bookingPrompt(email: string, tripStart?: string) {
  return `Extract travel bookings from the confirmation below. Reply with JSON only, no prose, in exactly this shape:
{"journeys":[{"mode":"flight|train|bus","departureDate":"YYYY-MM-DD","arrivalDate":"YYYY-MM-DD","carrier":"","number":"","from":"","to":"","departureTime":"HH:MM","arrivalTime":"HH:MM"}],"hotels":[{"name":"","address":"","checkIn":"YYYY-MM-DD","checkOut":"YYYY-MM-DD"}]}
Rules: one journey per flight segment or leg, including connections. For flights, "from" and "to" are 3-letter IATA airport codes. For trains and buses use station names. Times are local 24-hour. ${tripStart ? `If a year is missing, assume the trip around ${tripStart}. ` : ""}Use "" for anything not stated. Leave out anything that isn't a booking. Return {"journeys":[],"hotels":[]} if there are none.

Confirmation:
"""
${email}
"""`;
}

function firstJson(reply: string) {
  const start = reply.indexOf("{");
  const end = reply.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(reply.slice(start, end + 1));
  } catch {
    return null;
  }
}

function time(value?: string) {
  const match = value?.match(clockTime);
  return match ? `${match[1].padStart(2, "0")}:${match[2]}` : "";
}

function dayBefore(iso: string) {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/** Turns a model reply into bookings Tripboard can save, dropping anything missing the essentials. */
export function parseBookingReply(reply: string): ImportedBookings {
  const parsed = replySchema.safeParse(firstJson(reply) ?? {});
  if (!parsed.success) return { journeys: [], hotels: [] };
  const journeys = parsed.data.journeys.flatMap((leg): ImportedJourney[] => {
    const mode: JourneyMode = leg.mode === "train" || leg.mode === "bus" ? leg.mode : "flight";
    const plannedDate = isoDate.test(leg.departureDate ?? "") ? leg.departureDate! : "";
    const from = mode === "flight" ? (leg.from ?? "").toUpperCase() : leg.from ?? "";
    const to = mode === "flight" ? (leg.to ?? "").toUpperCase() : leg.to ?? "";
    const placesOk = mode === "flight" ? /^[A-Z]{3}$/.test(from) && /^[A-Z]{3}$/.test(to) : from.length >= 2 && to.length >= 2;
    if (!plannedDate || !placesOk) return [];
    return [{
      mode,
      plannedDate,
      arrivalDate: isoDate.test(leg.arrivalDate ?? "") && leg.arrivalDate! >= plannedDate ? leg.arrivalDate! : plannedDate,
      airline: (leg.carrier ?? "").slice(0, 80),
      flightNumber: (leg.number ?? "").slice(0, 20),
      departureAirport: from.slice(0, 80),
      arrivalAirport: to.slice(0, 80),
      departureTime: time(leg.departureTime),
      arrivalTime: time(leg.arrivalTime),
    }];
  });
  const hotels = parsed.data.hotels.flatMap((stay): ImportedHotel[] => {
    const checkIn = isoDate.test(stay.checkIn ?? "") ? stay.checkIn! : "";
    if (!stay.name || !checkIn) return [];
    // Tripboard stores the nights you sleep there: check-out morning isn't a hotel day.
    const checkOut = isoDate.test(stay.checkOut ?? "") && stay.checkOut! > checkIn ? dayBefore(stay.checkOut!) : checkIn;
    return [{ name: stay.name.slice(0, 120), address: (stay.address ?? "").slice(0, 240), startDate: checkIn, endDate: checkOut }];
  });
  return { journeys, hotels };
}
