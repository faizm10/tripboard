import type { ExpenseSplit, TripExpense } from "@/lib/types";

export const CURRENCIES = ["USD", "CAD", "EUR", "GBP", "AUD", "NZD", "JPY", "KRW", "CNY", "HKD", "SGD", "THB", "INR", "MXN", "BRL", "CHF", "SEK", "NOK", "DKK", "PLN", "CZK", "TRY", "ZAR"] as const;

export type PersonBalance = { name: string; paidCents: number; owedCents: number; netCents: number };
export type Settlement = { from: string; to: string; amountCents: number };

/** The expense in trip-currency cents. */
export function tripCents(expense: Pick<TripExpense, "amountCents" | "rate">) {
  return Math.round(expense.amountCents * (expense.rate ?? 1));
}

/** Shares in the currency the expense was paid in. Leftover cents go to the first people so shares always add up. */
function originalShares(expense: Pick<TripExpense, "amountCents" | "split">): Map<string, number> {
  const shares = new Map<string, number>();
  if (expense.split.mode === "exact") {
    for (const [name, cents] of Object.entries(expense.split.shares)) if (cents > 0) shares.set(name, cents);
    return shares;
  }
  const people = Array.from(new Set(expense.split.people));
  if (!people.length) return shares;
  const base = Math.floor(expense.amountCents / people.length);
  const remainder = expense.amountCents - base * people.length;
  people.forEach((name, index) => shares.set(name, base + (index < remainder ? 1 : 0)));
  return shares;
}

/** Each person's share of one expense in trip-currency cents, rounded so the shares still add up to the converted total. */
export function expenseShares(expense: Pick<TripExpense, "amountCents" | "split" | "rate">): Map<string, number> {
  const shares = originalShares(expense);
  const rate = expense.rate ?? 1;
  if (rate === 1) return shares;
  const exact = [...shares].map(([name, cents]) => ({ name, value: cents * rate }));
  const rounded = new Map(exact.map(({ name, value }) => [name, Math.floor(value)]));
  let leftover = tripCents(expense) - [...rounded.values()].reduce((sum, cents) => sum + cents, 0);
  for (const { name } of [...exact].sort((left, right) => (right.value % 1) - (left.value % 1))) {
    if (leftover <= 0) break;
    rounded.set(name, rounded.get(name)! + 1);
    leftover -= 1;
  }
  return rounded;
}

/** Real spending only; paying someone back moves money but isn't a trip cost. */
export function totalSpent(expenses: TripExpense[]) {
  return expenses.filter((expense) => expense.kind !== "payment").reduce((sum, expense) => sum + tripCents(expense), 0);
}

/** A settle-up suggestion recorded as done: the debtor "pays" an expense owed entirely by the creditor. */
export function paymentFor(settlement: Settlement, spentOn?: string | null): Omit<TripExpense, "id"> {
  return { kind: "payment", title: `${settlement.from} paid ${settlement.to}`, amountCents: settlement.amountCents, paidBy: settlement.from, split: { mode: "exact", shares: { [settlement.to]: settlement.amountCents } }, spentOn: spentOn ?? null };
}

/** What each person paid, what they owe, and the difference. Positive net means they are owed money. */
export function personBalances(people: string[], expenses: TripExpense[]): PersonBalance[] {
  const names = Array.from(new Set([...people, ...expenses.flatMap((expense) => [expense.paidBy, ...expenseShares(expense).keys()])]));
  const balances = new Map(names.map((name) => [name, { name, paidCents: 0, owedCents: 0, netCents: 0 }]));
  for (const expense of expenses) {
    balances.get(expense.paidBy)!.paidCents += tripCents(expense);
    for (const [name, cents] of expenseShares(expense)) balances.get(name)!.owedCents += cents;
  }
  return names.map((name) => {
    const balance = balances.get(name)!;
    return { ...balance, netCents: balance.paidCents - balance.owedCents };
  });
}

/** The fewest straightforward payments that clear everyone's balance: the biggest debtor pays the biggest creditor first. */
export function settleUp(balances: PersonBalance[]): Settlement[] {
  const debtors = balances.filter((balance) => balance.netCents < 0).map((balance) => ({ name: balance.name, cents: -balance.netCents }));
  const creditors = balances.filter((balance) => balance.netCents > 0).map((balance) => ({ name: balance.name, cents: balance.netCents }));
  debtors.sort((left, right) => right.cents - left.cents);
  creditors.sort((left, right) => right.cents - left.cents);
  const settlements: Settlement[] = [];
  let d = 0;
  let c = 0;
  while (d < debtors.length && c < creditors.length) {
    const amountCents = Math.min(debtors[d].cents, creditors[c].cents);
    if (amountCents > 0) settlements.push({ from: debtors[d].name, to: creditors[c].name, amountCents });
    debtors[d].cents -= amountCents;
    creditors[c].cents -= amountCents;
    if (debtors[d].cents === 0) d += 1;
    if (creditors[c].cents === 0) c += 1;
  }
  return settlements;
}

/** Cents left to assign in a custom split. Negative means the shares add up to more than the total. */
export function unassignedCents(amountCents: number, split: ExpenseSplit) {
  if (split.mode === "equal") return 0;
  return amountCents - Object.values(split.shares).reduce((sum, cents) => sum + cents, 0);
}

/** "12.5" or "1,200.75" to cents; null when it isn't a usable amount. */
export function parseAmount(value: string): number | null {
  const cleaned = value.replace(/[,\s]/g, "").replace(/^[^\d.]+/, "");
  if (!/^\d*(\.\d{0,2})?$/.test(cleaned) || cleaned === "" || cleaned === ".") return null;
  return Math.round(Number(cleaned) * 100);
}

export function centsToInput(cents: number) {
  return cents ? (cents / 100).toFixed(2).replace(/\.00$/, "") : "";
}

export function formatMoney(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}
