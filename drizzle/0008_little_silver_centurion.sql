CREATE TABLE "trip_flights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"planned_date" date NOT NULL,
	"airline" text DEFAULT '' NOT NULL,
	"flight_number" text DEFAULT '' NOT NULL,
	"departure_airport" text NOT NULL,
	"arrival_airport" text NOT NULL,
	"departure_time" text NOT NULL,
	"arrival_time" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trip_flights" ADD CONSTRAINT "trip_flights_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trip_flights_trip_date_idx" ON "trip_flights" USING btree ("trip_id","planned_date","departure_time");