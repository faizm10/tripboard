"use client";

import { ArrowRight, BedDouble, Check, Pencil, Plus, Trash2, Undo2, UserPlus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { JourneyIcon, journeyModeOf } from "@/components/flight-plan-dialog";
import { addExpense, removeExpense, saveFinanceSettings, updateExpense } from "@/app/trips/actions";
import { unwrap } from "@/lib/action-result";
import { CURRENCIES, centsToInput, expenseShares, formatMoney, parseAmount, paymentFor, personBalances, settleUp, totalSpent, tripCents, unassignedCents, type Settlement } from "@/lib/finances";
import type { ExpenseSplit, Flight, HotelStay, TripExpense, TripFinances } from "@/lib/types";

type SaveState = "idle" | "saving" | "saved" | "error";
type Draft = { id?: string; title: string; amount: string; currency: string; rate: string; rateNote: string; paidBy: string; spentOn: string; mode: ExpenseSplit["mode"]; people: string[]; shares: Record<string, string> };

function dayLabel(date: string) {
  return new Date(`${date}T00:00:00.000Z`).toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

export function FinancePanel({ dates, defaultPeople, finances, flights = [], hotels = [], onSaveState, persistable, tripId }: {
  dates: string[];
  defaultPeople: string[];
  finances?: TripFinances;
  flights?: Flight[];
  hotels?: HotelStay[];
  onSaveState: (state: SaveState) => void;
  persistable: boolean;
  tripId: string;
}) {
  const [currency, setCurrency] = useState(finances?.currency ?? "USD");
  const [people, setPeople] = useState(() => finances?.people.length ? finances.people : defaultPeople);
  const [expenses, setExpenses] = useState<TripExpense[]>(finances?.expenses ?? []);
  const [newPerson, setNewPerson] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const localCounter = useRef(0);

  const balances = useMemo(() => personBalances(people, expenses), [expenses, people]);
  const settlements = useMemo(() => settleUp(balances), [balances]);
  const total = totalSpent(expenses);
  const spending = expenses.filter((expense) => expense.kind !== "payment");
  const payments = expenses.filter((expense) => expense.kind === "payment");
  const usedPeople = useMemo(() => new Set(expenses.flatMap((expense) => [expense.paidBy, ...expenseShares(expense).keys()])), [expenses]);
  const money = (cents: number) => formatMoney(cents, currency);

  async function persist(work: () => Promise<unknown>, rollback: () => void) {
    if (!persistable) return;
    onSaveState("saving");
    try {
      await work();
      onSaveState("saved");
    } catch (caught) {
      rollback();
      setError(caught instanceof Error ? caught.message : "Couldn’t save that change.");
      onSaveState("error");
    }
  }

  function saveSettings(nextPeople: string[], nextCurrency: string) {
    const previous = { people, currency };
    setPeople(nextPeople);
    setCurrency(nextCurrency);
    void persist(() => unwrap(saveFinanceSettings({ tripId, currency: nextCurrency, people: nextPeople })), () => { setPeople(previous.people); setCurrency(previous.currency); });
  }

  function addPerson() {
    const name = newPerson.trim();
    if (!name) return;
    if (people.some((person) => person.toLowerCase() === name.toLowerCase())) { setError(`${name} is already splitting costs.`); return; }
    setError("");
    setNewPerson("");
    saveSettings([...people, name], currency);
  }

  function startExpense(expense?: TripExpense) {
    setError("");
    if (!expense) {
      setDraft({ title: "", amount: "", currency, rate: "1", rateNote: "", paidBy: people[0] ?? "", spentOn: "", mode: "equal", people: [...people], shares: {} });
      return;
    }
    setDraft({
      id: expense.id,
      title: expense.title,
      amount: centsToInput(expense.amountCents),
      currency: expense.currency ?? currency,
      rate: String(expense.rate ?? 1),
      rateNote: "",
      paidBy: expense.paidBy,
      spentOn: expense.spentOn ?? "",
      mode: expense.split.mode,
      people: expense.split.mode === "equal" ? expense.split.people : people,
      shares: expense.split.mode === "exact" ? Object.fromEntries(Object.entries(expense.split.shares).map(([name, cents]) => [name, centsToInput(cents)])) : {},
    });
  }

  const draftCents = draft ? parseAmount(draft.amount) : null;
  const draftRate = draft ? (draft.currency === currency ? 1 : Number(draft.rate)) : 1;
  const draftMoney = (cents: number) => formatMoney(cents, draft?.currency ?? currency);
  const draftCurrency = draft?.currency;
  const draftId = draft?.id;

  // Look up today's rate whenever a new expense switches to another currency; people can still type their own.
  useEffect(() => {
    if (!draftCurrency || draftCurrency === currency || draftId) return;
    let cancelled = false;
    fetch(`/api/fx?from=${draftCurrency}&to=${currency}`)
      .then((response) => response.json() as Promise<{ rate?: number; date?: string; error?: string }>)
      .then((body) => {
        if (cancelled) return;
        setDraft((current) => current && current.currency === draftCurrency
          ? { ...current, rate: body.rate ? String(Number(body.rate.toPrecision(6))) : current.rate, rateNote: body.rate ? `Rate from ${body.date ?? "today"}` : body.error ?? "" }
          : current);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [currency, draftCurrency, draftId]);
  const draftSplit: ExpenseSplit | null = draft
    ? draft.mode === "equal"
      ? { mode: "equal", people: draft.people }
      : { mode: "exact", shares: Object.fromEntries(people.map((name) => [name, parseAmount(draft.shares[name] ?? "") ?? 0])) }
    : null;
  const leftToAssign = draft && draftSplit && draftCents ? unassignedCents(draftCents, draftSplit) : 0;

  function splitRestEvenly() {
    if (!draft || !draftCents) return;
    // Fill the blank shares with what's left; if nothing is blank or shares run over, start again evenly.
    const empty = people.filter((name) => !parseAmount(draft.shares[name] ?? ""));
    const fillBlanks = leftToAssign > 0 && empty.length > 0;
    const targets = fillBlanks ? empty : people;
    const remaining = fillBlanks ? leftToAssign : draftCents;
    const shares = fillBlanks ? { ...draft.shares } : {} as Record<string, string>;
    const each = Math.floor(remaining / targets.length);
    targets.forEach((name, index) => { shares[name] = centsToInput(each + (index < remaining - each * targets.length ? 1 : 0)); });
    setDraft({ ...draft, shares });
  }

  function saveDraft() {
    if (!draft || !draftSplit) return;
    if (!draft.title.trim()) { setError("Name the expense, like “Dinner” or “Museum tickets”."); return; }
    if (!draftCents) { setError("Enter an amount, like 42.50."); return; }
    if (!draft.paidBy) { setError("Choose who paid."); return; }
    if (draftSplit.mode === "equal" && !draftSplit.people.length) { setError("Pick at least one person to split with."); return; }
    if (draftSplit.mode === "exact" && leftToAssign !== 0) { setError(leftToAssign > 0 ? `Assign the remaining ${draftMoney(leftToAssign)}.` : `Shares are ${draftMoney(-leftToAssign)} over the total.`); return; }
    if (!(draftRate > 0)) { setError(`Enter how much 1 ${draft.currency} is in ${currency}.`); return; }
    setError("");
    const foreign = draft.currency !== currency;
    const fields = { title: draft.title.trim(), amountCents: draftCents, paidBy: draft.paidBy, split: draftSplit, spentOn: draft.spentOn || null, kind: "expense" as const, currency: foreign ? draft.currency : null, rate: foreign ? draftRate : 1 };
    const previous = expenses;
    if (draft.id) {
      const id = draft.id;
      setExpenses((current) => current.map((expense) => expense.id === id ? { id, ...fields } : expense));
      void persist(() => unwrap(updateExpense({ tripId, expenseId: id, ...fields, spentOn: fields.spentOn ?? "" })), () => setExpenses(previous));
    } else {
      localCounter.current += 1;
      const localId = `local-expense-${localCounter.current}`;
      setExpenses((current) => [...current, { id: localId, ...fields }]);
      void persist(async () => {
        const saved = await unwrap(addExpense({ tripId, ...fields, spentOn: fields.spentOn ?? "" }));
        setExpenses((current) => current.map((expense) => expense.id === localId ? { ...expense, id: saved.id } : expense));
      }, () => setExpenses(previous));
    }
    setDraft(null);
  }

  function markPaid(settlement: Settlement) {
    const fields = paymentFor(settlement, new Date().toISOString().slice(0, 10));
    localCounter.current += 1;
    const localId = `local-expense-${localCounter.current}`;
    const previous = expenses;
    setExpenses((current) => [...current, { id: localId, ...fields }]);
    void persist(async () => {
      const saved = await unwrap(addExpense({ tripId, ...fields, spentOn: fields.spentOn ?? "" }));
      setExpenses((current) => current.map((expense) => expense.id === localId ? { ...expense, id: saved.id } : expense));
    }, () => setExpenses(previous));
  }

  function prefill(title: string, spentOn: string) {
    setDraft((current) => current && { ...current, title, spentOn: dates.includes(spentOn) ? spentOn : current.spentOn });
  }

  function deleteExpense(id: string) {
    const previous = expenses;
    setExpenses((current) => current.filter((expense) => expense.id !== id));
    setDraft(null);
    void persist(() => unwrap(removeExpense({ tripId, expenseId: id })), () => setExpenses(previous));
  }

  function splitLabel(expense: TripExpense) {
    const shares = expenseShares(expense);
    if (expense.split.mode === "exact") return `custom split · ${shares.size} ${shares.size === 1 ? "person" : "people"}`;
    if (shares.size === people.length && people.length > 1) return "split evenly with everyone";
    return shares.size === 1 ? `for ${[...shares.keys()][0]}` : `split ${shares.size} ways`;
  }

  return (
    <section className="money-panel" aria-label="Trip money">
      <div className="money-summary">
        <div><small>Total spent</small><strong>{money(total)}</strong></div>
        <div><small>Per person</small><strong>{money(people.length ? Math.round(total / people.length) : 0)}</strong></div>
        <label><small>Currency</small><select aria-label="Currency" value={currency} onChange={(event) => saveSettings(people, event.target.value)}>{CURRENCIES.map((code) => <option key={code}>{code}</option>)}</select></label>
      </div>

      {draft ? (
        <div className="money-form" role="group" aria-label={draft.id ? "Edit expense" : "New expense"}>
          <div className="money-form-head"><strong>{draft.id ? "Edit expense" : "New expense"}</strong><button className="icon-button" aria-label="Cancel" onClick={() => { setDraft(null); setError(""); }} type="button"><X size={18} /></button></div>
          <div className="money-form-grid">
            <label className="field-label"><span>What for</span><input autoFocus value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Dinner at Joe’s" maxLength={80} /></label>
            <div className="field-label money-amount"><span>Amount</span><div><input aria-label="Amount" inputMode="decimal" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} placeholder="0.00" /><select aria-label="Expense currency" value={draft.currency} onChange={(event) => setDraft({ ...draft, currency: event.target.value, rate: event.target.value === currency ? "1" : draft.rate, rateNote: "" })}>{Array.from(new Set([currency, ...CURRENCIES])).map((code) => <option key={code}>{code}</option>)}</select></div></div>
            <label className="field-label"><span>Paid by</span><select value={draft.paidBy} onChange={(event) => setDraft({ ...draft, paidBy: event.target.value })}>{people.map((name) => <option key={name}>{name}</option>)}</select></label>
            <label className="field-label"><span>Day <small>Optional</small></span><select value={draft.spentOn} onChange={(event) => setDraft({ ...draft, spentOn: event.target.value })}><option value="">No day</option>{dates.map((date) => <option key={date} value={date}>{dayLabel(date)}</option>)}</select></label>
          </div>
          {draft.currency !== currency ? (
            <div className="money-rate">
              <label><span>1 {draft.currency} =</span><input aria-label={`${currency} per ${draft.currency}`} inputMode="decimal" value={draft.rate} onChange={(event) => setDraft({ ...draft, rate: event.target.value, rateNote: "Your rate" })} /><span>{currency}</span></label>
              <small>{draftCents && draftRate > 0 ? `≈ ${money(Math.round(draftCents * draftRate))}` : ""}{draft.rateNote ? ` · ${draft.rateNote}` : ""}</small>
            </div>
          ) : null}
          {!draft.id && (hotels.length || flights.length) ? (
            <div className="money-prefill" aria-label="Fill from your trip">
              <small>From your trip</small>
              {hotels.map((hotel) => <button key={hotel.id} onClick={() => prefill(`Hotel · ${hotel.name}`, hotel.startDate)} type="button"><BedDouble size={13} /> {hotel.name}</button>)}
              {flights.map((flight) => <button key={flight.id} onClick={() => prefill(`${journeyModeOf(flight) === "flight" ? "Flight" : journeyModeOf(flight) === "train" ? "Train" : "Bus"} · ${flight.departureAirport} → ${flight.arrivalAirport}`, flight.plannedDate)} type="button"><JourneyIcon mode={journeyModeOf(flight)} size={13} /> {flight.departureAirport} → {flight.arrivalAirport}</button>)}
            </div>
          ) : null}
          <div className="money-split-mode" role="radiogroup" aria-label="How to split">
            <button aria-checked={draft.mode === "equal"} className={draft.mode === "equal" ? "active" : ""} onClick={() => setDraft({ ...draft, mode: "equal" })} role="radio" type="button">Split equally</button>
            <button aria-checked={draft.mode === "exact"} className={draft.mode === "exact" ? "active" : ""} onClick={() => setDraft({ ...draft, mode: "exact" })} role="radio" type="button">Custom amounts</button>
          </div>
          {draft.mode === "equal" ? (
            <>
              <div className="money-people-picks">
                {people.map((name) => {
                  const on = draft.people.includes(name);
                  return <button aria-pressed={on} className={on ? "active" : ""} key={name} onClick={() => setDraft({ ...draft, people: on ? draft.people.filter((person) => person !== name) : people.filter((person) => person === name || draft.people.includes(person)) })} type="button">{name}</button>;
                })}
              </div>
              <p className="money-hint">{draftCents && draft.people.length ? `${draftMoney(Math.floor(draftCents / draft.people.length))} each · ${draft.people.length} ${draft.people.length === 1 ? "person" : "people"}` : "Tap people to include or leave them out."}</p>
            </>
          ) : (
            <>
              <div className="money-shares">
                {people.map((name) => <label key={name}><span>{name}</span><input inputMode="decimal" value={draft.shares[name] ?? ""} onChange={(event) => setDraft({ ...draft, shares: { ...draft.shares, [name]: event.target.value } })} placeholder="0.00" /></label>)}
              </div>
              <p className={`money-hint${leftToAssign < 0 ? " over" : ""}`}>
                {!draftCents ? "Enter the total first." : leftToAssign === 0 ? "Shares add up to the total." : leftToAssign > 0 ? `${draftMoney(leftToAssign)} left to assign` : `${draftMoney(-leftToAssign)} over the total`}
                {draftCents && leftToAssign !== 0 ? <button className="inline-action" onClick={splitRestEvenly} type="button">{leftToAssign > 0 ? "Split the rest evenly" : "Reset to even"}</button> : null}
              </p>
            </>
          )}
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <div className="flight-dialog-actions">
            {draft.id ? <button className="button button-ghost" onClick={() => deleteExpense(draft.id!)} type="button"><Trash2 size={15} /> Delete</button> : <span />}
            <button className="button button-ink" onClick={saveDraft} type="button">{draft.id ? "Save expense" : "Add expense"}</button>
          </div>
        </div>
      ) : (
        <button className="button button-ink money-add" disabled={!people.length} onClick={() => startExpense()} type="button"><Plus size={16} /> Add an expense</button>
      )}

      <section className="money-section" aria-label="Settle up">
        <h3>Settle up</h3>
        {settlements.length ? (
          <ul className="money-settle">
            {settlements.map((settlement) => <li key={`${settlement.from}-${settlement.to}`}><strong>{settlement.from}</strong><span><ArrowRight size={14} /> pays</span><strong>{settlement.to}</strong><b>{money(settlement.amountCents)}</b><button className="money-paid" onClick={() => markPaid(settlement)} type="button"><Check size={14} /> Mark paid</button></li>)}
          </ul>
        ) : <p className="money-empty">{expenses.length ? "Everyone’s even." : "Add an expense and Tripboard works out who owes whom."}</p>}
      </section>

      <section className="money-section" aria-label="People">
        <h3>People <small>{people.length}</small></h3>
        <ul className="money-balances">
          {balances.filter((balance) => people.includes(balance.name)).map((balance) => (
            <li key={balance.name}>
              <span className="money-person">{balance.name}<small>paid {money(balance.paidCents)} · share {money(balance.owedCents)}</small></span>
              <span className={`money-net${balance.netCents > 0 ? " up" : balance.netCents < 0 ? " down" : ""}`}>{balance.netCents > 0 ? `gets back ${money(balance.netCents)}` : balance.netCents < 0 ? `owes ${money(-balance.netCents)}` : "even"}</span>
              <button className="icon-button" aria-label={`Remove ${balance.name}`} disabled={usedPeople.has(balance.name)} title={usedPeople.has(balance.name) ? "Used in an expense" : undefined} onClick={() => saveSettings(people.filter((person) => person !== balance.name), currency)} type="button"><X size={15} /></button>
            </li>
          ))}
        </ul>
        <form className="money-add-person" onSubmit={(event) => { event.preventDefault(); addPerson(); }}>
          <input aria-label="Add a person" value={newPerson} onChange={(event) => setNewPerson(event.target.value)} placeholder="Add someone, even without an account" maxLength={40} />
          <button className="button button-small" type="submit"><UserPlus size={14} /> Add</button>
        </form>
        {!draft && error ? <p className="form-error" role="alert">{error}</p> : null}
      </section>

      <section className="money-section" aria-label="Expenses">
        <h3>Expenses <small>{spending.length}</small></h3>
        {spending.length ? (
          <ul className="money-expenses">
            {[...spending].sort((left, right) => (right.spentOn ?? "").localeCompare(left.spentOn ?? "")).map((expense) => (
              <li key={expense.id}>
                <button onClick={() => startExpense(expense)} type="button">
                  <span><strong>{expense.title}</strong><small>{expense.spentOn ? `${dayLabel(expense.spentOn)} · ` : ""}{expense.paidBy} paid · {splitLabel(expense)}</small></span>
                  <b>{money(tripCents(expense))}{expense.currency && expense.currency !== currency ? <small>{formatMoney(expense.amountCents, expense.currency)}</small> : null}</b>
                  <Pencil size={14} />
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="money-empty">No expenses yet.</p>}
      </section>

      {payments.length ? (
        <section className="money-section" aria-label="Payments">
          <h3>Paid back <small>{payments.length}</small></h3>
          <ul className="money-payments">
            {payments.map((payment) => <li key={payment.id}><Check size={14} /><span>{payment.title}{payment.spentOn ? <small> · {dayLabel(payment.spentOn)}</small> : null}</span><b>{money(tripCents(payment))}</b><button className="icon-button" aria-label={`Undo ${payment.title}`} onClick={() => deleteExpense(payment.id)} type="button"><Undo2 size={14} /></button></li>)}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
