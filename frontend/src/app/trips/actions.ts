"use server";

import { and, desc, eq, gt, gte, isNull, lte, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { getDatabase } from "@/lib/db";
import { countryFromDestination } from "@/lib/dates";
import { tripAgendaDayNotes, tripAgendaItems, tripAgendas, tripCities, tripDayNotes, tripFlights, tripHotels, tripInvitationAcceptances, tripInvitations, tripMembers, tripPlaces, trips } from "@/lib/db/schema";
import { createInviteToken, hashInviteToken, inviteExpiresAt, inviteStatus } from "@/lib/invitations";
import type { TripInvitationSummary } from "@/lib/types";
import {
  addDayNoteSchema,
  addFlightSchema,
  addHotelStaySchema,
  addAgendaItemSchema,
  addPlaceSchema,
  addTripCitySchema,
  createEmailInviteSchema,
  createShareInviteSchema,
  createTripSchema,
  inviteSchema,
  inviteTokenSchema,
  removeDayNoteSchema,
  removeFlightSchema,
  removeHotelStaySchema,
  removeAgendaItemSchema,
  removePlaceSchema,
  reorderDayPlacesSchema,
  removeTripCitySchema,
  revokeInviteSchema,
  saveAgendaDayNoteSchema,
  updateDayNoteSchema,
  updateFlightSchema,
  updateHotelStaySchema,
  updateAgendaBriefSchema,
  updateAgendaItemSchema,
  updatePlaceDetailsSchema,
  updatePlacePlanningSchema,
  updatePlaceSchema,
  updateTripCitySchema,
  updateTripSchema,
} from "@/lib/validators";

async function requireViewer() {
  const viewer = await getViewer();
  if (!viewer || viewer.restricted) throw new Error("Your account has been restricted.");
  return viewer;
}

async function requireEditor(tripId: string, userId: string) {
  const db = getDatabase();
  if (!db) return;
  const [membership] = await db
    .select({ role: tripMembers.role })
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, userId)))
    .limit(1);
  if (!membership) throw new Error("You do not have access to this trip.");
}

async function requireOwner(tripId: string, userId: string) {
  const db = getDatabase();
  if (!db) return;
  const [trip] = await db
    .select({ id: trips.id })
    .from(trips)
    .where(and(eq(trips.id, tripId), eq(trips.ownerId, userId)))
    .limit(1);
  if (!trip) throw new Error("Only the trip owner can do that.");
}

function revalidateTrip(tripId: string) {
  revalidatePath("/trips");
  revalidatePath(`/trips/${tripId}`);
}

function optionalValue(value?: string) {
  return value?.trim() || null;
}

function isPlanningSchemaMissing(error: unknown) {
  const message = error instanceof Error ? `${error.message} ${error.cause ?? ""}` : String(error);
  return /trip_cities|trip_day_notes|city_id|planned_date|day_sort_order|relation .* does not exist|column .* does not exist/i.test(message);
}

function planningMigrationError() {
  return new Error("Day planning needs the latest database migration before it can be saved.");
}

function isAgendaSchemaMissing(error: unknown) {
  const message = error instanceof Error ? `${error.message} ${error.cause ?? ""}` : String(error);
  return /trip_agendas|trip_agenda_day_notes|trip_agenda_items|agenda/i.test(message);
}

function agendaMigrationError() {
  return new Error("Agenda needs the latest database migration before it can be saved.");
}

function isFlightSchemaMissing(error: unknown) {
  const message = error instanceof Error ? `${error.message} ${error.cause ?? ""}` : String(error);
  return /trip_flights|arrival_date|departure_airport|arrival_airport|departure_time|arrival_time|relation .* does not exist|column .* does not exist/i.test(message);
}

function flightMigrationError() {
  return new Error("Flight plans need the latest database migration before they can be saved.");
}

function isHotelSchemaMissing(error: unknown) {
  const message = error instanceof Error ? `${error.message} ${error.cause ?? ""}` : String(error);
  return /trip_hotels|relation .* does not exist|column .* does not exist/i.test(message);
}

function hotelMigrationError() {
  return new Error("Hotel stays need the latest database migration before they can be saved.");
}

async function ensureHotelCity(tripId: string, cityId?: string | null) {
  if (!cityId) return;
  const db = getDatabase();
  if (!db) return;
  const [city] = await db.select({ id: tripCities.id }).from(tripCities).where(and(eq(tripCities.id, cityId), eq(tripCities.tripId, tripId))).limit(1);
  if (!city) throw new Error("Choose a city on this trip.");
}

