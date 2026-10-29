import { getTableColumns, getTableName, is, sql } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { getDatabase } from "@/lib/db";
import * as schema from "@/lib/db/schema";

/** Every table and column the app's code expects, read from the Drizzle schema. */
export function expectedSchema() {
  return (Object.values(schema) as unknown[])
    .filter((value): value is PgTable => is(value, PgTable))
    .map((table) => ({ table: getTableName(table), columns: Object.values(getTableColumns(table)).map((column) => column.name) }));
}

export function missingSchema(expected: ReturnType<typeof expectedSchema>, existing: { table: string; column: string }[]) {
  const present = new Map<string, Set<string>>();
  for (const row of existing) present.set(row.table, (present.get(row.table) ?? new Set()).add(row.column));
  const tables: string[] = [];
  const columns: string[] = [];
  for (const { table, columns: names } of expected) {
    const found = present.get(table);
    if (!found) { tables.push(table); continue; }
    for (const name of names) if (!found.has(name)) columns.push(`${table}.${name}`);
  }
  return { tables, columns };
}

/** Compares the live database with the schema so a forgotten migration shows up before people hit save errors. */
export async function checkSchemaHealth() {
  const db = getDatabase();
  if (!db) return null;
  const result = await db.execute<{ table_name: string; column_name: string }>(
    sql`select table_name, column_name from information_schema.columns where table_schema = 'public'`,
  );
  const existing = result.rows.map((row) => ({ table: row.table_name, column: row.column_name }));
  return missingSchema(expectedSchema(), existing);
}
