ALTER TABLE "trip_places" ADD COLUMN "name" text DEFAULT 'Saved place' NOT NULL;--> statement-breakpoint
ALTER TABLE "trip_places" ADD COLUMN "address" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "trip_places" ADD COLUMN "neighborhood" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "trip_places" ADD COLUMN "longitude" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "trip_places" ADD COLUMN "latitude" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "trip_places" ADD COLUMN "saved" boolean DEFAULT true NOT NULL;