"use client";

import { useState } from "react";
import { ExternalLink, MoreHorizontal, Pencil, Plus, TramFront, Trash2, X } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { buildGoogleMapsLegUrl } from "@/lib/navigation";
import type { RouteStop, TransitPlan } from "@/lib/types";

export type TransitDraft = Omit<TransitPlan, "id"> & { id?: string };

export function DayTransitPlanner({ date, stops, plans, onSave, onRemove }: {
  date: string;
  stops: RouteStop[];
  plans: TransitPlan[];
  onSave: (draft: TransitDraft) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const [editor, setEditor] = useState<TransitPlan | "new" | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const stopOrder = new Map(stops.map((stop, index) => [stop.id, index]));
  const rank = (id: string) => stopOrder.get(id) ?? stops.length;
  const orderedPlans = plans.toSorted((left, right) =>
    rank(left.from.id) - rank(right.from.id) || rank(left.to.id) - rank(right.to.id),
  );

  async function remove(id: string) {
    setRemovingId(id);
    setError("");
    try { await onRemove(id); }
    catch { setError("Couldn’t remove this ride. Try again."); }
    finally { setRemovingId(null); }
  }

  return (
    <section className="day-transit-planner" aria-label="Transit plans">
      <header>
        <div><TramFront size={16} /><strong>Transit plans</strong></div>
        <button className="transit-add" disabled={editor !== null || stops.length < 2} onClick={() => setEditor("new")} type="button"><Plus size={15} /> Plan transit</button>
      </header>
      {!plans.length && !editor ? <p className="transit-help">{stops.length < 2 ? "Plan at least two stops for this day to choose a ride." : "Choose a ride between this day’s places or hotel."}</p> : null}
      {orderedPlans.map((plan) => (
        <article className="transit-plan" key={plan.id}>
          <div>
            <small>{plan.departureTime ? `Depart around ${plan.departureTime} · local time` : "Departure time flexible"}</small>
            <strong>{plan.from.name} → {plan.to.name}</strong>
            {plan.note ? <p>{plan.note}</p> : null}
            <a href={buildGoogleMapsLegUrl(plan.from, plan.to, "transit")} target="_blank" rel="noreferrer">Check Google Maps <ExternalLink size={13} /></a>
          </div>
          <DropdownMenu><DropdownMenuTrigger asChild><button className="place-menu-trigger" disabled={removingId === plan.id} aria-label={`Transit options from ${plan.from.name} to ${plan.to.name}`} type="button"><MoreHorizontal size={19} /></button></DropdownMenuTrigger>
            <DropdownMenuContent className="planner-menu" align="end">
              <DropdownMenuItem onSelect={() => setEditor(plan)}><Pencil size={16} /> Edit transit plan</DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => void remove(plan.id)}><Trash2 size={16} /> Remove transit plan</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </article>
      ))}
      {editor ? <TransitEditor key={editor === "new" ? "new" : editor.id} date={date} plan={editor === "new" ? null : editor} stops={stops} onCancel={() => setEditor(null)} onSave={async (draft) => { await onSave(draft); setEditor(null); }} /> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </section>
  );
}

function TransitEditor({ date, plan, stops, onSave, onCancel }: {
  date: string;
  plan: TransitPlan | null;
  stops: RouteStop[];
  onSave: (draft: TransitDraft) => Promise<void>;
  onCancel: () => void;
}) {
  const [fromId, setFromId] = useState(plan && stops.some((stop) => stop.id === plan.from.id) ? plan.from.id : "");
  const [toId, setToId] = useState(plan && stops.some((stop) => stop.id === plan.to.id) ? plan.to.id : "");
  const [departureTime, setDepartureTime] = useState(plan?.departureTime ?? "");
  const [note, setNote] = useState(plan?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const options = stops;
  const placeNumbers = new Map(options.filter((stop) => !stop.id.startsWith("hotel-")).map((stop, index) => [stop.id, String(index + 1).padStart(2, "0")]));
  const optionLabel = (stop: RouteStop) => `${placeNumbers.get(stop.id) ?? "Hotel"} · ${stop.name}`;
  const from = options.find((stop) => stop.id === fromId);
  const to = options.find((stop) => stop.id === toId);
  const valid = Boolean(from && to && from.id !== to.id);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!from || !to || !valid || saving) return;
    setSaving(true);
    setError("");
    try { await onSave({ id: plan?.id, plannedDate: date, from, to, departureTime, note: note.trim() }); }
    catch { setError("Couldn’t save this ride. Your choices are still here—try again."); }
    finally { setSaving(false); }
  }

  return (
    <form className="transit-editor" aria-label="Plan a transit ride" onSubmit={submit}>
      <fieldset disabled={saving}>
        <legend className="sr-only">Choose your transit ride</legend>
        <div className="transit-editor-heading"><strong>{plan ? "Edit ride" : "Where will you take transit?"}</strong><button className="place-menu-trigger" aria-label="Cancel transit plan" onClick={onCancel} type="button"><X size={18} /></button></div>
        <p className="transit-help">Places and hotel stays for this day, in itinerary order.</p>
        {plan && (!from || !to) ? <p className="transit-help" role="status">A saved stop is no longer planned for this day. Choose a replacement before saving.</p> : null}
        <label>From<select aria-label="Transit from" value={fromId} onChange={(event) => { setFromId(event.target.value); if (event.target.value === toId) setToId(""); }} required><option value="">Choose a starting point</option>{options.map((stop) => <option key={stop.id} value={stop.id}>{optionLabel(stop)}</option>)}</select></label>
        <label>To<select aria-label="Transit to" value={toId} onChange={(event) => setToId(event.target.value)} required><option value="">Choose a destination</option>{options.filter((stop) => stop.id !== fromId).map((stop) => <option key={stop.id} value={stop.id}>{optionLabel(stop)}</option>)}</select></label>
        <label>Departure time (optional)<input aria-label="Transit departure time" type="time" value={departureTime} onChange={(event) => setDepartureTime(event.target.value)} /></label>
        <label>Note (optional)<input aria-label="Transit note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} placeholder="e.g. After lunch, head to the next area" /></label>
        <p className="transit-help">Compare routes in Google Maps, then save this ride here. Set {date}{departureTime ? ` at ${departureTime}` : " and your departure time"} in Google Maps for the right timetable.</p>
        {valid && from && to ? <a className="transit-compare" href={buildGoogleMapsLegUrl(from, to, "transit")} target="_blank" rel="noreferrer">Compare transit in Google Maps <ExternalLink size={14} /></a> : null}
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <button className="button button-ink" disabled={!valid || saving} type="submit">{saving ? "Saving…" : "Save transit plan"}</button>
      </fieldset>
    </form>
  );
}
