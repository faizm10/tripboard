"use client";

import { useState } from "react";
import { ExternalLink, Footprints, MoreHorizontal, Pencil, Plus, Search, TramFront, Trash2, X } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { buildGoogleMapsLegUrl } from "@/lib/navigation";
import type { TransitOption, TransitOptionsResult } from "@/lib/transit-routes";
import type { RouteStop, TransitPlan } from "@/lib/types";

export type TransitDraft = Omit<TransitPlan, "id"> & { id?: string };

export function orderedTransitPlans(plans: TransitPlan[], stops: { id: string }[]) {
  const stopOrder = new Map(stops.map((stop, index) => [stop.id, index]));
  const rank = (id: string) => stopOrder.get(id) ?? stops.length;
  return plans.toSorted((left, right) => rank(left.from.id) - rank(right.from.id) || rank(left.to.id) - rank(right.to.id));
}

/** The ride that belongs in the gap after each stop, plus any other rides that leave that stop. */
export function transitLegs(stops: { id: string }[], plans: TransitPlan[]) {
  const ordered = orderedTransitPlans(plans, stops);
  return stops.slice(0, -1).map((stop, index) => {
    const next = stops[index + 1];
    const leaving = ordered.filter((plan) => plan.from.id === stop.id);
    return {
      fromId: stop.id,
      toId: next.id,
      direct: leaving.find((plan) => plan.to.id === next.id) ?? null,
      other: leaving.filter((plan) => plan.to.id !== next.id),
    };
  });
}

/** Google's localized "9:05 AM" or "21:05" as the editor's 24-hour "HH:MM". */
export function toTimeInput(text?: string) {
  const match = text?.trim().match(/^(\d{1,2}):(\d{2})\s*([AaPp])?\.?[Mm]?\.?$/);
  if (!match) return "";
  let hours = Number(match[1]);
  const meridiem = match[3]?.toLowerCase();
  if (meridiem === "p" && hours < 12) hours += 12;
  if (meridiem === "a" && hours === 12) hours = 0;
  return hours > 23 ? "" : `${String(hours).padStart(2, "0")}:${match[2]}`;
}

/** A short line for the ride note, e.g. "Line 2 → Shinkansen · 32 min". */
export function transitOptionNote(option: TransitOption) {
  const lines = option.steps.flatMap((step) => step.kind === "ride" ? [step.line] : []);
  return `${lines.join(" → ")} · ${option.minutes} min`;
}

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
  const orderedPlans = orderedTransitPlans(plans, stops);

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
        <TransitRideCard key={plan.id} plan={plan} removing={removingId === plan.id} onEdit={() => setEditor(plan)} onRemove={() => void remove(plan.id)} />
      ))}
      {editor ? <TransitEditor key={editor === "new" ? "new" : editor.id} date={date} plan={editor === "new" ? null : editor} stops={stops} onCancel={() => setEditor(null)} onSave={async (draft) => { await onSave(draft); setEditor(null); }} /> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </section>
  );
}

export function TransitRideCard({ plan, removing, onEdit, onRemove }: {
  plan: TransitPlan;
  removing?: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <article className="transit-plan transit-leg">
      <span className="transit-leg-mark" aria-hidden="true"><TramFront size={16} /></span>
      <div className="transit-leg-copy">
        <strong className="transit-leg-route">{plan.from.name} → {plan.to.name}</strong>
        <span className="transit-leg-meta">
          <span>{plan.departureTime ? `Leave around ${plan.departureTime}` : "Any time"}</span>
          <a href={buildGoogleMapsLegUrl(plan.from, plan.to, "transit")} target="_blank" rel="noreferrer">Directions <ExternalLink size={12} /></a>
        </span>
        {plan.note ? <p>{plan.note}</p> : null}
      </div>
      <DropdownMenu><DropdownMenuTrigger asChild><button className="place-menu-trigger" disabled={removing} aria-label={`Transit options from ${plan.from.name} to ${plan.to.name}`} type="button"><MoreHorizontal size={19} /></button></DropdownMenuTrigger>
        <DropdownMenuContent className="planner-menu" align="end">
          <DropdownMenuItem onSelect={onEdit}><Pencil size={16} /> Edit transit plan</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={onRemove}><Trash2 size={16} /> Remove transit plan</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </article>
  );
}

