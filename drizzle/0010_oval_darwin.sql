CREATE TABLE "trip_hotels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"city_id" uuid,
	"name" text NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"longitude" double precision NOT NULL,
	"latitude" double precision NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trip_hotels" ADD CONSTRAINT "trip_hotels_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_hotels" ADD CONSTRAINT "trip_hotels_city_id_trip_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."trip_cities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trip_hotels_trip_dates_idx" ON "trip_hotels" USING btree ("trip_id","start_date","end_date");--> statement-breakpoint
CREATE INDEX "trip_hotels_city_idx" ON "trip_hotels" USING btree ("city_id");