async function ensureHotelDatesAvailable(tripId: string, startDate: string, endDate: string, cityId?: string | null, excludingId?: string) {
  const db = getDatabase();
  if (!db) return;
  const stays = await db
    .select({ id: tripHotels.id, cityId: tripHotels.cityId })
    .from(tripHotels)
    .where(and(eq(tripHotels.tripId, tripId), lte(tripHotels.startDate, endDate), gte(tripHotels.endDate, startDate)));
  if (stays.some((stay) => stay.id !== excludingId && stay.cityId === cityId)) throw new Error("Those dates overlap another hotel in this city.");
}

async function ensureAgendaPlace(tripId: string, placeId?: string | null) {
  if (!placeId) return;
  const db = getDatabase();
  if (!db) return;
  const [place] = await db
    .select({ id: tripPlaces.id })
    .from(tripPlaces)
    .where(and(eq(tripPlaces.id, placeId), eq(tripPlaces.tripId, tripId)))
    .limit(1);
  if (!place) throw new Error("Choose a place saved to this trip.");
}

function inviteSchemaMigrationError() {
  return new Error("Invites need the latest database migration before they can be used.");
}

function isInviteSchemaMissing(error: unknown) {
  const message = error instanceof Error ? `${error.message} ${error.cause ?? ""}` : String(error);
  return /invitation_kind|trip_invitation_acceptances|kind|role|revoked_at|revoked_by|relation .* does not exist|column .* does not exist/i.test(message);
}

function toIso(value: string | Date) {
  if (typeof value === "string") return value;
  return value.toISOString();
}

function toInviteSummary(row: {
  id: string;
  kind: "email" | "share";
  email: string | null;
  role: "owner" | "editor";
  expiresAt: Date | string;
  invitedBy: string;
  createdAt: Date | string;
}): TripInvitationSummary {
  return {
    id: row.id,
    kind: row.kind,
    email: row.email,
    role: "editor",
    expiresAt: toIso(row.expiresAt),
    invitedBy: row.invitedBy,
    createdAt: toIso(row.createdAt),
  };
}

export async function createTrip(input: unknown) {
  const viewer = await requireViewer();
  const data = createTripSchema.parse(input);
  const db = getDatabase();
  if (!db) return { id: "lisbon-weekender", demo: true };
  const [trip] = await db
    .insert(trips)
    .values({
      title: data.title,
      destination: data.destination,
      startDate: optionalValue(data.startDate),
      endDate: optionalValue(data.endDate),
      ownerId: viewer.id,
    })
    .returning({ id: trips.id });
  try {
    await db.insert(tripMembers).values({
      tripId: trip.id,
      userId: viewer.id,
      role: "owner",
      displayName: viewer.name?.trim() || "Traveller",
      image: viewer.image || null,
    });
  } catch (error) {
    await db.delete(trips).where(eq(trips.id, trip.id));
    throw error;
  }
  try {
    await db.insert(tripCities).values({
      tripId: trip.id,
      name: data.destination.split(",")[0]?.trim() || data.destination,
      country: countryFromDestination(data.destination),
      startDate: optionalValue(data.startDate),
      endDate: optionalValue(data.endDate),
      sortOrder: 0,
    });
  } catch (error) {
    if (!isPlanningSchemaMissing(error)) {
      await db.delete(trips).where(eq(trips.id, trip.id));
      throw error;
    }
  }
  revalidatePath("/trips");
  return { id: trip.id, demo: false };
}

export async function addPlace(input: unknown) {
  const viewer = await requireViewer();
  const data = addPlaceSchema.parse(input);
  const db = getDatabase();
  if (!db) return { demo: true };
  await requireEditor(data.tripId, viewer.id);
  const [order] = await db
    .select({ next: sql<number>`coalesce(max(${tripPlaces.sortOrder}), -1) + 1` })
    .from(tripPlaces)
    .where(eq(tripPlaces.tripId, data.tripId));
  try {
    const values = {
      tripId: data.tripId,
      fsqPlaceId: data.fsqPlaceId,
      name: data.name,
      address: data.address,
      neighborhood: data.neighborhood,
      longitude: data.longitude,
      latitude: data.latitude,
      category: data.category,
      note: data.note,
      sourceUrl: data.sourceUrl || null,
      saved: data.saved,
      sortOrder: Number(order?.next ?? 0),
      addedBy: viewer.id,
    };
    const planningValues = {
      cityId: optionalValue(data.cityId),
      plannedDate: optionalValue(data.plannedDate),
      daySortOrder: data.plannedDate ? data.daySortOrder ?? 0 : 0,
    };
    const [saved] = await db
      .insert(tripPlaces)
      .values({ ...values, ...planningValues })
      .returning({ id: tripPlaces.id })
      .catch(async (error) => {
        if (!isPlanningSchemaMissing(error)) throw error;
        return db.insert(tripPlaces).values(values).returning({ id: tripPlaces.id });
      });
    revalidateTrip(data.tripId);
    return { demo: false, id: saved.id };
  } catch (error) {
    const message = error instanceof Error ? `${error.message} ${error.cause ?? ""}` : String(error);
    if (message.includes("trip_places_provider_unique") || message.includes("duplicate key")) {
      throw new Error("That place is already on this trip.");
    }
    throw error;
  }
}

