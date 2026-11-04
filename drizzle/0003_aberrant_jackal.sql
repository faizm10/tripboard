CREATE TABLE "trip_cities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"name" text NOT NULL,
	"country" text DEFAULT '' NOT NULL,
	"start_date" date,
	"end_date" date,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_day_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"city_id" uuid,
	"planned_date" date NOT NULL,
	"note" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"added_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trip_places" ADD COLUMN "city_id" uuid;--> statement-breakpoint
ALTER TABLE "trip_places" ADD COLUMN "planned_date" date;--> statement-breakpoint
ALTER TABLE "trip_places" ADD COLUMN "day_sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "trip_cities" ADD CONSTRAINT "trip_cities_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "trip_cities" ("trip_id", "name", "country", "start_date", "end_date", "sort_order")
SELECT
	"id",
	coalesce(nullif(btrim(split_part("destination", ',', 1)), ''), "destination"),
	coalesce(nullif(btrim(regexp_replace("destination", '^.*,', '')), ''), ''),
	"start_date",
	"end_date",
	0
FROM "trips";--> statement-breakpoint
UPDATE "trip_places"
SET "city_id" = "trip_cities"."id"
FROM "trip_cities"
WHERE "trip_places"."trip_id" = "trip_cities"."trip_id"
	AND "trip_cities"."sort_order" = 0
	AND "trip_places"."city_id" IS NULL;--> statement-breakpoint
ALTER TABLE "trip_day_notes" ADD CONSTRAINT "trip_day_notes_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_day_notes" ADD CONSTRAINT "trip_day_notes_city_id_trip_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."trip_cities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trip_cities_trip_sort_idx" ON "trip_cities" USING btree ("trip_id","sort_order");--> statement-breakpoint
CREATE INDEX "trip_day_notes_day_idx" ON "trip_day_notes" USING btree ("trip_id","planned_date","sort_order");--> statement-breakpoint
CREATE INDEX "trip_day_notes_city_idx" ON "trip_day_notes" USING btree ("city_id");--> statement-breakpoint
ALTER TABLE "trip_places" ADD CONSTRAINT "trip_places_city_id_trip_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."trip_cities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trip_places_day_idx" ON "trip_places" USING btree ("trip_id","planned_date","day_sort_order");--> statement-breakpoint
CREATE INDEX "trip_places_city_idx" ON "trip_places" USING btree ("city_id");
