import { tool, type InferUITools, type UIDataTypes, type UIMessage } from "ai";
import { z } from "zod";
import { nearestHotel } from "@/lib/assistant/suggestions";
import { searchPlaces } from "@/lib/place-search";
import type { PlaceSearchResult, Trip } from "@/lib/types";

export type AssistantPick = PlaceSearchResult & {
  reason: string;
  plannedDate: string | null;
  alreadyInTrip: boolean;
  /** How far it is from where they're sleeping, so cards and the model can talk about it. */
  fromHotel?: { name: string; meters: number } | null;
};

/**
 * Search results get short ids ("p1", "p2"...) so the model can refer back to
 * them in suggest_places without retyping coordinates, which small models
 * get wrong. Ids from earlier turns are recovered from the chat history.
 */
export function knownSearchResults(messages: UIMessage[]) {
  const known = new Map<string, PlaceSearchResult>();
  for (const message of messages) {
    for (const part of message.parts) {
      if (part.type !== "tool-search_places" || !("output" in part)) continue;
      const output = part.output as { results?: Array<PlaceSearchResult & { id: string }> } | undefined;
      for (const result of output?.results ?? []) {
        if (result?.id && result.fsqPlaceId && Array.isArray(result.coordinates)) known.set(result.id, result);
      }
    }
  }
  return known;
}