export async function updatePlace(input: unknown) {
  const viewer = await requireViewer();
  const data = updatePlaceSchema.parse(input);
  const db = getDatabase();
  if (!db) return { demo: true };
  await requireEditor(data.tripId, viewer.id);
  const [updated] = await db
    .update(tripPlaces)
    .set({ saved: data.saved })
    .where(and(eq(tripPlaces.id, data.placeId), eq(tripPlaces.tripId, data.tripId)))
    .returning({ id: tripPlaces.id });
  if (!updated) throw new Error("This place could not be updated.");
  revalidateTrip(data.tripId);
  return { demo: false };
}

export async function updatePlaceDetails(input: unknown) {
  const viewer = await requireViewer();
  const data = updatePlaceDetailsSchema.parse(input);
  const db = getDatabase();
  if (!db) return { demo: true };
  await requireEditor(data.tripId, viewer.id);
  const [updated] = await db
    .update(tripPlaces)
    .set({
      cityId: optionalValue(data.cityId),
      name: data.name,
      address: data.address,
      neighborhood: data.neighborhood,
      category: data.category,
      note: data.note,
      sourceUrl: data.sourceUrl || null,
      plannedDate: optionalValue(data.plannedDate),
      daySortOrder: data.plannedDate ? data.daySortOrder ?? 0 : 0,
    })
    .where(and(eq(tripPlaces.id, data.placeId), eq(tripPlaces.tripId, data.tripId)))
    .returning({ id: tripPlaces.id });
  if (!updated) throw new Error("This place could not be updated.");
  revalidateTrip(data.tripId);
  return { demo: false };
}

export async function updatePlacePlanning(input: unknown) {
  const viewer = await requireViewer();
  const data = updatePlacePlanningSchema.parse(input);
  const db = getDatabase();
  if (!db) return { demo: true };
  await requireEditor(data.tripId, viewer.id);
  const plannedDate = optionalValue(data.plannedDate);
  if (plannedDate || data.cityId) {
    try {
      await db.select({ id: tripCities.id }).from(tripCities).where(eq(tripCities.tripId, data.tripId)).limit(1);
    } catch (error) {
      if (isPlanningSchemaMissing(error)) throw planningMigrationError();
      throw error;
    }
  }
  const [updated] = await db
    .update(tripPlaces)
    .set({
      cityId: plannedDate ? optionalValue(data.cityId) : null,
      plannedDate,
      daySortOrder: data.daySortOrder ?? 0,
    })
    .where(and(eq(tripPlaces.id, data.placeId), eq(tripPlaces.tripId, data.tripId)))
    .returning({ id: tripPlaces.id });
  if (!updated) throw new Error("This place could not be updated.");
  revalidateTrip(data.tripId);
  return { demo: false };
}

export async function reorderDayPlaces(input: unknown) {
  const viewer = await requireViewer();
  const data = reorderDayPlacesSchema.parse(input);
  const db = getDatabase();
  if (!db) return { demo: true };
  await requireEditor(data.tripId, viewer.id);
  try {
    const dayPlaces = await db
      .select({ id: tripPlaces.id })
      .from(tripPlaces)
      .where(and(eq(tripPlaces.tripId, data.tripId), eq(tripPlaces.plannedDate, data.plannedDate)));
    const expected = new Set(dayPlaces.map((place) => place.id));
    if (expected.size !== data.placeIds.length || data.placeIds.some((id) => !expected.has(id))) {
      throw new Error("This day changed before the new order could be saved. Refresh and try again.");
    }
    const updates = data.placeIds.map((placeId, daySortOrder) => db
        .update(tripPlaces)
        .set({ daySortOrder })
        .where(and(eq(tripPlaces.id, placeId), eq(tripPlaces.tripId, data.tripId), eq(tripPlaces.plannedDate, data.plannedDate))));
    const [firstUpdate, ...remainingUpdates] = updates;
    if (!firstUpdate) throw new Error("Choose at least one place to reorder.");
    await db.batch([firstUpdate, ...remainingUpdates]);
  } catch (error) {
    if (isPlanningSchemaMissing(error)) throw planningMigrationError();
    throw error;
  }
  revalidateTrip(data.tripId);
  return { demo: false };
}

