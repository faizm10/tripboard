import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

export default defineConfig({
  out: "./drizzle",
  schema: "./src/lib/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://local:local@localhost:5432/tripboard",
  },
});
