CREATE TABLE "trip_agenda_day_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"planned_date" date NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_agenda_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"planned_date" date,
	"start_time" text,
	"place_id" uuid,
	"title" text NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_agendas" (
	"trip_id" uuid PRIMARY KEY NOT NULL,
	"brief" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trip_agenda_day_notes" ADD CONSTRAINT "trip_agenda_day_notes_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_agenda_items" ADD CONSTRAINT "trip_agenda_items_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_agenda_items" ADD CONSTRAINT "trip_agenda_items_place_id_trip_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."trip_places"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_agendas" ADD CONSTRAINT "trip_agendas_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "trip_agenda_day_notes_trip_date_unique" ON "trip_agenda_day_notes" USING btree ("trip_id","planned_date");--> statement-breakpoint
CREATE INDEX "trip_agenda_day_notes_trip_date_idx" ON "trip_agenda_day_notes" USING btree ("trip_id","planned_date");--> statement-breakpoint
CREATE INDEX "trip_agenda_items_trip_date_idx" ON "trip_agenda_items" USING btree ("trip_id","planned_date","sort_order");--> statement-breakpoint
CREATE INDEX "trip_agenda_items_place_idx" ON "trip_agenda_items" USING btree ("place_id");