export async function removePlace(input: unknown) {
  const viewer = await requireViewer();
  const data = removePlaceSchema.parse(input);
  const db = getDatabase();
  if (!db) return { demo: true };
  await requireEditor(data.tripId, viewer.id);
  await db.delete(tripPlaces).where(and(eq(tripPlaces.id, data.placeId), eq(tripPlaces.tripId, data.tripId)));
  revalidateTrip(data.tripId);
  return { demo: false };
}

export async function addTripCity(input: unknown) {
  const viewer = await requireViewer();
  const data = addTripCitySchema.parse(input);
  const db = getDatabase();
  if (!db) return { demo: true };
  await requireEditor(data.tripId, viewer.id);
  try {
    await db.select({ id: tripCities.id }).from(tripCities).where(eq(tripCities.tripId, data.tripId)).limit(1);
  } catch (error) {
    if (isPlanningSchemaMissing(error)) throw planningMigrationError();
    throw error;
  }
  const [order] = await db
    .select({ next: sql<number>`coalesce(max(${tripCities.sortOrder}), -1) + 1` })
    .from(tripCities)
    .where(eq(tripCities.tripId, data.tripId));
  const [city] = await db
    .insert(tripCities)
    .values({
      tripId: data.tripId,
      name: data.name,
      country: data.country,
      startDate: optionalValue(data.startDate),
      endDate: optionalValue(data.endDate),
      sortOrder: Number(order?.next ?? 0),
    })
    .returning({ id: tripCities.id });
  revalidateTrip(data.tripId);
  return { demo: false, id: city.id };
}

export async function updateTripCity(input: unknown) {
  const viewer = await requireViewer();
  const data = updateTripCitySchema.parse(input);
  const db = getDatabase();
  if (!db) return { demo: true };
  await requireEditor(data.tripId, viewer.id);
  try {
    await db.select({ id: tripCities.id }).from(tripCities).where(eq(tripCities.tripId, data.tripId)).limit(1);
  } catch (error) {
    if (isPlanningSchemaMissing(error)) throw planningMigrationError();
    throw error;
  }
  const [updated] = await db
    .update(tripCities)
    .set({
      name: data.name,
      country: data.country,
      startDate: optionalValue(data.startDate),
      endDate: optionalValue(data.endDate),
      updatedAt: new Date(),
    })
    .where(and(eq(tripCities.id, data.cityId), eq(tripCities.tripId, data.tripId)))
    .returning({ id: tripCities.id });
  if (!updated) throw new Error("This city could not be updated.");
  revalidateTrip(data.tripId);
  return { demo: false };
}

export async function removeTripCity(input: unknown) {
  const viewer = await requireViewer();
  const data = removeTripCitySchema.parse(input);
  const db = getDatabase();
  if (!db) return { demo: true };
  await requireEditor(data.tripId, viewer.id);
  try {
    await db.select({ id: tripCities.id }).from(tripCities).where(eq(tripCities.tripId, data.tripId)).limit(1);
  } catch (error) {
    if (isPlanningSchemaMissing(error)) throw planningMigrationError();
    throw error;
  }
  await db
    .update(tripPlaces)
    .set({ cityId: null, plannedDate: null, daySortOrder: 0 })
    .where(and(eq(tripPlaces.tripId, data.tripId), eq(tripPlaces.cityId, data.cityId)));
  await db
    .update(tripDayNotes)
    .set({ cityId: null, updatedAt: new Date() })
    .where(and(eq(tripDayNotes.tripId, data.tripId), eq(tripDayNotes.cityId, data.cityId)));
  await db.delete(tripCities).where(and(eq(tripCities.id, data.cityId), eq(tripCities.tripId, data.tripId)));
  revalidateTrip(data.tripId);
  return { demo: false };
}

export async function addDayNote(input: unknown) {
  const viewer = await requireViewer();
  const data = addDayNoteSchema.parse(input);
  const db = getDatabase();
  if (!db) return { demo: true };
  await requireEditor(data.tripId, viewer.id);
  try {
    await db.select({ id: tripDayNotes.id }).from(tripDayNotes).where(eq(tripDayNotes.tripId, data.tripId)).limit(1);
  } catch (error) {
    if (isPlanningSchemaMissing(error)) throw planningMigrationError();
    throw error;
  }
  const [order] = await db
    .select({ next: sql<number>`coalesce(max(${tripDayNotes.sortOrder}), -1) + 1` })
    .from(tripDayNotes)
    .where(and(eq(tripDayNotes.tripId, data.tripId), eq(tripDayNotes.plannedDate, data.plannedDate)));
  const [note] = await db
    .insert(tripDayNotes)
    .values({
      tripId: data.tripId,
      cityId: optionalValue(data.cityId),
      plannedDate: data.plannedDate,
      note: data.note,
      sortOrder: Number(order?.next ?? 0),
      addedBy: viewer.id,
    })
    .returning({ id: tripDayNotes.id });
  revalidateTrip(data.tripId);
  return { demo: false, id: note.id };
}