export function createAssistantTools(trip: Trip, known: Map<string, PlaceSearchResult>) {
  const tripPlaceIds = new Set(trip.places.map((place) => place.fsqPlaceId));
  const tripDates = new Set<string>();
  if (trip.startDate && trip.endDate) {
    for (let day = new Date(`${trip.startDate}T00:00:00Z`); day <= new Date(`${trip.endDate}T00:00:00Z`) && tripDates.size < 60; day.setUTCDate(day.getUTCDate() + 1)) {
      tripDates.add(day.toISOString().slice(0, 10));
    }
  }
  const defaultNear = trip.cities[0] ? [trip.cities[0].name, trip.cities[0].country].filter(Boolean).join(", ") : trip.destination;

  return {
    search_places: tool({
      description: "Search real places (restaurants, cafes, bars, sights, shops, hotels, stations) in a city or neighbourhood. Returns ids to use with suggest_places.",
      inputSchema: z.object({
        query: z.string().min(1).max(120).describe('What to look for, e.g. "natural wine bar" or "rooftop with a view"'),
        near: z.string().max(120).optional().describe(`City or neighbourhood to search in. Defaults to ${defaultNear}.`),
      }),
      execute: async ({ query, near }) => {
        const where = near?.trim() || defaultNear;
        const outcome = await searchPlaces(query, where);
        if (!outcome.ok) return { query, near: where, results: [], error: outcome.error };
        const offset = known.size;
        const results = outcome.results.map((place, index) => {
          const id = `p${offset + index + 1}`;
          const result = { id, ...place, alreadyInTrip: tripPlaceIds.has(place.fsqPlaceId) };
          known.set(id, place);
          return result;
        });
        return { query, near: where, results };
      },
    }),
    suggest_places: tool({
      description: "Show recommended places to the user as cards with an Add to trip button, and as lettered pins on their trip map. Only use ids returned by search_places.",
      inputSchema: z.object({
        picks: z.array(z.object({
          id: z.string().describe("A place id from search_places, e.g. p3"),
          reason: z.string().max(220).describe("One short line on why this fits the trip"),
          day: z.string().optional().describe("Optional trip date to plan it for, YYYY-MM-DD"),
        })).min(1).max(6),
      }),
      execute: async ({ picks }) => {
        const places: AssistantPick[] = [];
        const missing: string[] = [];
        for (const pick of picks) {
          const place = known.get(pick.id);
          if (!place) {
            missing.push(pick.id);
            continue;
          }
          if (places.some((existing) => existing.fsqPlaceId === place.fsqPlaceId)) continue;
          const plannedDate = pick.day && tripDates.has(pick.day) ? pick.day : null;
          places.push({
            ...place,
            reason: pick.reason,
            plannedDate,
            alreadyInTrip: tripPlaceIds.has(place.fsqPlaceId),
            fromHotel: nearestHotel(place.coordinates, trip.hotels, plannedDate),
          });
        }
        return missing.length
          ? { places, note: `Unknown ids ${missing.join(", ")}: search first, then suggest using the returned ids.` }
          : { places };
      },
    }),
    propose_changes: tool({
      description: "Draft edits to the trip from something the user pasted or asked for: places for the day plan, day notes, text for the shared agenda, and costs for Money. The user reviews the draft and taps Apply; nothing changes until then. Search each venue with search_places first and use its id.",
      inputSchema: z.object({
        summary: z.string().max(200).describe("One line describing the draft, e.g. \"Day 2 in Busan, the hotel links, and 3 costs\""),
        places: z.array(z.object({
          id: z.string().describe("A place id from search_places"),
          day: z.string().optional().describe("Trip date YYYY-MM-DD to plan it on; omit to save it without a day"),
          note: z.string().max(300).optional().describe("Short note from the pasted text, e.g. a time or booking detail"),
        })).max(30).optional(),
        dayNotes: z.array(z.object({
          day: z.string().describe("Trip date YYYY-MM-DD"),
          note: z.string().min(1).max(500),
        })).max(30).optional(),
        agenda: z.string().max(6000).optional().describe("Markdown to add to the end of the shared agenda: bookings, links, to-dos (- [ ] item), packing lists. Keep pasted links as they are."),
        expenses: z.array(z.object({
          title: z.string().min(1).max(80),
          amount: z.number().positive().max(1_000_000).describe("Total in major units, e.g. 700 or 12.5"),
          currency: z.string().regex(/^[A-Za-z]{3}$/).optional().describe("ISO code like CAD or KRW; omit to use the trip currency"),
          paidBy: z.string().max(40).optional().describe("Who paid, if the text says"),
          day: z.string().optional().describe("YYYY-MM-DD it was spent, if known"),
        })).max(30).optional(),
      }),
      execute: async ({ summary, places = [], dayNotes = [], agenda = "", expenses = [] }) => {
        const resolved: ProposedPlace[] = [];
        const missing: string[] = [];
        for (const pick of places) {
          const place = known.get(pick.id);
          if (!place) {
            missing.push(pick.id);
            continue;
          }
          const plannedDate = pick.day && tripDates.has(pick.day) ? pick.day : null;
          if (resolved.some((existing) => existing.fsqPlaceId === place.fsqPlaceId && existing.plannedDate === plannedDate)) continue;
          resolved.push({
            ...place,
            reason: "",
            note: pick.note?.trim() ?? "",
            plannedDate,
            alreadyInTrip: trip.places.some((saved) => saved.fsqPlaceId === place.fsqPlaceId && (saved.plannedDate ?? null) === plannedDate),
            fromHotel: nearestHotel(place.coordinates, trip.hotels, plannedDate),
          });
        }
        const changes: ProposedChanges = {
          summary,
          places: resolved,
          // Notes on days outside the trip have nowhere to show, so they're dropped.
          dayNotes: dayNotes.filter((item) => tripDates.has(item.day)).map((item) => ({ day: item.day, note: item.note.trim() })),
          agenda: agenda.trim(),
          expenses: expenses.map((item) => ({
            title: item.title.trim(),
            amountCents: Math.round(item.amount * 100),
            currency: item.currency ? item.currency.toUpperCase() : null,
            paidBy: item.paidBy?.trim() || null,
            day: item.day && /^\d{4}-\d{2}-\d{2}$/.test(item.day) ? item.day : null,
          })),
        };
        if (missing.length) changes.note = `Unknown ids ${missing.join(", ")}: search first, then propose using the returned ids.`;
        return changes;
      },
    }),
  };
}

export type ProposedPlace = AssistantPick & { note: string };
export type ProposedDayNote = { day: string; note: string };
export type ProposedExpense = { title: string; amountCents: number; currency: string | null; paidBy: string | null; day: string | null };
export type ProposedChanges = {
  summary: string;
  places: ProposedPlace[];
  dayNotes: ProposedDayNote[];
  agenda: string;
  expenses: ProposedExpense[];
  note?: string;
};

export type AssistantTools = InferUITools<ReturnType<typeof createAssistantTools>>;

export type AssistantMetadata = { model?: string };

export type AssistantMessage = UIMessage<AssistantMetadata, UIDataTypes, AssistantTools>;
