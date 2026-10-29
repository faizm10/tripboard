import { describe, expect, it } from "vitest";
import { expenseShares, parseAmount, personBalances, settleUp, unassignedCents } from "@/lib/finances";
import type { TripExpense } from "@/lib/types";

const expense = (overrides: Partial<TripExpense>): TripExpense => ({ id: "e", title: "Dinner", amountCents: 9000, paidBy: "Ana", split: { mode: "equal", people: ["Ana", "Ben", "Cy"] }, ...overrides });

describe("expense shares", () => {
  it("splits evenly and hands leftover cents to the first people", () => {
    expect(Object.fromEntries(expenseShares(expense({ amountCents: 1000 })))).toEqual({ Ana: 334, Ben: 333, Cy: 333 });
  });

  it("uses exact amounts when the split is custom", () => {
    expect(Object.fromEntries(expenseShares(expense({ split: { mode: "exact", shares: { Ana: 6000, Ben: 3000, Cy: 0 } } })))).toEqual({ Ana: 6000, Ben: 3000 });
  });
});

describe("balances and settling up", () => {
  it("works out who is owed and who owes", () => {
    const balances = personBalances(["Ana", "Ben", "Cy"], [expense({}), expense({ id: "f", amountCents: 3000, paidBy: "Ben" })]);
    expect(balances.map((balance) => [balance.name, balance.netCents])).toEqual([["Ana", 5000], ["Ben", -1000], ["Cy", -4000]]);
    expect(settleUp(balances)).toEqual([{ from: "Cy", to: "Ana", amountCents: 4000 }, { from: "Ben", to: "Ana", amountCents: 1000 }]);
  });

  it("keeps people with no expenses at zero and settles nothing when even", () => {
    const balances = personBalances(["Ana", "Ben", "Dee"], [expense({ split: { mode: "equal", people: ["Ana"] } })]);
    expect(balances.find((balance) => balance.name === "Dee")?.netCents).toBe(0);
    expect(settleUp(balances)).toEqual([]);
  });
});

describe("amount helpers", () => {
  it("reads typed amounts as cents", () => {
    expect(parseAmount("12.5")).toBe(1250);
    expect(parseAmount("$1,200.75")).toBe(120075);
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("1.234")).toBeNull();
  });

  it("reports what is left to assign in a custom split", () => {
    expect(unassignedCents(9000, { mode: "exact", shares: { Ana: 5000, Ben: 1000 } })).toBe(3000);
    expect(unassignedCents(9000, { mode: "equal", people: ["Ana"] })).toBe(0);
  });
});
