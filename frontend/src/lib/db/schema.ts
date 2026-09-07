import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const memberRole = pgEnum("member_role", ["owner", "editor"]);
export const invitationKind = pgEnum("invitation_kind", ["email", "share"]);
export const adminAuditAction = pgEnum("admin_audit_action", ["suspend", "restore"]);

export const adminAuditLogs = pgTable(
  "admin_audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    action: adminAuditAction("action").notNull(),
    actorUserId: text("actor_user_id").notNull(),
    actorEmail: text("actor_email").notNull(),
    targetUserId: text("target_user_id").notNull(),
    reason: text("reason").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("admin_audit_target_idx").on(table.targetUserId), index("admin_audit_created_idx").on(table.createdAt)],
);

export const trips = pgTable(
  "trips",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id").notNull(),
    title: text("title").notNull(),
    destination: text("destination").notNull(),
    startDate: date("start_date"),
    endDate: date("end_date"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("trips_owner_idx").on(table.ownerId)],
);

export const tripMembers = pgTable(
  "trip_members",
  {
    tripId: uuid("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    role: memberRole("role").notNull().default("editor"),
    displayName: text("display_name").notNull().default("Traveller"),
    image: text("image"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("trip_members_unique").on(table.tripId, table.userId),
    index("trip_members_user_idx").on(table.userId),
  ],
);

export const tripInvitations = pgTable(
  "trip_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tripId: uuid("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
    kind: invitationKind("kind").notNull().default("email"),
    email: text("email"),
    tokenHash: text("token_hash").notNull().unique(),
    role: memberRole("role").notNull().default("editor"),
    invitedBy: text("invited_by").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedBy: text("revoked_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("trip_invitations_trip_idx").on(table.tripId)],
);

export const tripInvitationAcceptances = pgTable(
  "trip_invitation_acceptances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invitationId: uuid("invitation_id").notNull().references(() => tripInvitations.id, { onDelete: "cascade" }),
    tripId: uuid("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("trip_invitation_acceptances_unique").on(table.invitationId, table.userId),
    index("trip_invitation_acceptances_trip_idx").on(table.tripId),
    index("trip_invitation_acceptances_user_idx").on(table.userId),
  ],
);

export const tripCities = pgTable(
  "trip_cities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tripId: uuid("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    country: text("country").notNull().default(""),
    startDate: date("start_date"),
    endDate: date("end_date"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("trip_cities_trip_sort_unique").on(table.tripId, table.sortOrder),
  ],
);

export const tripPlaces = pgTable(
  "trip_places",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tripId: uuid("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
    cityId: uuid("city_id").references(() => tripCities.id, { onDelete: "set null" }),
    fsqPlaceId: text("fsq_place_id").notNull(),
    name: text("name").notNull().default("Saved place"),
    address: text("address").notNull().default(""),
    neighborhood: text("neighborhood").notNull().default(""),
    longitude: doublePrecision("longitude").notNull().default(0),
    latitude: doublePrecision("latitude").notNull().default(0),
    category: text("category").notNull(),
    note: text("note").notNull().default(""),
    sourceUrl: text("source_url"),
    saved: boolean("saved").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    plannedDate: date("planned_date"),
    daySortOrder: integer("day_sort_order").notNull().default(0),
    addedBy: text("added_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("trip_places_provider_unique").on(table.tripId, table.fsqPlaceId),
    index("trip_places_trip_sort_idx").on(table.tripId, table.sortOrder),
    index("trip_places_day_idx").on(table.tripId, table.plannedDate, table.daySortOrder),
    index("trip_places_city_idx").on(table.cityId),
  ],
);

export const tripDayNotes = pgTable(
  "trip_day_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tripId: uuid("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
    cityId: uuid("city_id").references(() => tripCities.id, { onDelete: "set null" }),
    plannedDate: date("planned_date").notNull(),
    note: text("note").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    addedBy: text("added_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("trip_day_notes_day_idx").on(table.tripId, table.plannedDate, table.sortOrder),
    index("trip_day_notes_city_idx").on(table.cityId),
  ],
);

export const tripFlights = pgTable(
  "trip_flights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tripId: uuid("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
    plannedDate: date("planned_date").notNull(),
    arrivalDate: date("arrival_date").notNull(),
    airline: text("airline").notNull().default(""),
    flightNumber: text("flight_number").notNull().default(""),
    departureAirport: text("departure_airport").notNull(),
    arrivalAirport: text("arrival_airport").notNull(),
    departureTime: text("departure_time").notNull(),
    arrivalTime: text("arrival_time").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("trip_flights_trip_date_idx").on(table.tripId, table.plannedDate, table.departureTime)],
);

export const tripHotels = pgTable(
  "trip_hotels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tripId: uuid("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
    cityId: uuid("city_id").references(() => tripCities.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    address: text("address").notNull().default(""),
    longitude: doublePrecision("longitude").notNull(),
    latitude: doublePrecision("latitude").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("trip_hotels_trip_dates_idx").on(table.tripId, table.startDate, table.endDate), index("trip_hotels_city_idx").on(table.cityId)],
);

export const tripAgendas = pgTable(
  "trip_agendas",
  {
    tripId: uuid("trip_id").primaryKey().references(() => trips.id, { onDelete: "cascade" }),
    brief: text("brief").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export const tripAgendaDayNotes = pgTable(
  "trip_agenda_day_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tripId: uuid("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
    plannedDate: date("planned_date").notNull(),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("trip_agenda_day_notes_trip_date_unique").on(table.tripId, table.plannedDate),
    index("trip_agenda_day_notes_trip_date_idx").on(table.tripId, table.plannedDate),
  ],
);

export const tripAgendaItems = pgTable(
  "trip_agenda_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tripId: uuid("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
    plannedDate: date("planned_date"),
    startTime: text("start_time"),
    placeId: uuid("place_id").references(() => tripPlaces.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    completed: boolean("completed").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("trip_agenda_items_trip_date_idx").on(table.tripId, table.plannedDate, table.sortOrder),
    index("trip_agenda_items_place_idx").on(table.placeId),
  ],
);
