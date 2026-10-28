import { tool, type InferUITools, type UIDataTypes, type UIMessage } from "ai";
import { z } from "zod";
import { searchPlaces } from "@/lib/place-search";
import type { PlaceSearchResult, Trip } from "@/lib/types";

export type AssistantPick = PlaceSearchResult & {
  reason: string;
  plannedDate: string | null;
  alreadyInTrip: boolean;
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
      description: "Show recommended places to the user as cards with an Add to trip button. Only use ids returned by search_places.",
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
          places.push({
            ...place,
            reason: pick.reason,
            plannedDate: pick.day && tripDates.has(pick.day) ? pick.day : null,
            alreadyInTrip: tripPlaceIds.has(place.fsqPlaceId),
          });
        }
        return missing.length
          ? { places, note: `Unknown ids ${missing.join(", ")}: search first, then suggest using the returned ids.` }
          : { places };
      },
    }),
  };
}

export type AssistantTools = InferUITools<ReturnType<typeof createAssistantTools>>;

export type AssistantMetadata = { model?: string };

export type AssistantMessage = UIMessage<AssistantMetadata, UIDataTypes, AssistantTools>;
