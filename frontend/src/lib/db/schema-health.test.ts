import { describe, expect, it } from "vitest";
import { expectedSchema, missingSchema } from "@/lib/db/schema-health";

describe("schema health", () => {
  it("reads the tables the app expects from the schema", () => {
    const tables = expectedSchema().map((entry) => entry.table);
    expect(tables).toContain("trips");
    expect(tables).toContain("trip_expenses");
  });

  it("reports missing tables and columns", () => {
    const expected = [{ table: "trips", columns: ["id", "title"] }, { table: "trip_expenses", columns: ["id"] }];
    expect(missingSchema(expected, [{ table: "trips", column: "id" }])).toEqual({ tables: ["trip_expenses"], columns: ["trips.title"] });
  });
});
