// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { describeTrip } from "@/lib/assistant/context";
import { assistantModels, DEFAULT_ASSISTANT_MODELS, shortModelName } from "@/lib/assistant/models";
import { createAssistantTools, knownSearchResults, type AssistantMessage } from "@/lib/assistant/tools";
import { getTrip } from "@/lib/demo-data";
import type { PlaceSearchResult } from "@/lib/types";

vi.mock("@/lib/place-search", () => ({
  searchPlaces: vi.fn(async () => ({
    ok: true,
    demo: true,
    results: [
      { fsqPlaceId: "g-1", name: "Corner Bistro", address: "331 W 4th St", neighborhood: "West Village", coordinates: [-74.003, 40.738], category: "Eat" },
      { fsqPlaceId: "g-2", name: "Joe's Pizza", address: "7 Carmine St", neighborhood: "West Village", coordinates: [-74.002, 40.730], category: "Eat" },
    ] satisfies PlaceSearchResult[],
  })),
}));

const execOptions = { toolCallId: "call", messages: [] } as never;

function createTools(known = new Map<string, PlaceSearchResult>()) {
  const tools = createAssistantTools(getTrip("nyc-weekender"), known);
  return {
    search: async (input: { query: string; near?: string }) => {
      const output = await tools.search_places.execute!(input, execOptions);
      return output as Exclude<typeof output, AsyncIterable<unknown>>;
    },
    suggest: async (input: { picks: Array<{ id: string; reason: string; day?: string }> }) => {
      const output = await tools.suggest_places.execute!(input, execOptions);
      return output as Exclude<typeof output, AsyncIterable<unknown>>;
    },
  };
}

afterEach(() => vi.unstubAllEnvs());

describe("assistant models", () => {
  it("uses the free defaults when OPENROUTER_MODELS is unset", () => {
    expect(assistantModels("")).toEqual([...DEFAULT_ASSISTANT_MODELS]);
  });

  it("reads a comma separated override, trimming, de-duplicating and capping it", () => {
    expect(assistantModels(" a/one:free, b/two:free ,a/one:free,, c/three, d/four")).toEqual(["a/one:free", "b/two:free", "c/three"]);
  });

  it("shortens model ids for the panel footnote", () => {
    expect(shortModelName("google/gemma-4-31b-it:free")).toBe("gemma-4-31b-it");
    expect(shortModelName(undefined)).toBe("");
  });
});

describe("trip brief", () => {
  it("lists the trip, its saved places and its day plan", () => {
    const trip = getTrip("nyc-weekender");
    const brief = describeTrip(trip);
    expect(brief).toContain(`Trip: ${trip.title}`);
    for (const place of trip.places) expect(brief).toContain(place.name);
    if (trip.places.some((place) => place.plannedDate)) expect(brief).toContain("Day plan:");
  });
});

describe("assistant tools", () => {
  it("gives search results short ids that suggest_places resolves to full places", async () => {
    const tools = createTools();
    const search = await tools.search({ query: "burgers" });
    expect(search.results.map((result) => result.id)).toEqual(["p1", "p2"]);

    const day = getTrip("nyc-weekender").startDate || undefined;
    const suggested = await tools.suggest({ picks: [{ id: "p2", reason: "Classic slice", day }, { id: "p9", reason: "made up" }] });
    expect(suggested.places).toHaveLength(1);
    expect(suggested.places[0]).toMatchObject({ fsqPlaceId: "g-2", name: "Joe's Pizza", reason: "Classic slice", plannedDate: day ?? null });
    expect(suggested.note).toContain("p9");
  });

  it("ignores a suggested day outside the trip", async () => {
    const tools = createTools();
    await tools.search({ query: "pizza" });
    const suggested = await tools.suggest({ picks: [{ id: "p1", reason: "x", day: "1999-01-01" }] });
    expect(suggested.places[0].plannedDate).toBeNull();
  });

  it("recovers search ids from earlier turns in the chat history", () => {
    const place = { id: "p4", fsqPlaceId: "g-4", name: "Katz's", address: "205 E Houston St", neighborhood: "LES", coordinates: [-73.987, 40.722], category: "Eat" };
    const messages = [{
      id: "m1",
      role: "assistant",
      parts: [{ type: "tool-search_places", toolCallId: "c1", state: "output-available", input: { query: "deli" }, output: { query: "deli", near: "NYC", results: [place] } }],
    }] as unknown as AssistantMessage[];
    expect(knownSearchResults(messages).get("p4")).toMatchObject({ fsqPlaceId: "g-4" });
  });
});

describe("saved chat helpers", () => {
  it("titles a chat after the first question, trimmed for the list", async () => {
    const { conversationTitle } = await import("@/lib/assistant/store");
    const ask = (text: string) => [{ id: "u", role: "user", parts: [{ type: "text", text }] }] as unknown as AssistantMessage[];
    expect(conversationTitle(ask("  plan   day one  "))).toBe("plan day one");
    expect(conversationTitle(ask("x".repeat(120)))).toHaveLength(78);
    expect(conversationTitle([])).toBe("New chat");
  });

  it("falls back to defaults when there is no database", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const store = await import("@/lib/assistant/store");
    expect(await store.getSaveConversations("user")).toBe(false);
    expect(await store.listConversations("user")).toEqual([]);
    expect(await store.getUsageSummary("user")).toMatchObject({ replies30d: 0, models: [] });
  });
});
