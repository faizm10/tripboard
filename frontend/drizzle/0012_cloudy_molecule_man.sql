CREATE TABLE "trip_transit_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"planned_date" date NOT NULL,
	"from_stop" jsonb NOT NULL,
	"to_stop" jsonb NOT NULL,
	"departure_time" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trip_transit_plans" ADD CONSTRAINT "trip_transit_plans_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trip_transit_plans_day_idx" ON "trip_transit_plans" USING btree ("trip_id","planned_date");