export function TransitEditor({ date, plan, stops, initialFromId = "", initialToId = "", onSave, onCancel }: {
  date: string;
  plan: TransitPlan | null;
  stops: RouteStop[];
  initialFromId?: string;
  initialToId?: string;
  onSave: (draft: TransitDraft) => Promise<void>;
  onCancel: () => void;
}) {
  const [fromId, setFromId] = useState(plan && stops.some((stop) => stop.id === plan.from.id) ? plan.from.id : stops.some((stop) => stop.id === initialFromId) ? initialFromId : "");
  const [toId, setToId] = useState(plan && stops.some((stop) => stop.id === plan.to.id) ? plan.to.id : stops.some((stop) => stop.id === initialToId) ? initialToId : "");
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
  const [lookup, setLookup] = useState<{ key: string; status: "loading" | "error" } | ({ key: string; status: "done" } & TransitOptionsResult) | null>(null);
  const lookupKey = `${fromId}|${toId}|${departureTime}`;
  const shownLookup = lookup?.key === lookupKey ? lookup : null;

  async function findOptions() {
    if (!from || !to || !valid) return;
    const key = lookupKey;
    setLookup({ key, status: "loading" });
    try {
      const response = await fetch("/api/routes/transit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: from.coordinates, to: to.coordinates, date, departureTime }),
      });
      if (!response.ok) throw new Error("Transit lookup failed");
      setLookup({ key, status: "done", ...(await response.json() as TransitOptionsResult) });
    } catch {
      setLookup({ key, status: "error" });
    }
  }

  function chooseOption(option: TransitOption) {
    const leave = toTimeInput(option.departs);
    if (leave && shownLookup?.status === "done" && shownLookup.timedForTrip) setDepartureTime(leave);
    setNote(transitOptionNote(option));
  }

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
        {valid && from && to ? (
          <div className="transit-options">
            <button className="button button-ghost" disabled={shownLookup?.status === "loading"} onClick={() => void findOptions()} type="button"><Search size={15} /> {shownLookup?.status === "loading" ? "Finding rides…" : "Find transit options"}</button>
            {shownLookup?.status === "error" ? <p className="transit-help" role="status">Couldn’t load transit options. Compare them in Google Maps instead.</p> : null}
            {shownLookup?.status === "done" && !shownLookup.options.length ? <p className="transit-help" role="status">No transit found between these stops.</p> : null}
            {shownLookup?.status === "done" && shownLookup.options.length ? (
              <>
                <p className="transit-help">{shownLookup.timedForTrip ? `Timetable for ${date}${departureTime ? ` from ${departureTime}` : ""}.` : "Your trip is outside the published timetable, so these times are for today."}</p>
                <ul className="transit-option-list" aria-label="Transit options">
                  {shownLookup.options.map((option, index) => (
                    <li key={index}>
                      <button className="transit-option" onClick={() => chooseOption(option)} type="button" aria-label={`Use ${transitOptionNote(option)}`}>
                        <span className="transit-option-head"><strong>{option.minutes} min</strong>{option.departs && option.arrives ? <span>{option.departs} → {option.arrives}</span> : null}<span>{option.transfers ? `${option.transfers} transfer${option.transfers > 1 ? "s" : ""}` : "Direct"}</span>{option.fare ? <span>{option.fare}</span> : null}</span>
                        <span className="transit-option-steps">
                          {option.steps.map((step, stepIndex) => step.kind === "walk"
                            ? <span className="transit-step-walk" key={stepIndex}><Footprints size={12} aria-hidden="true" /> {step.minutes} min</span>
                            : <span className="transit-step-line" key={stepIndex} style={step.color ? { background: step.color, color: step.textColor ?? "#fff" } : undefined} title={[step.vehicle, step.headsign && `towards ${step.headsign}`, step.from && `${step.from} → ${step.to}`].filter(Boolean).join(" · ")}>{step.line}</span>)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            <a className="transit-compare" href={buildGoogleMapsLegUrl(from, to, "transit")} target="_blank" rel="noreferrer">Compare transit in Google Maps <ExternalLink size={14} /></a>
          </div>
        ) : null}
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <button className="button button-ink" disabled={!valid || saving} type="submit">{saving ? "Saving…" : "Save transit plan"}</button>
      </fieldset>
    </form>
  );
}