export async function updateDayNote(input: unknown) {
  const viewer = await requireViewer();
  const data = updateDayNoteSchema.parse(input);
  const db = getDatabase();
  if (!db) return { demo: true };
  await requireEditor(data.tripId, viewer.id);
  try {
    await db.select({ id: tripDayNotes.id }).from(tripDayNotes).where(eq(tripDayNotes.tripId, data.tripId)).limit(1);
  } catch (error) {
    if (isPlanningSchemaMissing(error)) throw planningMigrationError();
    throw error;
  }
  const [updated] = await db
    .update(tripDayNotes)
    .set({
      cityId: optionalValue(data.cityId),
      plannedDate: data.plannedDate,
      note: data.note,
      updatedAt: new Date(),
    })
    .where(and(eq(tripDayNotes.id, data.noteId), eq(tripDayNotes.tripId, data.tripId)))
    .returning({ id: tripDayNotes.id });
  if (!updated) throw new Error("This note could not be updated.");
  revalidateTrip(data.tripId);
  return { demo: false };
}

export async function removeDayNote(input: unknown) {
  const viewer = await requireViewer();
  const data = removeDayNoteSchema.parse(input);
  const db = getDatabase();
  if (!db) return { demo: true };
  await requireEditor(data.tripId, viewer.id);
  try {
    await db.select({ id: tripDayNotes.id }).from(tripDayNotes).where(eq(tripDayNotes.tripId, data.tripId)).limit(1);
  } catch (error) {
    if (isPlanningSchemaMissing(error)) throw planningMigrationError();
    throw error;
  }
  await db.delete(tripDayNotes).where(and(eq(tripDayNotes.id, data.noteId), eq(tripDayNotes.tripId, data.tripId)));
  revalidateTrip(data.tripId);
  return { demo: false };
}

export async function addFlight(input: unknown) {
  const viewer = await requireViewer();
  const data = addFlightSchema.parse(input);
  const db = getDatabase();
  if (!db) return { demo: true, id: "" };
  await requireEditor(data.tripId, viewer.id);
  try {
    const [flight] = await db
      .insert(tripFlights)
      .values(data)
      .returning({ id: tripFlights.id });
    revalidateTrip(data.tripId);
    return { demo: false, id: flight.id };
  } catch (error) {
    if (isFlightSchemaMissing(error)) throw flightMigrationError();
    throw error;
  }
}

export async function updateFlight(input: unknown) {
  const viewer = await requireViewer();
  const data = updateFlightSchema.parse(input);
  const db = getDatabase();
  if (!db) return { demo: true };
  await requireEditor(data.tripId, viewer.id);
  try {
    const [flight] = await db
      .update(tripFlights)
      .set({
        plannedDate: data.plannedDate,
        arrivalDate: data.arrivalDate,
        airline: data.airline,
        flightNumber: data.flightNumber,
        departureAirport: data.departureAirport,
        arrivalAirport: data.arrivalAirport,
        departureTime: data.departureTime,
        arrivalTime: data.arrivalTime,
        updatedAt: new Date(),
      })
      .where(and(eq(tripFlights.id, data.flightId), eq(tripFlights.tripId, data.tripId)))
      .returning({ id: tripFlights.id });
    if (!flight) throw new Error("This flight could not be updated.");
    revalidateTrip(data.tripId);
    return { demo: false };
  } catch (error) {
    if (isFlightSchemaMissing(error)) throw flightMigrationError();
    throw error;
  }
}

export async function removeFlight(input: unknown) {
  const viewer = await requireViewer();
  const data = removeFlightSchema.parse(input);
  const db = getDatabase();
  if (!db) return { demo: true };
  await requireEditor(data.tripId, viewer.id);
  try {
    await db.delete(tripFlights).where(and(eq(tripFlights.id, data.flightId), eq(tripFlights.tripId, data.tripId)));
    revalidateTrip(data.tripId);
    return { demo: false };
  } catch (error) {
    if (isFlightSchemaMissing(error)) throw flightMigrationError();
    throw error;
  }
}

export async function addHotelStay(input: unknown) {
  const viewer = await requireViewer();
  const data = addHotelStaySchema.parse(input);
  const db = getDatabase();
  if (!db) return { demo: true, id: "" };
  await requireEditor(data.tripId, viewer.id);
  try {
    await ensureHotelCity(data.tripId, optionalValue(data.cityId));
    await ensureHotelDatesAvailable(data.tripId, data.startDate, data.endDate, optionalValue(data.cityId));
    const [stay] = await db.insert(tripHotels).values({ ...data, cityId: optionalValue(data.cityId) }).returning({ id: tripHotels.id });
    revalidateTrip(data.tripId);
    return { demo: false, id: stay.id };
  } catch (error) {
    if (isHotelSchemaMissing(error)) throw hotelMigrationError();
    throw error;
  }
}

