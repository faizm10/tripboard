"use server";

import { and, desc, eq, gt, gte, isNull, lte, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import type { ActionResult } from "@/lib/action-result";
import { getViewer } from "@/lib/auth";
import { getDatabase } from "@/lib/db";
import { countryFromDestination } from "@/lib/dates";
import { tripActivity, tripExpenses, tripFinances, tripTransitPlans, tripAgendaDayNotes, tripAgendaItems, tripAgendas, tripCities, tripDayNotes, tripFlights, tripHotels, tripInvitationAcceptances, tripInvitations, tripMembers, tripPlaces, trips } from "@/lib/db/schema";
import { createInviteToken, hashInviteToken, inviteExpiresAt, inviteStatus } from "@/lib/invitations";
import type { TripInvitationSummary } from "@/lib/types";
import {
  saveTransitPlanSchema,
  removeTransitPlanSchema,
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
  addExpenseSchema,
  removeExpenseSchema,
  saveFinanceSettingsSchema,
  updateExpenseSchema,
  updateAgendaItemSchema,
  updatePlaceDetailsSchema,
  updatePlacePlanningSchema,
  updatePlaceSchema,
  updateTripCitySchema,
  deleteTripSchema,
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

/**
 * Refreshes the trip like revalidateTrip and records a one-line summary for collaborators.
 * Logging never blocks the save: before the activity migration runs it is silently skipped.
 */
async function recordChange(tripId: string, viewer: { id: string; name?: string | null }, summary: string) {
  revalidateTrip(tripId);
  const db = getDatabase();
  if (!db) return;
  try {
    await db.insert(tripActivity).values({ tripId, actorId: viewer.id, actorName: viewer.name?.trim() || "Someone", summary: summary.slice(0, 200) });
  } catch (error) {
    console.warn("Couldn't record trip activity", error);
  }
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

function isPlaceDayConflict(error: unknown) {
  const message = error instanceof Error ? `${error.message} ${error.cause ?? ""}` : String(error);
  return message.includes("trip_places_provider_day_unique") || message.includes("trip_places_provider_unique") || message.includes("duplicate key");
}

function placeDayConflictError(plannedDate?: string | null) {
  return new Error(plannedDate ? "That place is already on this day." : "That place is already saved without a day.");
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

async function createTripAction(input: unknown) {
  const viewer = await requireViewer();
  const data = createTripSchema.parse(input);
  const db = getDatabase();
  if (!db) return { id: "nyc-weekender", demo: true };
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

async function addPlaceAction(input: unknown) {
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
    await recordChange(data.tripId, viewer, `added ${data.name}`);
    return { demo: false, id: saved.id };
  } catch (error) {
    if (isPlaceDayConflict(error)) throw placeDayConflictError(data.plannedDate);
    throw error;
  }
}

async function updatePlaceAction(input: unknown) {
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

async function updatePlaceDetailsAction(input: unknown) {
  const viewer = await requireViewer();
  const data = updatePlaceDetailsSchema.parse(input);
  const db = getDatabase();
  if (!db) return { demo: true };
  await requireEditor(data.tripId, viewer.id);
  let updated: { id: string } | undefined;
  try {
    [updated] = await db
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
  } catch (error) {
    if (isPlaceDayConflict(error)) throw placeDayConflictError(data.plannedDate);
    throw error;
  }
  if (!updated) throw new Error("This place could not be updated.");
  await recordChange(data.tripId, viewer, "edited a place");
  return { demo: false };
}

async function updatePlacePlanningAction(input: unknown) {
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
  let updated: { id: string } | undefined;
  try {
    [updated] = await db
      .update(tripPlaces)
      .set({
        cityId: plannedDate ? optionalValue(data.cityId) : null,
        plannedDate,
        daySortOrder: data.daySortOrder ?? 0,
      })
      .where(and(eq(tripPlaces.id, data.placeId), eq(tripPlaces.tripId, data.tripId)))
      .returning({ id: tripPlaces.id });
  } catch (error) {
    if (isPlaceDayConflict(error)) throw placeDayConflictError(plannedDate);
    throw error;
  }
  if (!updated) throw new Error("This place could not be updated.");
  await recordChange(data.tripId, viewer, data.plannedDate ? `moved a place to ${data.plannedDate}` : "moved a place off its day");
  return { demo: false };
}

async function reorderDayPlacesAction(input: unknown) {
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
  await recordChange(data.tripId, viewer, "reordered a day");
  return { demo: false };
}

async function removePlaceAction(input: unknown) {
  const viewer = await requireViewer();
  const data = removePlaceSchema.parse(input);
  const db = getDatabase();
  if (!db) return { demo: true };
  await requireEditor(data.tripId, viewer.id);
  await db.delete(tripPlaces).where(and(eq(tripPlaces.id, data.placeId), eq(tripPlaces.tripId, data.tripId)));
  await recordChange(data.tripId, viewer, "removed a place");
  return { demo: false };
}

async function addTripCityAction(input: unknown) {
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
  await recordChange(data.tripId, viewer, `added ${data.name} as a stop`);
  return { demo: false, id: city.id };
}

async function updateTripCityAction(input: unknown) {
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
  await recordChange(data.tripId, viewer, "updated a city stop");
  return { demo: false };
}

async function removeTripCityAction(input: unknown) {
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
  await recordChange(data.tripId, viewer, "removed a city stop");
  return { demo: false };
}

async function addDayNoteAction(input: unknown) {
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
  await recordChange(data.tripId, viewer, "added a day note");
  return { demo: false, id: note.id };
}

async function updateDayNoteAction(input: unknown) {
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
  await recordChange(data.tripId, viewer, "edited a day note");
  return { demo: false };
}

async function removeDayNoteAction(input: unknown) {
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
  await recordChange(data.tripId, viewer, "removed a day note");
  return { demo: false };
}

async function addFlightAction(input: unknown) {
  const viewer = await requireViewer();
  const data = addFlightSchema.parse(input);
  const db = getDatabase();
  if (!db) return { demo: true, id: "" };
  await requireEditor(data.tripId, viewer.id);
  try {
    const [flight] = await db
      .insert(tripFlights)
      .values({
        tripId: data.tripId,
        mode: data.mode,
        plannedDate: data.plannedDate,
        arrivalDate: data.arrivalDate,
        airline: data.airline,
        flightNumber: data.flightNumber,
        departureAirport: data.departureAirport,
        arrivalAirport: data.arrivalAirport,
        departureTime: data.departureTime,
        arrivalTime: data.arrivalTime,
      })
      .returning({ id: tripFlights.id });
    await recordChange(data.tripId, viewer, `added ${data.mode === "train" ? "a train" : data.mode === "bus" ? "a bus" : "a flight"} ${data.departureAirport} → ${data.arrivalAirport}`);
    return { demo: false, id: flight.id };
  } catch (error) {
    if (isFlightSchemaMissing(error)) throw flightMigrationError();
    throw error;
  }
}

async function updateFlightAction(input: unknown) {
  const viewer = await requireViewer();
  const data = updateFlightSchema.parse(input);
  const db = getDatabase();
  if (!db) return { demo: true };
  await requireEditor(data.tripId, viewer.id);
  try {
    const [flight] = await db
      .update(tripFlights)
      .set({
        mode: data.mode,
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
    await recordChange(data.tripId, viewer, `updated ${data.departureAirport} → ${data.arrivalAirport}`);
    return { demo: false };
  } catch (error) {
    if (isFlightSchemaMissing(error)) throw flightMigrationError();
    throw error;
  }
}

async function removeFlightAction(input: unknown) {
  const viewer = await requireViewer();
  const data = removeFlightSchema.parse(input);
  const db = getDatabase();
  if (!db) return { demo: true };
  await requireEditor(data.tripId, viewer.id);
  try {
    await db.delete(tripFlights).where(and(eq(tripFlights.id, data.flightId), eq(tripFlights.tripId, data.tripId)));
    await recordChange(data.tripId, viewer, "removed a trip leg");
    return { demo: false };
  } catch (error) {
    if (isFlightSchemaMissing(error)) throw flightMigrationError();
    throw error;
  }
}

async function addHotelStayAction(input: unknown) {
  const viewer = await requireViewer();
  const data = addHotelStaySchema.parse(input);
  const db = getDatabase();
  if (!db) return { demo: true, id: "" };
  await requireEditor(data.tripId, viewer.id);
  try {
    await ensureHotelCity(data.tripId, optionalValue(data.cityId));
    await ensureHotelDatesAvailable(data.tripId, data.startDate, data.endDate, optionalValue(data.cityId));
    const [stay] = await db.insert(tripHotels).values({ ...data, cityId: optionalValue(data.cityId) }).returning({ id: tripHotels.id });
    await recordChange(data.tripId, viewer, `added ${data.name} as a hotel`);
    return { demo: false, id: stay.id };
  } catch (error) {
    if (isHotelSchemaMissing(error)) throw hotelMigrationError();
    throw error;
  }
}

async function updateHotelStayAction(input: unknown) {
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
    await recordChange(data.tripId, viewer, `updated the stay at ${data.name}`);
    return { demo: false };
  } catch (error) {
    if (isHotelSchemaMissing(error)) throw hotelMigrationError();
    throw error;
  }
}

async function removeHotelStayAction(input: unknown) {
  const viewer = await requireViewer();
  const data = removeHotelStaySchema.parse(input);
  const db = getDatabase();
  if (!db) return { demo: true };
  await requireEditor(data.tripId, viewer.id);
  try {
    await db.delete(tripHotels).where(and(eq(tripHotels.id, data.hotelId), eq(tripHotels.tripId, data.tripId)));
    await recordChange(data.tripId, viewer, "removed a hotel stay");
    return { demo: false };
  } catch (error) {
    if (isHotelSchemaMissing(error)) throw hotelMigrationError();
    throw error;
  }
}

async function updateAgendaBriefAction(input: unknown) {
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
  await recordChange(data.tripId, viewer, "edited the agenda");
  return { demo: false };
}

async function saveAgendaDayNoteAction(input: unknown) {
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

async function addAgendaItemAction(input: unknown) {
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
    await recordChange(data.tripId, viewer, `added “${data.title}” to the agenda`);
    return { demo: false, id: item.id, sortOrder: item.sortOrder };
  } catch (error) {
    if (isAgendaSchemaMissing(error)) throw agendaMigrationError();
    throw error;
  }
}

async function updateAgendaItemAction(input: unknown) {
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

async function removeAgendaItemAction(input: unknown) {
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
  await recordChange(data.tripId, viewer, "removed an agenda item");
  return { demo: false };
}

async function listTripInvitesAction(input: unknown): Promise<{ demo: boolean; invites: TripInvitationSummary[] }> {
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

async function createEmailInviteAction(input: unknown) {
  const viewer = await requireViewer();
  const data = createEmailInviteSchema.parse(input);
  const db = getDatabase();
  if (!db) return { inviteUrl: "/invite/demo-nyc-board", demo: true, expiresAt: inviteExpiresAt().toISOString() };
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

async function createShareInviteAction(input: unknown) {
  const viewer = await requireViewer();
  const data = createShareInviteSchema.parse(input);
  const db = getDatabase();
  if (!db) return { inviteUrl: "/invite/demo-nyc-board", demo: true, expiresAt: inviteExpiresAt().toISOString() };
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

async function revokeInviteAction(input: unknown) {
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

async function inviteCollaboratorAction(input: unknown) {
  const data = inviteSchema.parse(input);
  return createEmailInviteAction(data);
}

export async function acceptInvitation(rawToken: string) {
  if (rawToken === "demo-nyc-board") redirect("/trips/nyc-weekender");
  const token = inviteTokenSchema.parse(rawToken);
  const viewer = await requireViewer();
  const db = getDatabase();
  if (!db) redirect("/trips/nyc-weekender");
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

async function updateTripAction(input: unknown) {
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

/**
 * Only the owner may delete a trip. Every child table hangs off `trips` with
 * `onDelete: cascade`, so the single delete takes members, places, cities,
 * notes, logistics and invitations with it.
 */
async function deleteTripAction(input: unknown) {
  const viewer = await requireViewer();
  const data = deleteTripSchema.parse(input);
  const db = getDatabase();
  if (!db) return { demo: true };
  await requireOwner(data.tripId, viewer.id);
  const [deleted] = await db.delete(trips).where(eq(trips.id, data.tripId)).returning({ id: trips.id });
  if (!deleted) throw new Error("This trip could not be deleted.");
  revalidatePath("/trips");
  revalidatePath(`/trips/${data.tripId}`);
  return { demo: false };
}

async function saveTransitPlanAction(input: unknown) {
  const viewer = await requireViewer();
  const data = saveTransitPlanSchema.parse(input);
  const db = getDatabase();
  if (!db) throw new Error("Transit plans could not be saved. Try again later.");
  await requireEditor(data.tripId, viewer.id);
  const { id, ...values } = data;
  const [saved] = id
    ? await db.update(tripTransitPlans).set({ ...values, updatedAt: new Date() })
      .where(and(eq(tripTransitPlans.id, id), eq(tripTransitPlans.tripId, data.tripId)))
      .returning({ id: tripTransitPlans.id })
    : await db.insert(tripTransitPlans).values(values).returning({ id: tripTransitPlans.id });
  if (!saved) throw new Error("This transit plan could not be updated.");
  await recordChange(data.tripId, viewer, "planned a commute");
  return saved;
}

async function removeTransitPlanAction(input: unknown) {
  const viewer = await requireViewer();
  const data = removeTransitPlanSchema.parse(input);
  const db = getDatabase();
  if (!db) throw new Error("Transit plans could not be saved. Try again later.");
  await requireEditor(data.tripId, viewer.id);
  await db.delete(tripTransitPlans).where(and(eq(tripTransitPlans.id, data.id), eq(tripTransitPlans.tripId, data.tripId)));
  await recordChange(data.tripId, viewer, "removed a commute");
}

function isFinanceSchemaMissing(error: unknown) {
  const message = error instanceof Error ? `${error.message} ${error.cause ?? ""}` : String(error);
  return /trip_finances|trip_expenses|relation .* does not exist/i.test(message);
}

function financeMigrationError() {
  return new Error("Money needs the latest database migration before it can be saved.");
}

async function withFinanceSchema<T>(work: () => Promise<T>) {
  try {
    return await work();
  } catch (error) {
    if (isFinanceSchemaMissing(error)) throw financeMigrationError();
    throw error;
  }
}

async function saveFinanceSettingsAction(input: unknown) {
  const viewer = await requireViewer();
  const data = saveFinanceSettingsSchema.parse(input);
  const db = getDatabase();
  if (!db) return { demo: true };
  await requireEditor(data.tripId, viewer.id);
  const people = Array.from(new Set(data.people));
  await withFinanceSchema(() => db
    .insert(tripFinances)
    .values({ tripId: data.tripId, currency: data.currency, people })
    .onConflictDoUpdate({ target: tripFinances.tripId, set: { currency: data.currency, people, updatedAt: new Date() } }));
  await recordChange(data.tripId, viewer, "updated who’s splitting costs");
  return { demo: false };
}

async function addExpenseAction(input: unknown) {
  const viewer = await requireViewer();
  const data = addExpenseSchema.parse(input);
  const db = getDatabase();
  if (!db) return { id: crypto.randomUUID(), demo: true };
  await requireEditor(data.tripId, viewer.id);
  const [row] = await withFinanceSchema(() => db
    .insert(tripExpenses)
    .values({ tripId: data.tripId, title: data.title, amountCents: data.amountCents, paidBy: data.paidBy, split: data.split, spentOn: data.spentOn || null, kind: data.kind, currency: data.currency ?? null, rate: data.rate, createdBy: viewer.id })
    .returning({ id: tripExpenses.id }));
  await recordChange(data.tripId, viewer, `added ${data.title} to Money`);
  return { id: row.id, demo: false };
}

async function updateExpenseAction(input: unknown) {
  const viewer = await requireViewer();
  const data = updateExpenseSchema.parse(input);
  const db = getDatabase();
  if (!db) return { demo: true };
  await requireEditor(data.tripId, viewer.id);
  await withFinanceSchema(() => db
    .update(tripExpenses)
    .set({ title: data.title, amountCents: data.amountCents, paidBy: data.paidBy, split: data.split, spentOn: data.spentOn || null, kind: data.kind, currency: data.currency ?? null, rate: data.rate, updatedAt: new Date() })
    .where(and(eq(tripExpenses.id, data.expenseId), eq(tripExpenses.tripId, data.tripId))));
  await recordChange(data.tripId, viewer, `updated ${data.title} in Money`);
  return { demo: false };
}

async function removeExpenseAction(input: unknown) {
  const viewer = await requireViewer();
  const data = removeExpenseSchema.parse(input);
  const db = getDatabase();
  if (!db) return { demo: true };
  await requireEditor(data.tripId, viewer.id);
  await withFinanceSchema(() => db.delete(tripExpenses).where(and(eq(tripExpenses.id, data.expenseId), eq(tripExpenses.tripId, data.tripId))));
  await recordChange(data.tripId, viewer, "removed an expense");
  return { demo: false };
}

/** Messages we wrote for people (plain Errors) pass through; validation and database failures get a friendly fallback. */
function publicMessage(error: unknown) {
  if (error instanceof Error && error.name === "ZodError") return "Some of those details don’t look right. Check them and try again.";
  if (error instanceof Error && error.constructor === Error && !error.cause && error.message) return error.message;
  return "Something went wrong saving that. Try again in a moment.";
}

async function runAction<T>(work: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await work() };
  } catch (error) {
    unstable_rethrow(error);
    console.error(error);
    return { ok: false, error: publicMessage(error) };
  }
}

export async function createTrip(input: unknown) { return runAction(() => createTripAction(input)); }
export async function addPlace(input: unknown) { return runAction(() => addPlaceAction(input)); }
export async function updatePlace(input: unknown) { return runAction(() => updatePlaceAction(input)); }
export async function updatePlaceDetails(input: unknown) { return runAction(() => updatePlaceDetailsAction(input)); }
export async function updatePlacePlanning(input: unknown) { return runAction(() => updatePlacePlanningAction(input)); }
export async function reorderDayPlaces(input: unknown) { return runAction(() => reorderDayPlacesAction(input)); }
export async function removePlace(input: unknown) { return runAction(() => removePlaceAction(input)); }
export async function addTripCity(input: unknown) { return runAction(() => addTripCityAction(input)); }
export async function updateTripCity(input: unknown) { return runAction(() => updateTripCityAction(input)); }
export async function removeTripCity(input: unknown) { return runAction(() => removeTripCityAction(input)); }
export async function addDayNote(input: unknown) { return runAction(() => addDayNoteAction(input)); }
export async function updateDayNote(input: unknown) { return runAction(() => updateDayNoteAction(input)); }
export async function removeDayNote(input: unknown) { return runAction(() => removeDayNoteAction(input)); }
export async function addFlight(input: unknown) { return runAction(() => addFlightAction(input)); }
export async function updateFlight(input: unknown) { return runAction(() => updateFlightAction(input)); }
export async function removeFlight(input: unknown) { return runAction(() => removeFlightAction(input)); }
export async function addHotelStay(input: unknown) { return runAction(() => addHotelStayAction(input)); }
export async function updateHotelStay(input: unknown) { return runAction(() => updateHotelStayAction(input)); }
export async function removeHotelStay(input: unknown) { return runAction(() => removeHotelStayAction(input)); }
export async function updateAgendaBrief(input: unknown) { return runAction(() => updateAgendaBriefAction(input)); }
export async function saveAgendaDayNote(input: unknown) { return runAction(() => saveAgendaDayNoteAction(input)); }
export async function addAgendaItem(input: unknown) { return runAction(() => addAgendaItemAction(input)); }
export async function updateAgendaItem(input: unknown) { return runAction(() => updateAgendaItemAction(input)); }
export async function removeAgendaItem(input: unknown) { return runAction(() => removeAgendaItemAction(input)); }
export async function listTripInvites(input: unknown) { return runAction(() => listTripInvitesAction(input)); }
export async function createEmailInvite(input: unknown) { return runAction(() => createEmailInviteAction(input)); }
export async function createShareInvite(input: unknown) { return runAction(() => createShareInviteAction(input)); }
export async function revokeInvite(input: unknown) { return runAction(() => revokeInviteAction(input)); }
export async function inviteCollaborator(input: unknown) { return runAction(() => inviteCollaboratorAction(input)); }
export async function updateTrip(input: unknown) { return runAction(() => updateTripAction(input)); }
export async function deleteTrip(input: unknown) { return runAction(() => deleteTripAction(input)); }
export async function saveTransitPlan(input: unknown) { return runAction(() => saveTransitPlanAction(input)); }
export async function removeTransitPlan(input: unknown) { return runAction(() => removeTransitPlanAction(input)); }
export async function saveFinanceSettings(input: unknown) { return runAction(() => saveFinanceSettingsAction(input)); }
export async function addExpense(input: unknown) { return runAction(() => addExpenseAction(input)); }
export async function updateExpense(input: unknown) { return runAction(() => updateExpenseAction(input)); }
export async function removeExpense(input: unknown) { return runAction(() => removeExpenseAction(input)); }
