import { z } from "zod";
import { PLACE_CATEGORIES } from "@/lib/types";

const optionalIsoDate = z.iso.date().optional().or(z.literal(""));

const tripDetailsFields = {
  title: z.string().trim().min(2).max(80),
  destination: z.string().trim().min(2).max(100),
  startDate: optionalIsoDate,
  endDate: optionalIsoDate,
};

function withOptionalReturnAfterStart<T extends z.ZodRawShape>(shape: T) {
  return z.object(shape).refine(
    (data) => {
      const dates = data as { startDate?: string; endDate?: string };
      if (!dates.startDate || !dates.endDate) return true;
      return dates.endDate >= dates.startDate;
    },
    {
      message: "The end date must be after the start date.",
      path: ["endDate"],
    },
  );
}

export const createTripSchema = withOptionalReturnAfterStart(tripDetailsFields);

export const updateTripSchema = withOptionalReturnAfterStart({
  tripId: z.string().uuid(),
  ...tripDetailsFields,
});

export const deleteTripSchema = z.object({ tripId: z.string().uuid() });

export const addPlaceSchema = z.object({
  tripId: z.string().uuid(),
  cityId: z.string().uuid().optional().or(z.literal("")),
  fsqPlaceId: z.string().min(1).max(255),
  name: z.string().trim().min(1).max(200),
  address: z.string().trim().max(300).default(""),
  neighborhood: z.string().trim().max(120).default(""),
  longitude: z.number().min(-180).max(180),
  latitude: z.number().min(-90).max(90),
  category: z.enum(PLACE_CATEGORIES),
  note: z.string().trim().max(500).default(""),
  sourceUrl: z.url().optional().or(z.literal("")),
  saved: z.boolean().default(true),
  plannedDate: z.iso.date().optional().or(z.literal("")),
  daySortOrder: z.number().int().min(0).optional(),
});

export const addTripCitySchema = withOptionalReturnAfterStart({
  tripId: z.string().uuid(),
  name: z.string().trim().min(2).max(100),
  country: z.string().trim().max(100).default(""),
  startDate: optionalIsoDate,
  endDate: optionalIsoDate,
});

export const updateTripCitySchema = withOptionalReturnAfterStart({
  tripId: z.string().uuid(),
  cityId: z.string().uuid(),
  name: z.string().trim().min(2).max(100),
  country: z.string().trim().max(100).default(""),
  startDate: optionalIsoDate,
  endDate: optionalIsoDate,
});

export const removeTripCitySchema = z.object({
  tripId: z.string().uuid(),
  cityId: z.string().uuid(),
});

export const updatePlaceSchema = z.object({
  tripId: z.string().uuid(),
  placeId: z.string().uuid(),
  saved: z.boolean(),
});

export const updatePlaceDetailsSchema = z.object({
  tripId: z.string().uuid(),
  placeId: z.string().uuid(),
  cityId: z.string().uuid().optional().or(z.literal("")),
  name: z.string().trim().min(1).max(200),
  address: z.string().trim().max(300).default(""),
  neighborhood: z.string().trim().max(120).default(""),
  category: z.enum(PLACE_CATEGORIES),
  note: z.string().trim().max(500).default(""),
  sourceUrl: z.url().optional().or(z.literal("")),
  plannedDate: z.iso.date().optional().or(z.literal("")),
  daySortOrder: z.number().int().min(0).optional(),
});

export const updatePlacePlanningSchema = z.object({
  tripId: z.string().uuid(),
  placeId: z.string().uuid(),
  cityId: z.string().uuid().optional().or(z.literal("")),
  plannedDate: z.iso.date().optional().or(z.literal("")),
  daySortOrder: z.number().int().min(0).optional(),
});

export const reorderDayPlacesSchema = z.object({
  tripId: z.string().uuid(),
  plannedDate: z.iso.date(),
  placeIds: z.array(z.string().uuid()).min(1).max(100).refine((ids) => new Set(ids).size === ids.length, {
    message: "Each place can only appear once in the itinerary order.",
  }),
});

export const removePlaceSchema = z.object({
  tripId: z.string().uuid(),
  placeId: z.string().uuid(),
});