export async function updateHotelStay(input: unknown) {
  const viewer = await requireViewer();
  const data = updateHotelStaySchema.parse(input);
  const db = getDatabase();
  if (!db) return { demo: true };
  await requireEditor(data.tripId, viewer.id);
  try {
    await ensureHotelCity(data.tripId, optionalValue(data.cityId));
    await ensureHotelDatesAvailable(data.tripId, data.startDate, data.endDate, optionalValue(data.cityId), data.hotelId);
    const [stay] = await db.update(tripHotels).set({
      cityId: optionalValue(data.cityId), name: data.name, address: data.address,
      longitude: data.longitude, latitude: data.latitude, startDate: data.startDate, endDate: data.endDate, updatedAt: new Date(),
    }).where(and(eq(tripHotels.id, data.hotelId), eq(tripHotels.tripId, data.tripId))).returning({ id: tripHotels.id });
    if (!stay) throw new Error("This hotel stay could not be updated.");
    revalidateTrip(data.tripId);
    return { demo: false };
  } catch (error) {
    if (isHotelSchemaMissing(error)) throw hotelMigrationError();
    throw error;
  }
}

export async function removeHotelStay(input: unknown) {
  const viewer = await requireViewer();
  const data = removeHotelStaySchema.parse(input);
  const db = getDatabase();
  if (!db) return { demo: true };
  await requireEditor(data.tripId, viewer.id);
  try {
    await db.delete(tripHotels).where(and(eq(tripHotels.id, data.hotelId), eq(tripHotels.tripId, data.tripId)));
    revalidateTrip(data.tripId);
    return { demo: false };
  } catch (error) {
    if (isHotelSchemaMissing(error)) throw hotelMigrationError();
    throw error;
  }
}

export async function updateAgendaBrief(input: unknown) {
  const viewer = await requireViewer();
  const data = updateAgendaBriefSchema.parse(input);
  const db = getDatabase();
  if (!db) return { demo: true };
  await requireEditor(data.tripId, viewer.id);
  try {
    await db
      .insert(tripAgendas)
      .values({ tripId: data.tripId, brief: data.brief })
      .onConflictDoUpdate({
        target: tripAgendas.tripId,
        set: { brief: data.brief, updatedAt: new Date() },
      });
  } catch (error) {
    if (isAgendaSchemaMissing(error)) throw agendaMigrationError();
    throw error;
  }
  revalidateTrip(data.tripId);
  return { demo: false };
}

export async function saveAgendaDayNote(input: unknown) {
  const viewer = await requireViewer();
  const data = saveAgendaDayNoteSchema.parse(input);
  const db = getDatabase();
  if (!db) return { demo: true };
  await requireEditor(data.tripId, viewer.id);
  try {
    if (!data.note) {
      await db.delete(tripAgendaDayNotes).where(and(eq(tripAgendaDayNotes.tripId, data.tripId), eq(tripAgendaDayNotes.plannedDate, data.plannedDate)));
    } else {
      await db
        .insert(tripAgendaDayNotes)
        .values({ tripId: data.tripId, plannedDate: data.plannedDate, note: data.note })
        .onConflictDoUpdate({
          target: [tripAgendaDayNotes.tripId, tripAgendaDayNotes.plannedDate],
          set: { note: data.note, updatedAt: new Date() },
        });
    }
  } catch (error) {
    if (isAgendaSchemaMissing(error)) throw agendaMigrationError();
    throw error;
  }
  revalidateTrip(data.tripId);
  return { demo: false };
}

export async function addAgendaItem(input: unknown) {
  const viewer = await requireViewer();
  const data = addAgendaItemSchema.parse(input);
  const db = getDatabase();
  if (!db) return { demo: true, id: "" };
  await requireEditor(data.tripId, viewer.id);
  await ensureAgendaPlace(data.tripId, optionalValue(data.placeId));
  try {
    const dateCondition = data.plannedDate ? eq(tripAgendaItems.plannedDate, data.plannedDate) : isNull(tripAgendaItems.plannedDate);
    const [order] = await db
      .select({ next: sql<number>`coalesce(max(${tripAgendaItems.sortOrder}), -1) + 1` })
      .from(tripAgendaItems)
      .where(and(eq(tripAgendaItems.tripId, data.tripId), dateCondition));
    const [item] = await db
      .insert(tripAgendaItems)
      .values({
        tripId: data.tripId,
        plannedDate: optionalValue(data.plannedDate),
        startTime: optionalValue(data.startTime),
        placeId: optionalValue(data.placeId),
        title: data.title,
        sortOrder: Number(order?.next ?? 0),
      })
      .returning({ id: tripAgendaItems.id, sortOrder: tripAgendaItems.sortOrder });
    revalidateTrip(data.tripId);
    return { demo: false, id: item.id, sortOrder: item.sortOrder };
  } catch (error) {
    if (isAgendaSchemaMissing(error)) throw agendaMigrationError();
    throw error;
  }
}

