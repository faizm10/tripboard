ALTER TABLE "trip_flights" ADD COLUMN "arrival_date" date;
--> statement-breakpoint
UPDATE "trip_flights" SET "arrival_date" = "planned_date" WHERE "arrival_date" IS NULL;
--> statement-breakpoint
ALTER TABLE "trip_flights" ALTER COLUMN "arrival_date" SET NOT NULL;