export const addDayNoteSchema = z.object({
  tripId: z.string().uuid(),
  cityId: z.string().uuid().optional().or(z.literal("")),
  plannedDate: z.iso.date(),
  note: z.string().trim().min(1).max(500),
});

export const updateDayNoteSchema = z.object({
  tripId: z.string().uuid(),
  noteId: z.string().uuid(),
  cityId: z.string().uuid().optional().or(z.literal("")),
  plannedDate: z.iso.date(),
  note: z.string().trim().min(1).max(500),
});

export const removeDayNoteSchema = z.object({
  tripId: z.string().uuid(),
  noteId: z.string().uuid(),
});

const optionalAgendaDate = z.iso.date().optional().or(z.literal(""));
const optionalAgendaTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().or(z.literal(""));
const flightTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const airportCode = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a three-letter airport code.");

const flightFields = {
  tripId: z.string().uuid(),
  plannedDate: z.iso.date(),
  arrivalDate: z.iso.date(),
  airline: z.string().trim().max(80).default(""),
  flightNumber: z.string().trim().max(20).default(""),
  departureAirport: airportCode,
  arrivalAirport: airportCode,
  departureTime: flightTime,
  arrivalTime: flightTime,
};

export const addFlightSchema = z.object(flightFields);

export const updateFlightSchema = z.object({
  ...flightFields,
  flightId: z.string().uuid(),
});

export const removeFlightSchema = z.object({
  tripId: z.string().uuid(),
  flightId: z.string().uuid(),
});

const hotelStayFields = {
  tripId: z.string().uuid(),
  cityId: z.string().uuid().optional().or(z.literal("")),
  name: z.string().trim().min(2).max(160),
  address: z.string().trim().max(300).default(""),
  longitude: z.number().min(-180).max(180),
  latitude: z.number().min(-90).max(90),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
};

export const addHotelStaySchema = z.object(hotelStayFields).refine((stay) => stay.endDate >= stay.startDate, {
  message: "The last hotel day must be on or after the first.",
  path: ["endDate"],
});

export const updateHotelStaySchema = addHotelStaySchema.extend({ hotelId: z.string().uuid() });

export const removeHotelStaySchema = z.object({ tripId: z.string().uuid(), hotelId: z.string().uuid() });

export const updateAgendaBriefSchema = z.object({
  tripId: z.string().uuid(),
  brief: z.string().trim().max(5000),
});

export const saveAgendaDayNoteSchema = z.object({
  tripId: z.string().uuid(),
  plannedDate: z.iso.date(),
  note: z.string().trim().max(2000),
});

export const addAgendaItemSchema = z.object({
  tripId: z.string().uuid(),
  plannedDate: optionalAgendaDate,
  startTime: optionalAgendaTime,
  placeId: z.string().uuid().optional().or(z.literal("")),
  title: z.string().trim().min(1).max(160),
});

export const updateAgendaItemSchema = addAgendaItemSchema.extend({
  itemId: z.string().uuid(),
  completed: z.boolean(),
});

export const removeAgendaItemSchema = z.object({
  tripId: z.string().uuid(),
  itemId: z.string().uuid(),
});

export const directionsSchema = z.object({
  coordinates: z
    .array(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]))
    .min(2)
    .max(12),
  mode: z.enum(["walking", "cycling", "driving"]),
});

const tripIdField = { tripId: z.string().uuid() };
export const inviteTokenSchema = z.string().trim().min(20).max(160);

export const createEmailInviteSchema = z.object({
  tripId: z.string().uuid(),
  email: z.email().toLowerCase(),
});

export const createShareInviteSchema = z.object(tripIdField);

export const revokeInviteSchema = z.object({
  tripId: z.string().uuid(),
  invitationId: z.string().uuid(),
});

export const inviteSchema = createEmailInviteSchema;

export const signInSchema = z.object({
  email: z.email("Enter a valid email.").toLowerCase(),
  password: z.string().min(1, "Enter your password."),
});

export const signUpSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your name.").max(80),
    email: z.email("Enter a valid email.").toLowerCase(),
    password: z.string().min(8, "Use at least 8 characters."),
    confirmPassword: z.string().min(1, "Confirm your password."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const accountNameSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(80),
});