export async function updateAgendaItem(input: unknown) {
  const viewer = await requireViewer();
  const data = updateAgendaItemSchema.parse(input);
  const db = getDatabase();
  if (!db) return { demo: true };
  await requireEditor(data.tripId, viewer.id);
  await ensureAgendaPlace(data.tripId, optionalValue(data.placeId));
  try {
    const [updated] = await db
      .update(tripAgendaItems)
      .set({
        plannedDate: optionalValue(data.plannedDate),
        startTime: optionalValue(data.startTime),
        placeId: optionalValue(data.placeId),
        title: data.title,
        completed: data.completed,
        updatedAt: new Date(),
      })
      .where(and(eq(tripAgendaItems.id, data.itemId), eq(tripAgendaItems.tripId, data.tripId)))
      .returning({ id: tripAgendaItems.id });
    if (!updated) throw new Error("This agenda item could not be updated.");
  } catch (error) {
    if (isAgendaSchemaMissing(error)) throw agendaMigrationError();
    throw error;
  }
  revalidateTrip(data.tripId);
  return { demo: false };
}

export async function removeAgendaItem(input: unknown) {
  const viewer = await requireViewer();
  const data = removeAgendaItemSchema.parse(input);
  const db = getDatabase();
  if (!db) return { demo: true };
  await requireEditor(data.tripId, viewer.id);
  try {
    await db.delete(tripAgendaItems).where(and(eq(tripAgendaItems.id, data.itemId), eq(tripAgendaItems.tripId, data.tripId)));
  } catch (error) {
    if (isAgendaSchemaMissing(error)) throw agendaMigrationError();
    throw error;
  }
  revalidateTrip(data.tripId);
  return { demo: false };
}

export async function listTripInvites(input: unknown): Promise<{ demo: boolean; invites: TripInvitationSummary[] }> {
  const viewer = await requireViewer();
  const data = createShareInviteSchema.parse(input);
  const db = getDatabase();
  if (!db) return { demo: true, invites: [] };
  await requireOwner(data.tripId, viewer.id);
  try {
    const rows = await db
      .select({
        id: tripInvitations.id,
        kind: tripInvitations.kind,
        email: tripInvitations.email,
        role: tripInvitations.role,
        expiresAt: tripInvitations.expiresAt,
        invitedBy: tripInvitations.invitedBy,
        createdAt: tripInvitations.createdAt,
      })
      .from(tripInvitations)
      .where(and(
        eq(tripInvitations.tripId, data.tripId),
        isNull(tripInvitations.revokedAt),
        gt(tripInvitations.expiresAt, new Date()),
        or(eq(tripInvitations.kind, "share"), isNull(tripInvitations.acceptedAt)),
      ))
      .orderBy(desc(tripInvitations.createdAt));
    return { demo: false, invites: rows.map(toInviteSummary) };
  } catch (error) {
    if (isInviteSchemaMissing(error)) throw inviteSchemaMigrationError();
    throw error;
  }
}

export async function createEmailInvite(input: unknown) {
  const viewer = await requireViewer();
  const data = createEmailInviteSchema.parse(input);
  const db = getDatabase();
  if (!db) return { inviteUrl: "/invite/demo-lisbon-board", demo: true, expiresAt: inviteExpiresAt().toISOString() };
  await requireOwner(data.tripId, viewer.id);
  const token = createInviteToken();
  const expiresAt = inviteExpiresAt();
  try {
    const [invite] = await db
      .insert(tripInvitations)
      .values({
        tripId: data.tripId,
        kind: "email",
        email: data.email,
        tokenHash: hashInviteToken(token),
        role: "editor",
        invitedBy: viewer.id,
        expiresAt,
      })
      .returning({ id: tripInvitations.id });
    revalidateTrip(data.tripId);
    return { inviteUrl: `/invite/${token}`, demo: false, expiresAt: expiresAt.toISOString(), id: invite.id };
  } catch (error) {
    if (isInviteSchemaMissing(error)) throw inviteSchemaMigrationError();
    throw error;
  }
}

