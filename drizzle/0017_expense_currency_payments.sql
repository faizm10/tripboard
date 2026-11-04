ALTER TABLE "trip_expenses" ADD COLUMN "kind" text DEFAULT 'expense' NOT NULL;--> statement-breakpoint
ALTER TABLE "trip_expenses" ADD COLUMN "currency" text;--> statement-breakpoint
ALTER TABLE "trip_expenses" ADD COLUMN "rate" double precision DEFAULT 1 NOT NULL;