import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/lib/db/schema";
import { databaseUrl } from "@/lib/env";

let database: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDatabase() {
  const connectionString = databaseUrl();
  if (!connectionString) return null;
  if (!database) {
    database = drizzle(neon(connectionString), { schema });
  }
  return database;
}
