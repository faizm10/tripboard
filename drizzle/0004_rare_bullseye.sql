DROP INDEX "trip_cities_trip_sort_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "trip_cities_trip_sort_unique" ON "trip_cities" USING btree ("trip_id","sort_order");