export async function createShareInvite(input: unknown) {
  const viewer = await requireViewer();
  const data = createShareInviteSchema.parse(input);
  const db = getDatabase();
  if (!db) return { inviteUrl: "/invite/demo-lisbon-board", demo: true, expiresAt: inviteExpiresAt().toISOString() };
  await requireOwner(data.tripId, viewer.id);
  const token = createInviteToken();
  const expiresAt = inviteExpiresAt();
  try {
    const [invite] = await db
      .insert(tripInvitations)
      .values({
        tripId: data.tripId,
        kind: "share",
        email: null,
        tokenHash: hashInviteToken(token),
        role: "editor",
        invitedBy: viewer.id,
        expiresAt,
      })
      .returning({ id: tripInvitations.id });
    revalidateTrip(data.tripId);
    return { inviteUrl: `/invite/${token}`, demo: false, expiresAt: expiresAt.toISOString(), id: invite.id };
  } catch (error) {
    if (isInviteSchemaMissing(error)) throw inviteSchemaMigrationError();
    throw error;
  }
}

export async function revokeInvite(input: unknown) {
  const viewer = await requireViewer();
  const data = revokeInviteSchema.parse(input);
  const db = getDatabase();
  if (!db) return { demo: true };
  await requireOwner(data.tripId, viewer.id);
  try {
    await db
      .update(tripInvitations)
      .set({ revokedAt: new Date(), revokedBy: viewer.id })
      .where(and(eq(tripInvitations.id, data.invitationId), eq(tripInvitations.tripId, data.tripId), isNull(tripInvitations.revokedAt)));
    revalidateTrip(data.tripId);
    return { demo: false };
  } catch (error) {
    if (isInviteSchemaMissing(error)) throw inviteSchemaMigrationError();
    throw error;
  }
}

export async function inviteCollaborator(input: unknown) {
  const data = inviteSchema.parse(input);
  return createEmailInvite(data);
}

export async function acceptInvitation(rawToken: string) {
  if (rawToken === "demo-lisbon-board") redirect("/trips/lisbon-weekender");
  const token = inviteTokenSchema.parse(rawToken);
  const viewer = await requireViewer();
  const db = getDatabase();
  if (!db) redirect("/trips/lisbon-weekender");
  const tokenHash = hashInviteToken(token);
  let tripId = "";
  try {
    const [invitation] = await db
      .select()
      .from(tripInvitations)
      .where(eq(tripInvitations.tokenHash, tokenHash))
      .limit(1);
    if (!invitation) throw new Error("This invite link is not valid.");
    tripId = invitation.tripId;

    const [membership] = await db
      .select({ role: tripMembers.role })
      .from(tripMembers)
      .where(and(eq(tripMembers.tripId, invitation.tripId), eq(tripMembers.userId, viewer.id)))
      .limit(1);
    if (!membership) {
      const status = inviteStatus({
        kind: invitation.kind,
        expiresAt: invitation.expiresAt,
        revokedAt: invitation.revokedAt,
        acceptedAt: invitation.acceptedAt,
      });
      if (status === "revoked") throw new Error("This invite link was revoked.");
      if (status === "expired") throw new Error("This invite link has expired.");
      if (status === "accepted") throw new Error("This invite link has already been used.");
      if (invitation.kind === "email" && (!viewer.email || viewer.email.toLowerCase() !== invitation.email?.toLowerCase())) {
        throw new Error("Sign in with the email address that received this invitation.");
      }
      await db
        .insert(tripMembers)
        .values({
          tripId: invitation.tripId,
          userId: viewer.id,
          role: "editor",
          displayName: viewer.name?.trim() || "Traveller",
          image: viewer.image || null,
        })
        .onConflictDoNothing();
      await db
        .insert(tripInvitationAcceptances)
        .values({
          invitationId: invitation.id,
          tripId: invitation.tripId,
          userId: viewer.id,
        })
        .onConflictDoNothing();
      if (invitation.kind === "email") {
        await db.update(tripInvitations).set({ acceptedAt: new Date() }).where(eq(tripInvitations.id, invitation.id));
      }
    }
  } catch (error) {
    if (isInviteSchemaMissing(error)) throw inviteSchemaMigrationError();
    throw error;
  }
  revalidatePath("/trips");
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}`);
}

export async function acceptInvitationForm(formData: FormData) {
  await acceptInvitation(String(formData.get("token") ?? ""));
}

export async function updateTrip(input: unknown) {
  const viewer = await requireViewer();
  const data = updateTripSchema.parse(input);
  const db = getDatabase();
  if (!db) return { demo: true };
  await requireEditor(data.tripId, viewer.id);
  const { tripId, ...details } = data;
  const [updated] = await db
    .update(trips)
    .set({
      title: details.title,
      destination: details.destination,
      startDate: optionalValue(details.startDate),
      endDate: optionalValue(details.endDate),
      updatedAt: new Date(),
    })
    .where(eq(trips.id, tripId))
    .returning({ id: trips.id });
  if (!updated) throw new Error("This trip could not be updated.");
  revalidatePath("/trips");
  revalidatePath(`/trips/${tripId}`);
  return { demo: false };
}
