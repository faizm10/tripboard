import { boolean, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

const neonAuth = pgSchema("neon_auth");

/**
 * Read/write mapping for the Neon-managed identity records. These tables are
 * provisioned by Neon Auth, so they are deliberately not exported through the
 * application's migration schema.
 */
export const neonAuthUsers = neonAuth.table("user", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  emailVerified: boolean("emailVerified").notNull(),
  image: text("image"),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull(),
  banned: boolean("banned").notNull().default(false),
  banReason: text("banReason"),
  banExpires: timestamp("banExpires", { withTimezone: true }),
});

export const neonAuthSessions = neonAuth.table("session", {
  id: uuid("id").primaryKey(),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull(),
  userId: uuid("userId").notNull(),
});
