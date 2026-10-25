import { describe, expect, it } from "vitest";
import {
  accountNameSchema,
  addFlightSchema,
  addHotelStaySchema,
  addAgendaItemSchema,
  addDayNoteSchema,
  addPlaceSchema,
  addTripCitySchema,
  createEmailInviteSchema,
  createShareInviteSchema,
  createTripSchema,
  directionsSchema,
  inviteTokenSchema,
  revokeInviteSchema,
  reorderDayPlacesSchema,
  saveAgendaDayNoteSchema,
  signInSchema,
  signUpSchema,
  updateAgendaBriefSchema,
  updateFlightSchema,
  updatePlaceDetailsSchema,
  updatePlacePlanningSchema,
  updateTripSchema,
} from "@/lib/validators";

describe("trip validation", () => {
  it("lets a trip be created without dates", () => {
    const result = createTripSchema.safeParse({ title: "South Korea", destination: "South Korea" });
    expect(result.success).toBe(true);
  });

  it("rejects a trip whose return is before departure", () => {
    const result = createTripSchema.safeParse({ title: "A trip", destination: "Lisbon", startDate: "2026-09-18", endDate: "2026-09-12" });
    expect(result.success).toBe(false);
  });

  it("requires a trip id to update logistics", () => {
    const result = updateTripSchema.safeParse({
      title: "A trip",
      destination: "Lisbon, Portugal",
      startDate: "2026-09-18",
      endDate: "2026-09-22",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a saved place snapshot with coordinates", () => {
    const result = addPlaceSchema.safeParse({
      tripId: "210e9464-8cad-406b-96a0-b1463ce0eace",
      fsqPlaceId: "fsq-1",
      name: "Prado",
      address: "R. das Pedras Negras 2",
      neighborhood: "Baixa",
      longitude: -9.1349,
      latitude: 38.7107,
      category: "Eat",
      note: "Lunch",
      sourceUrl: "https://example.com/post",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an optional planned day when saving a place", () => {
    const result = addPlaceSchema.safeParse({
      tripId: "210e9464-8cad-406b-96a0-b1463ce0eace",
      cityId: "83cb9471-a356-4a42-a13f-23c6fb93bb0d",
      fsqPlaceId: "fsq-2",
      name: "Shinjuku Gyoen National Garden",
      address: "11 Naitomachi, Shinjuku City",
      neighborhood: "Shinjuku",
      longitude: 139.7101,
      latitude: 35.6852,
      category: "See",
      plannedDate: "2026-09-24",
      daySortOrder: 2,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a saved transit stop", () => {
    const result = addPlaceSchema.safeParse({
      tripId: "210e9464-8cad-406b-96a0-b1463ce0eace",
      fsqPlaceId: "station-1",
      name: "Cais do Sodre Station",
      address: "Praca do Duque da Terceira",
      neighborhood: "Cais do Sodre",
      longitude: -9.1453,
      latitude: 38.7061,
      category: "Transit",
    });
    expect(result.success).toBe(true);
  });

  it("accepts editing saved place details", () => {
    const result = updatePlaceDetailsSchema.safeParse({
      tripId: "210e9464-8cad-406b-96a0-b1463ce0eace",
      placeId: "83cb9471-a356-4a42-a13f-23c6fb93bb0c",
      cityId: "83cb9471-a356-4a42-a13f-23c6fb93bb0d",
      name: "Mishima Skywalk",
      address: "313 Sasahara Shinden, Mishima",
      neighborhood: "Sasahara Shinden",
      category: "Other",
      note: "Go before lunch for clearer views.",
      sourceUrl: "https://example.com/skywalk",
      plannedDate: "2026-09-29",
      daySortOrder: 14,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a place save without a name or coordinates", () => {
    const result = addPlaceSchema.safeParse({ tripId: "210e9464-8cad-406b-96a0-b1463ce0eace", fsqPlaceId: "fsq-1", category: "Eat" });
    expect(result.success).toBe(false);
  });

  it("accepts a city stop with an optional date range", () => {
    const result = addTripCitySchema.safeParse({
      tripId: "210e9464-8cad-406b-96a0-b1463ce0eace",
      name: "Porto",
      country: "Portugal",
      startDate: "2026-09-20",
      endDate: "2026-09-22",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a city stop whose end is before its start", () => {
    const result = addTripCitySchema.safeParse({
      tripId: "210e9464-8cad-406b-96a0-b1463ce0eace",
      name: "Porto",
      startDate: "2026-09-22",
      endDate: "2026-09-20",
    });
    expect(result.success).toBe(false);
  });

  it("accepts assigning a place to a planned day and city", () => {
    const result = updatePlacePlanningSchema.safeParse({
      tripId: "210e9464-8cad-406b-96a0-b1463ce0eace",
      placeId: "83cb9471-a356-4a42-a13f-23c6fb93bb0c",
      cityId: "83cb9471-a356-4a42-a13f-23c6fb93bb0d",
      plannedDate: "2026-09-20",
      daySortOrder: 1,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a complete ordered day and rejects duplicate places", () => {
    const input = {
      tripId: "210e9464-8cad-406b-96a0-b1463ce0eace",
      plannedDate: "2026-09-20",
      placeIds: ["83cb9471-a356-4a42-a13f-23c6fb93bb0c", "83cb9471-a356-4a42-a13f-23c6fb93bb0d"],
    };
    expect(reorderDayPlacesSchema.safeParse(input).success).toBe(true);
    expect(reorderDayPlacesSchema.safeParse({ ...input, placeIds: [input.placeIds[0], input.placeIds[0]] }).success).toBe(false);
  });

  it("accepts a day note with a planned date", () => {
    const result = addDayNoteSchema.safeParse({
      tripId: "210e9464-8cad-406b-96a0-b1463ce0eace",
      plannedDate: "2026-09-20",
      note: "Book the early train.",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a compact flight plan and normalizes airport codes", () => {
    const flight = {
      tripId: "210e9464-8cad-406b-96a0-b1463ce0eace",
      plannedDate: "2026-09-20",
      arrivalDate: "2026-09-21",
      airline: "Air Canada",
      flightNumber: "AC 836",
      departureAirport: "yyz",
      arrivalAirport: "nrt",
      departureTime: "12:45",
      arrivalTime: "15:20",
    };
    const result = addFlightSchema.safeParse(flight);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.departureAirport).toBe("YYZ");
    expect(updateFlightSchema.safeParse({ ...flight, flightId: "83cb9471-a356-4a42-a13f-23c6fb93bb0c" }).success).toBe(true);
    expect(addFlightSchema.safeParse({ ...flight, arrivalAirport: "Tokyo", departureTime: "9:30" }).success).toBe(false);
    const train = addFlightSchema.safeParse({
      ...flight,
      mode: "train",
      airline: "Amtrak",
      flightNumber: "Acela 2153",
      departureAirport: "Union Station",
      arrivalAirport: "Moynihan Train Hall",
    });
    expect(train.success).toBe(true);
    const bus = addFlightSchema.safeParse({ ...flight, mode: "bus", departureAirport: "A", arrivalAirport: "South Station" });
    expect(bus.success).toBe(false);
  });

  it("accepts a dated hotel stay and rejects an inverted stay", () => {
    const stay = {
      tripId: "210e9464-8cad-406b-96a0-b1463ce0eace",
      cityId: "83cb9471-a356-4a42-a13f-23c6fb93bb0d",
      name: "Memmo Alfama",
      address: "Travessa das Merceeiras 27, Lisbon",
      longitude: -9.1308,
      latitude: 38.7119,
      startDate: "2026-09-18",
      endDate: "2026-09-22",
    };
    expect(addHotelStaySchema.safeParse(stay).success).toBe(true);
    expect(addHotelStaySchema.safeParse({ ...stay, endDate: "2026-09-17" }).success).toBe(false);
  });

  it("accepts a timed agenda item with an optional saved place", () => {
    expect(addAgendaItemSchema.safeParse({
      tripId: "210e9464-8cad-406b-96a0-b1463ce0eace",
      plannedDate: "2026-09-20",
      startTime: "09:30",
      placeId: "83cb9471-a356-4a42-a13f-23c6fb93bb0c",
      title: "Meet outside the station",
    }).success).toBe(true);
  });

  it("rejects an invalid agenda time and accepts empty shared notes", () => {
    expect(addAgendaItemSchema.safeParse({ tripId: "210e9464-8cad-406b-96a0-b1463ce0eace", title: "Coffee", startTime: "9:30" }).success).toBe(false);
    expect(saveAgendaDayNoteSchema.safeParse({ tripId: "210e9464-8cad-406b-96a0-b1463ce0eace", plannedDate: "2026-09-20", note: "" }).success).toBe(true);
    expect(updateAgendaBriefSchema.safeParse({ tripId: "210e9464-8cad-406b-96a0-b1463ce0eace", brief: "Travel light." }).success).toBe(true);
  });

  it("accepts an email-bound trip invite", () => {
    const result = createEmailInviteSchema.safeParse({
      tripId: "210e9464-8cad-406b-96a0-b1463ce0eace",
      email: "FRIEND@EXAMPLE.COM",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("friend@example.com");
  });

  it("accepts a share invite request", () => {
    expect(createShareInviteSchema.safeParse({ tripId: "210e9464-8cad-406b-96a0-b1463ce0eace" }).success).toBe(true);
  });

  it("accepts a revoke invite request", () => {
    expect(
      revokeInviteSchema.safeParse({
        tripId: "210e9464-8cad-406b-96a0-b1463ce0eace",
        invitationId: "83cb9471-a356-4a42-a13f-23c6fb93bb0c",
      }).success,
    ).toBe(true);
  });

  it("rejects short invite tokens", () => {
    expect(inviteTokenSchema.safeParse("short").success).toBe(false);
  });

  it("caps directions requests at twelve stops", () => {
    const coordinates = Array.from({ length: 13 }, () => [-9.1, 38.7] as [number, number]);
    expect(directionsSchema.safeParse({ coordinates, mode: "walking" }).success).toBe(false);
  });
});

describe("auth validation", () => {
  it("rejects a sign-in without an email", () => {
    expect(signInSchema.safeParse({ email: "", password: "secret" }).success).toBe(false);
  });

  it("rejects a sign-up when the passwords do not match", () => {
    const result = signUpSchema.safeParse({
      name: "Faiz",
      email: "faiz@example.com",
      password: "longenough",
      confirmPassword: "different",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a complete sign-up", () => {
    const result = signUpSchema.safeParse({
      name: "Faiz",
      email: "faiz@example.com",
      password: "longenough",
      confirmPassword: "longenough",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an account name that is too short", () => {
    expect(accountNameSchema.safeParse({ name: "A" }).success).toBe(false);
  });
});
